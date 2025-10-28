import asyncio
import os
import logging
from typing import Dict, Optional, List, Callable
from telethon import TelegramClient, events
from telethon.tl.types import User, Chat, Channel, Message, PeerUser, PeerChat, PeerChannel
from app.core.config import settings
from database import db
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class TelegramSession:
    def __init__(self, account_id: int, telegram_api_id: int, telegram_api_hash: str, session_filepath: str):
        self.account_id = account_id
        self.client: Optional[TelegramClient] = None
        self.telegram_api_id = telegram_api_id
        self.telegram_api_hash = telegram_api_hash
        self.is_connected = False
        self.session_filepath = session_filepath

    async def connect(self):
        try:
            session = self.session_filepath

            self.client = TelegramClient(
                session,
                self.telegram_api_id,
                self.telegram_api_hash,
                device_model="Desktop",
                system_version="Windows 10",
                app_version="1.0.0"
            )

            await self.client.connect()
            
            # Check if user is authorized
            if not await self.client.is_user_authorized():
                logger.error(f"Session {self.account_id} is not authorized. Please re-authenticate.")
                await self.client.disconnect()
                self.is_connected = False
                return False

            self.is_connected = True
            logger.info(f"Connected to Telegram Account. ID: {self.account_id}")

            return True

        except Exception as e:
            logger.error(f"Failed to connect session {self.account_id}: {e}")
            self.is_connected = False
            return False

    async def disconnect(self):
        if self.client:
            await self.client.disconnect()
            self.is_connected = False
            logger.info(f"Disconnected session: {self.account_id}")

    async def get_dialogs(self, limit: int = 50):
        if not self.client or not self.is_connected:
            return []

        try:
            dialogs = await self.client.get_dialogs(limit=limit)
            result = []

            for dialog in dialogs:
                peer_id = self._get_peer_id(dialog.entity)
                conv_type = self._get_conversation_type(dialog.entity)

                result.append({
                    "peer_id": peer_id,
                    "title": dialog.title or dialog.name,
                    "type": conv_type,
                    "unread_count": dialog.unread_count,
                    "last_message_date": dialog.date
                })

            return result
        except Exception as e:
            logger.error(f"Error fetching dialogs for {self.account_id}: {e}")
            return []

    async def get_messages(self, peer_id: int, limit: int = 50):
        if not self.client or not self.is_connected:
            return []

        try:
            messages = await self.client.get_messages(peer_id, limit=limit)
            result = []

            for msg in messages:
                if msg.text:
                    result.append({
                        "message_id": msg.id,
                        "text": msg.text,
                        "sender_id": msg.sender_id,
                        "date": msg.date,
                        "is_outgoing": msg.out
                    })

            return result
        except Exception as e:
            logger.error(f"Error fetching messages for {self.account_id}: {e}")
            return []

    async def get_unread_messages(self):
        """Get unread messages from all dialogs"""
        if not self.client or not self.is_connected:
            return []

        try:
            # Check if client is authorized
            if not await self.client.is_user_authorized():
                logger.error(f"Client not authorized for account {self.account_id}")
                self.is_connected = False
                return []

            logger.info(f"Getting unread messages for account {self.account_id}")
            dialogs = await self.client.get_dialogs()
            unread_messages = []

            for dialog in dialogs:
                if dialog.unread_count > 0:
                    try:
                        # Get recent messages from this dialog
                        messages = await self.client.get_messages(
                            dialog.entity, 
                            limit=min(dialog.unread_count, 10)  # Limit to avoid too many requests
                        )
                        
                        for msg in reversed(messages):
                            if not msg.out and msg.text:  # Only incoming text messages
                                try:
                                    # Get sender info safely
                                    sender_info = await self._get_sender_info_safe(msg.sender_id)
                                    
                                    unread_messages.append({
                                        "message_id": msg.id,
                                        "text": msg.text,
                                        "sender_id": msg.sender_id,
                                        "sender_name": sender_info.get("name"),
                                        "sender_username": sender_info.get("username"),
                                        "peer_id": self._get_peer_id(dialog.entity),
                                        "peer_title": dialog.title if dialog.title is not None else sender_info.get("name"),
                                        "date": msg.date,
                                        "is_outgoing": msg.out
                                    })

                                    await self.client.send_read_acknowledge(dialog.entity, max_id=msg.id)
                                except Exception as e:
                                    logger.error(f"Error processing message {msg.id}: {e}")
                                    continue
                    except Exception as e:
                        logger.error(f"Error getting messages from dialog {dialog.title if dialog.title is not None else sender_info.get('name')}: {e}")
                        continue
            return unread_messages
            
        except Exception as e:
            logger.error(f"Error fetching unread messages for {self.account_id}: {e}")
            # If it's an authorization error, mark as disconnected
            if "not registered" in str(e).lower() or "unauthorized" in str(e).lower():
                self.is_connected = False
            return []

    async def _get_sender_info_safe(self, sender_id):
        """Safely get sender info with proper error handling"""
        try:
            if sender_id:
                entity = await self.client.get_entity(sender_id)
                if isinstance(entity, User):
                    name_parts = []
                    if entity.first_name:
                        name_parts.append(entity.first_name)
                    if entity.last_name:
                        name_parts.append(entity.last_name)
                    
                    full_name = " ".join(name_parts) if name_parts else entity.username or "Unknown"
                    
                    return {
                        "name": full_name,
                        "username": entity.username
                    }
        except Exception as e:
            logger.error(f"Error getting sender info for {sender_id}: {e}")
        
        return {"name": "Unknown", "username": None}

    async def send_message(self, peer_id: int, text: str):
        if not self.client or not self.is_connected:
            raise Exception("Client not connected")

        try:
            message = await self.client.send_message(peer_id, text)
            
            # Get current user information
            me = await self.client.get_me()
            
            return {
                "message_id": message.id,
                "text": message.text,
                "date": message.date,
                "is_outgoing": True,
                "sender_user_id": me.id,
                "sender_name": f"{me.first_name or ''} {me.last_name or ''}".strip() or me.username or "Unknown",
                "sender_username": me.username
            }
        except Exception as e:
            logger.error(f"Error sending message for {self.account_id}: {e}")
            raise

    async def send_media(self, peer_id: int, file_path: str, caption: str = ""):
        """Send a media file (photo, video, document) to a peer"""
        if not self.client or not self.is_connected:
            raise Exception("Client not connected")

        try:
            message = await self.client.send_file(
                peer_id,
                file_path,
                caption=caption
            )
            
            # Get current user information
            me = await self.client.get_me()
            
            # Determine message type
            msg_type = "document"
            if message.photo:
                msg_type = "photo"
            elif message.video:
                msg_type = "video"
            elif message.voice:
                msg_type = "voice"
            
            return {
                "message_id": message.id,
                "text": caption,
                "date": message.date,
                "is_outgoing": True,
                "type": msg_type,
                "sender_user_id": me.id,
                "sender_name": f"{me.first_name or ''} {me.last_name or ''}".strip() or me.username or "Unknown",
                "sender_username": me.username,
                "media": message.media
            }
        except Exception as e:
            logger.error(f"Error sending media for {self.account_id}: {e}")
            raise

    async def download_media(self, message_id: int, peer_id: int, download_path: str):
        """Download media from a message"""
        if not self.client or not self.is_connected:
            raise Exception("Client not connected")

        try:
            # Get the message
            messages = await self.client.get_messages(peer_id, ids=message_id)
            if not messages or not messages.media:
                raise Exception("Message not found or has no media")
            
            message = messages
            
            # Download the media
            file_path = await self.client.download_media(message, file=download_path)
            
            return file_path
        except Exception as e:
            logger.error(f"Error downloading media for {self.account_id}: {e}")
            raise

    def _get_peer_id(self, entity) -> int:
        if isinstance(entity, User):
            return entity.id
        elif isinstance(entity, Chat):
            return -entity.id
        elif isinstance(entity, Channel):
            return -1000000000000 - entity.id
        return 0

    def _get_conversation_type(self, entity) -> str:
        if isinstance(entity, User):
            return "private"
        elif isinstance(entity, Chat):
            return "group"
        elif isinstance(entity, Channel):
            return "channel" if entity.broadcast else "supergroup"
        return "private"

    async def search_users(self, username: str, limit: int = 10):
        """Search for Telegram users by username"""
        if not self.client or not self.is_connected:
            return []

        try:
            from telethon.tl.functions.contacts import SearchRequest
            
            # Search globally using Telegram's search
            search_results = await self.client(SearchRequest(
                q=username,
                limit=limit
            ))
            
            users = []
            for user in search_results.users:
                if isinstance(user, User) and not user.bot:
                    users.append({
                        "id": user.id,
                        "username": user.username,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "phone": user.phone,
                        "is_contact": user.contact,
                    })
            
            return users[:limit]
                
        except Exception as e:
            logger.error(f"Error searching users for {self.account_id}: {e}")
            return []


class TelethonService:
    def __init__(self):
        self.sessions: Dict[int, TelegramSession] = {}
        self.message_handlers: List[Callable] = []
        self.polling_task: Optional[asyncio.Task] = None
        self.polling_interval = 10  # seconds
        os.makedirs("sessions", exist_ok=True)

    def add_message_handler(self, handler: Callable):
        self.message_handlers.append(handler)

    async def connect_session(self, account_id: int) -> bool:
        if account_id in self.sessions and self.sessions[account_id].is_connected:
            return True

        row = await db.fetchrow(
            "SELECT app_id, app_hash, user_id, account_name FROM telegram_accounts WHERE id = $1",
            account_id
        )

        if not row:
            return False

        app_id = row['app_id']
        app_hash = row['app_hash']
        user_id = row['user_id']
        account_name = row['account_name']

        session_file = f"sessions/{user_id}_{account_name}.session"
        session = TelegramSession(account_id, app_id, app_hash, session_file)
        connected = await session.connect()

        if connected:
            self.sessions[account_id] = session
            await self._setup_event_handlers(session)
            await db.execute(
                "UPDATE telegram_accounts SET last_used = NOW() WHERE id = $1",
                account_id
            )
            
            # Check for unread messages immediately after connection
            try:
                await self._check_unread_messages_on_start(account_id)
            except Exception as e:
                logger.error(f"Error checking unread messages on start for account {account_id}: {e}")
            
            # Start polling if not already running
            if not self.polling_task or self.polling_task.done():
                self.polling_task = asyncio.create_task(self._poll_unread_messages())
            
            return True
        return False

    async def disconnect_session(self, account_id: int):
        if account_id in self.sessions:
            await self.sessions[account_id].disconnect()
            del self.sessions[account_id]

    async def get_session(self, account_id: int) -> Optional[TelegramSession]:
        return self.sessions.get(account_id)

    async def get_dialogs(self, account_id: int, limit: int = 50):
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.get_dialogs(limit)

    async def get_messages(self, account_id: int, peer_id: int, limit: int = 50):
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.get_messages(peer_id, limit)

    async def send_message(self, account_id: int, peer_id: int, text: str):
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.send_message(peer_id, text)

    async def get_unread_messages(self, account_id: int):
        """Get unread messages for a specific account"""
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.get_unread_messages()

    async def search_users(self, account_id: int, username: str, limit: int = 10):
        """Search for Telegram users by username"""
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.search_users(username, limit)

    async def send_media(self, account_id: int, peer_id: int, file_path: str, caption: str = ""):
        """Send media file to a peer"""
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.send_media(peer_id, file_path, caption)

    async def download_media(self, account_id: int, message_id: int, peer_id: int, download_path: str):
        """Download media from a message"""
        session = self.sessions.get(account_id)
        if not session:
            raise Exception("Session not connected")

        return await session.download_media(message_id, peer_id, download_path)

    async def _setup_event_handlers(self, session: TelegramSession):
        @session.client.on(events.NewMessage)
        async def handle_new_message(event):
            try:
                message = event.message
                peer_id = session._get_peer_id(await event.get_chat())
                
                # Get sender information safely
                sender_info = await session._get_sender_info_safe(message.sender_id)
                
                # Get peer title
                try:
                    chat = await event.get_chat()
                    peer_title = getattr(chat, 'title', None) or sender_info["name"]
                except:
                    peer_title = sender_info["name"]

                # Determine message type
                msg_type = "text"
                has_media = False
                if message.photo:
                    msg_type = "photo"
                    has_media = True
                elif message.video:
                    msg_type = "video"
                    has_media = True
                elif message.voice:
                    msg_type = "voice"
                    has_media = True
                elif message.document:
                    msg_type = "document"
                    has_media = True

                message_data = {
                    "account_id": session.account_id,
                    "peer_id": peer_id,
                    "message_id": message.id,
                    "text": message.text or message.message or "",
                    "sender_id": message.sender_id,
                    "sender_name": sender_info["name"],
                    "sender_username": sender_info["username"],
                    "peer_title": peer_title,
                    "date": message.date,
                    "is_outgoing": message.out,
                    "type": msg_type,
                    "has_media": has_media
                }
                print("message_data", message_data)

                # Mark message as read (only for incoming messages)
                if not message.out:
                    try:
                        await session.client.send_read_acknowledge(await event.get_chat(), max_id=message.id)
                        logger.debug(f"Marked message {message.id} as read")
                    except Exception as e:
                        logger.error(f"Error marking message {message.id} as read: {e}")

                for handler in self.message_handlers:
                    await handler(message_data)

            except Exception as e:
                logger.error(f"Error handling new message: {e}")

    async def _check_unread_messages_on_start(self, account_id: int):
        """Check for unread messages immediately when session starts"""
        try:
            logger.info(f"Checking unread messages for account {account_id} on start")
            unread_messages = await self.get_unread_messages(account_id)
            logger.info(f"Found {len(unread_messages)} unread messages for account {account_id}")
            
            if unread_messages:
                
                # Process each unread message
                for msg_data in unread_messages:
                    try:
                        # Create message data for handlers
                        message_data = {
                            "account_id": account_id,
                            "peer_id": msg_data["peer_id"],
                            "message_id": msg_data["message_id"],
                            "text": msg_data["text"],
                            "sender_id": msg_data["sender_id"],
                            "sender_name": msg_data["sender_name"],
                            "sender_username": msg_data["sender_username"],
                            "peer_title": msg_data["peer_title"],
                            "date": msg_data["date"],
                            "is_outgoing": msg_data["is_outgoing"]
                        }
                        
                        # Call all registered handlers
                        for handler in self.message_handlers:
                            try:
                                await handler(message_data)
                            except Exception as e:
                                logger.error(f"Error in message handler for unread message: {e}")
                                
                    except Exception as e:
                        logger.error(f"Error processing unread message {msg_data.get('message_id', 'unknown')}: {e}")
                        continue
            else:
                logger.info(f"No unread messages found for account {account_id}")
                
        except Exception as e:
            logger.error(f"Error checking unread messages on start for account {account_id}: {e}")

    async def _poll_unread_messages(self):
        """Background task to poll for unread messages"""
        logger.info("Starting unread message polling task")
        
        # while True:
        #     try:
        #         await asyncio.sleep(self.polling_interval)
                
        #         for account_id, session in list(self.sessions.items()):
        #             if session.is_connected:
        #                 try:
        #                     unread_messages = await session.get_unread_messages()
        #                     print("unread_messages", unread_messages)
        #                     for msg_data in unread_messages:
        #                         # Create message data for handlers
        #                         message_data = {
        #                             "account_id": account_id,
        #                             "peer_id": msg_data["peer_id"],
        #                             "message_id": msg_data["message_id"],
        #                             "text": msg_data["text"],
        #                             "sender_id": msg_data["sender_id"],
        #                             "sender_name": msg_data["sender_name"],
        #                             "sender_username": msg_data["sender_username"],
        #                             "peer_title": msg_data["peer_title"],
        #                             "date": msg_data["date"],
        #                             "is_outgoing": msg_data["is_outgoing"]
        #                         }
                                
        #                         # Call all registered handlers
        #                         for handler in self.message_handlers:
        #                             try:
        #                                 await handler(message_data)
        #                             except Exception as e:
        #                                 logger.error(f"Error in message handler: {e}")
                            
        #                 except Exception as e:
        #                     logger.error(f"Error polling unread messages for account {account_id}: {e}")
        #                     # If session is no longer connected due to auth error, remove it
        #                     if not session.is_connected:
        #                         logger.info(f"Removing disconnected session {account_id}")
        #                         del self.sessions[account_id]
                            
        #     except Exception as e:
        #         logger.error(f"Error in polling task: {e}")
        #         await asyncio.sleep(self.polling_interval)

    async def disconnect_all(self):
        # Stop polling task
        if self.polling_task and not self.polling_task.done():
            self.polling_task.cancel()
            try:
                await self.polling_task
            except asyncio.CancelledError:
                pass
        
        for account_id in list(self.sessions.keys()):
            await self.disconnect_session(account_id)

telethon_service = TelethonService()
