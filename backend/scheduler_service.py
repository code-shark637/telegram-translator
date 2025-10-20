import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime
from database import db
from telethon_service import telethon_service
from translation_service import translation_service
from websocket_manager import manager

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.scheduled_messages: Dict[int, dict] = {}  # message_id -> message_data
        self.scheduler_task: Optional[asyncio.Task] = None
        self.check_interval = 30  # Check every 30 seconds
        
    async def start(self):
        """Start the scheduler service"""
        logger.info("Starting scheduler service...")
        await self.load_scheduled_messages()
        
        if not self.scheduler_task or self.scheduler_task.done():
            self.scheduler_task = asyncio.create_task(self._run_scheduler())
            logger.info("Scheduler service started")
    
    async def stop(self):
        """Stop the scheduler service"""
        if self.scheduler_task and not self.scheduler_task.done():
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
            logger.info("Scheduler service stopped")
    
    async def load_scheduled_messages(self):
        """Load all pending scheduled messages from database"""
        try:
            rows = await db.fetch(
                """
                SELECT sm.*, c.telegram_account_id, c.telegram_peer_id
                FROM scheduled_messages sm
                JOIN conversations c ON sm.conversation_id = c.id
                WHERE sm.is_sent = FALSE AND sm.is_cancelled = FALSE
                ORDER BY sm.scheduled_at ASC
                """
            )
            
            self.scheduled_messages = {}
            for row in rows:
                self.scheduled_messages[row['id']] = dict(row)
            
            logger.info(f"Loaded {len(self.scheduled_messages)} scheduled messages")
        except Exception as e:
            logger.error(f"Failed to load scheduled messages: {e}")
    
    async def add_scheduled_message(self, message_id: int):
        """Add a new scheduled message to the scheduler"""
        try:
            row = await db.fetchrow(
                """
                SELECT sm.*, c.telegram_account_id, c.telegram_peer_id
                FROM scheduled_messages sm
                JOIN conversations c ON sm.conversation_id = c.id
                WHERE sm.id = $1
                """,
                message_id
            )
            
            if row:
                self.scheduled_messages[message_id] = dict(row)
                logger.info(f"Added scheduled message {message_id} to scheduler")
        except Exception as e:
            logger.error(f"Failed to add scheduled message {message_id}: {e}")
    
    async def remove_scheduled_message(self, message_id: int):
        """Remove a scheduled message from the scheduler"""
        if message_id in self.scheduled_messages:
            del self.scheduled_messages[message_id]
            logger.info(f"Removed scheduled message {message_id} from scheduler")
    
    async def cancel_scheduled_messages_for_conversation(self, conversation_id: int):
        """Cancel all scheduled messages for a conversation (when opposite party responds)"""
        try:
            # Update database
            await db.execute(
                """
                UPDATE scheduled_messages
                SET is_cancelled = TRUE, cancelled_at = NOW()
                WHERE conversation_id = $1 AND is_sent = FALSE AND is_cancelled = FALSE
                """,
                conversation_id
            )
            
            # Remove from memory
            to_remove = [
                msg_id for msg_id, msg_data in self.scheduled_messages.items()
                if msg_data['conversation_id'] == conversation_id
            ]
            
            for msg_id in to_remove:
                del self.scheduled_messages[msg_id]
            
            logger.info(f"Cancelled {len(to_remove)} scheduled messages for conversation {conversation_id}")
            
            # Notify frontend via WebSocket
            if to_remove:
                conversation = await db.fetchrow(
                    """
                    SELECT c.id, ta.user_id, ta.id as account_id
                    FROM conversations c
                    JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
                    WHERE c.id = $1
                    """,
                    conversation_id
                )
                
                if conversation:
                    await manager.send_to_account(
                        {
                            "type": "scheduled_messages_cancelled",
                            "conversation_id": conversation_id,
                            "cancelled_ids": to_remove
                        },
                        conversation['account_id'],
                        conversation['user_id']
                    )
        except Exception as e:
            logger.error(f"Failed to cancel scheduled messages for conversation {conversation_id}: {e}")
    
    async def _run_scheduler(self):
        """Main scheduler loop"""
        logger.info("Scheduler loop started")
        
        while True:
            try:
                await asyncio.sleep(self.check_interval)
                
                now = datetime.now()
                messages_to_send = []
                
                # Find messages that should be sent
                for msg_id, msg_data in list(self.scheduled_messages.items()):
                    if msg_data['scheduled_at'] <= now:
                        messages_to_send.append((msg_id, msg_data))
                
                # Send messages
                for msg_id, msg_data in messages_to_send:
                    try:
                        await self._send_scheduled_message(msg_id, msg_data)
                    except Exception as e:
                        logger.error(f"Failed to send scheduled message {msg_id}: {e}")
                
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(self.check_interval)
    
    async def _send_scheduled_message(self, message_id: int, message_data: dict):
        """Send a scheduled message"""
        try:
            account_id = message_data['telegram_account_id']
            peer_id = message_data['telegram_peer_id']
            conversation_id = message_data['conversation_id']
            message_text = message_data['message_text']
            
            # Get account info for translation
            account = await db.fetchrow(
                "SELECT user_id, target_language, source_language FROM telegram_accounts WHERE id = $1",
                account_id
            )
            
            if not account:
                logger.error(f"Account {account_id} not found for scheduled message {message_id}")
                return
            
            # Translate message
            translation = await translation_service.translate_text(
                message_text,
                account['source_language'],  # Translate TO source language (for sending)
                account['target_language']   # FROM target language (user's input)
            )
            
            # Send message via Telethon
            sent_message = await telethon_service.send_message(
                account_id,
                peer_id,
                translation['translated_text']
            )
            
            # Save to database
            created_at = sent_message.get('date', datetime.now())
            
            msg_id = await db.fetchval(
                """
                INSERT INTO messages
                (conversation_id, telegram_message_id, sender_user_id, sender_name, sender_username, type,
                 original_text, translated_text, source_language, target_language, created_at, is_outgoing)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
                """,
                conversation_id,
                sent_message.get('message_id'),
                sent_message.get('sender_user_id'),
                sent_message.get('sender_name'),
                sent_message.get('sender_username'),
                'text',
                message_text,
                translation['translated_text'],
                account['target_language'],
                account['source_language'],
                created_at,
                True
            )
            
            # Update conversation
            await db.execute(
                "UPDATE conversations SET last_message_at = $1 WHERE id = $2",
                created_at,
                conversation_id
            )
            
            # Mark scheduled message as sent
            await db.execute(
                """
                UPDATE scheduled_messages
                SET is_sent = TRUE, sent_at = NOW()
                WHERE id = $1
                """,
                message_id
            )
            
            # Remove from scheduler
            del self.scheduled_messages[message_id]
            
            # Notify frontend via WebSocket
            await manager.send_to_account(
                {
                    "type": "new_message",
                    "message": {
                        "id": msg_id,
                        "conversation_id": conversation_id,
                        "telegram_message_id": sent_message.get('message_id'),
                        "sender_user_id": sent_message.get('sender_user_id'),
                        "sender_name": sent_message.get('sender_name'),
                        "sender_username": sent_message.get('sender_username'),
                        "type": "text",
                        "original_text": message_text,
                        "translated_text": translation['translated_text'],
                        "source_language": account['target_language'],
                        "target_language": account['source_language'],
                        "created_at": created_at.isoformat() if created_at else None,
                        "is_outgoing": True
                    }
                },
                account_id,
                account['user_id']
            )
            
            await manager.send_to_account(
                {
                    "type": "scheduled_message_sent",
                    "scheduled_message_id": message_id,
                    "message_id": msg_id
                },
                account_id,
                account['user_id']
            )
            
            logger.info(f"Successfully sent scheduled message {message_id}")
            
        except Exception as e:
            logger.error(f"Failed to send scheduled message {message_id}: {e}")
            # Mark as failed but don't delete - admin can review
            await db.execute(
                """
                UPDATE scheduled_messages
                SET is_cancelled = TRUE, cancelled_at = NOW()
                WHERE id = $1
                """,
                message_id
            )
            if message_id in self.scheduled_messages:
                del self.scheduled_messages[message_id]

scheduler_service = SchedulerService()
