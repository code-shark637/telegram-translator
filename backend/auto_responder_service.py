import logging
from typing import Optional, Dict, Any
from database import db
from telethon_service import telethon_service
from websocket_manager import manager

logger = logging.getLogger(__name__)


class AutoResponderService:
    def __init__(self):
        self.enabled = True
    
    async def check_and_respond(self, message_data: Dict[str, Any], user_id: int) -> bool:
        """
        Check if message matches any auto-responder rules and send response if matched.
        Returns True if a response was sent, False otherwise.
        """
        if not self.enabled:
            return False
        
        # Only respond to incoming messages (not outgoing)
        if message_data.get('is_outgoing', False):
            return False
        
        account_id = message_data.get('account_id')
        message_text = message_data.get('text', '').strip()
        
        if not account_id or not message_text:
            return False
        
        try:
            # Get active rules for this user, ordered by priority
            rules = await db.fetch(
                """
                SELECT id, name, keywords, response_text, media_type, media_file_path, priority
                FROM auto_responder_rules
                WHERE user_id = $1 AND is_active = true
                ORDER BY priority DESC, id ASC
                """,
                user_id,
            )
            
            if not rules:
                return False
            
            # Check each rule for a match (case-insensitive contains)
            message_lower = message_text.lower()
            
            for rule in rules:
                matched_keyword = None
                
                # Check if any keyword is contained in the message (case-insensitive)
                for keyword in rule['keywords']:
                    if keyword.lower() in message_lower:
                        matched_keyword = keyword
                        break
                
                if matched_keyword:
                    logger.info(f"Auto-responder rule {rule['id']} matched keyword '{matched_keyword}' in message")
                    
                    # Send the auto-response
                    success = await self._send_response(
                        account_id,
                        message_data['peer_id'],
                        rule['response_text'],
                        rule['media_type'],
                        rule['media_file_path']
                    )
                    
                    if success:
                        # Log the trigger
                        await self._log_trigger(
                            rule['id'],
                            message_data,
                            matched_keyword
                        )
                        return True
                    
            return False
            
        except Exception as e:
            logger.error(f"Error in auto-responder check: {e}")
            return False
    
    async def _send_response(
        self,
        account_id: int,
        peer_id: int,
        response_text: str,
        media_type: Optional[str],
        media_file_path: Optional[str]
    ) -> bool:
        """Send the auto-response message"""
        try:
            session = await telethon_service.get_session(account_id)
            if not session or not session.is_connected:
                logger.error(f"Session not connected for account {account_id}")
                return False
            
            # Send message with or without media
            if media_type and media_file_path:
                # Send with media
                sent_message = await session.client.send_file(
                    peer_id,
                    media_file_path,
                    caption=response_text
                )
            else:
                # Send text only
                sent_message = await session.client.send_message(
                    peer_id,
                    response_text
                )
            
            # Get conversation_id
            conversation = await db.fetchrow(
                """
                SELECT id FROM conversations
                WHERE telegram_account_id = $1 AND telegram_peer_id = $2
                """,
                account_id,
                peer_id
            )
            
            if not conversation:
                logger.warning(f"Conversation not found for saving auto-reply")
                return True  # Still return True as message was sent
            
            # Get account info for target language
            account = await db.fetchrow(
                "SELECT target_language FROM telegram_accounts WHERE id = $1",
                account_id
            )
            
            # Determine message type based on media
            msg_type = 'auto_reply'
            has_media = False
            media_filename = None
            
            if media_type and media_file_path:
                has_media = True
                import os
                media_filename = os.path.basename(media_file_path)
                # If there's media, use the media type but keep auto_reply for identification
                # We'll handle this in the frontend
            
            # Save the auto-reply message to database
            message_id = await db.fetchval(
                """
                INSERT INTO messages
                (conversation_id, telegram_message_id, sender_user_id, sender_name, 
                 sender_username, type, original_text, target_language, created_at, 
                 is_outgoing, has_media, media_file_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
                """,
                conversation['id'],
                sent_message.id,
                sent_message.sender_id,
                'Auto-Responder',
                'auto_responder',
                msg_type,
                response_text,
                account['target_language'] if account else 'en',
                sent_message.date,
                True,  # is_outgoing
                has_media,
                media_filename
            )
            
            # Broadcast the message via WebSocket
            await manager.send_to_account(
                {
                    "type": "new_message",
                    "message": {
                        "id": message_id,
                        "conversation_id": conversation['id'],
                        "telegram_message_id": sent_message.id,
                        "sender_user_id": sent_message.sender_id,
                        "sender_name": "Auto-Responder",
                        "sender_username": "auto_responder",
                        "type": msg_type,
                        "original_text": response_text,
                        "translated_text": None,
                        "source_language": None,
                        "target_language": account['target_language'] if account else 'en',
                        "created_at": sent_message.date.isoformat() if sent_message.date else None,
                        "is_outgoing": True,
                        "has_media": has_media,
                        "media_file_name": media_filename
                    }
                },
                account_id,
                (await db.fetchval("SELECT user_id FROM telegram_accounts WHERE id = $1", account_id))
            )
            
            logger.info(f"Sent auto-response to peer {peer_id}, message_id: {message_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send auto-response: {e}")
            return False
    
    async def _log_trigger(
        self,
        rule_id: int,
        message_data: Dict[str, Any],
        matched_keyword: str
    ):
        """Log the auto-responder trigger"""
        try:
            # Get conversation_id
            conversation = await db.fetchrow(
                """
                SELECT id FROM conversations
                WHERE telegram_account_id = $1 AND telegram_peer_id = $2
                """,
                message_data['account_id'],
                message_data['peer_id']
            )
            
            if not conversation:
                logger.warning(f"Conversation not found for logging auto-responder trigger")
                return
            
            # Get incoming message_id
            incoming_message = await db.fetchrow(
                """
                SELECT id FROM messages
                WHERE conversation_id = $1 AND telegram_message_id = $2
                ORDER BY created_at DESC
                LIMIT 1
                """,
                conversation['id'],
                message_data['message_id']
            )
            
            if not incoming_message:
                logger.warning(f"Incoming message not found for logging")
                return
            
            # Log the trigger
            await db.execute(
                """
                INSERT INTO auto_responder_logs
                (rule_id, conversation_id, incoming_message_id, matched_keyword)
                VALUES ($1, $2, $3, $4)
                """,
                rule_id,
                conversation['id'],
                incoming_message['id'],
                matched_keyword
            )
            
        except Exception as e:
            logger.error(f"Failed to log auto-responder trigger: {e}")


# Global instance
auto_responder_service = AutoResponderService()
