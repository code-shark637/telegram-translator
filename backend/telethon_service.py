import asyncio
import os
import logging
from typing import Dict, Optional, List, Callable
from telethon import TelegramClient, events
from telethon.tl.types import User, Chat, Channel, Message, PeerUser, PeerChat, PeerChannel
from telethon.sessions import StringSession
from config import settings
from database import db
import json

logger = logging.getLogger(__name__)

class TelegramSession:
    def __init__(self, session_name: str, account_id: int):
        self.session_name = session_name
        self.account_id = account_id
        self.client: Optional[TelegramClient] = None
        self.is_connected = False
        self.session_string = None
        self.phone_number = None

    async def connect(self, session_string: Optional[str] = None, phone_number: Optional[str] = None):
        try:
            if session_string:
                self.session_string = session_string
                session = StringSession(session_string)
            else:
                session_file = f"sessions/{self.session_name}.session"
                session = session_file

            self.client = TelegramClient(
                session,
                settings.telegram_api_id,
                settings.telegram_api_hash,
                device_model="Desktop",
                system_version="Windows 10",
                app_version="1.0.0"
            )

            await self.client.connect()

            if not await self.client.is_user_authorized():
                if phone_number:
                    self.phone_number = phone_number
                    logger.warning(f"Session {self.session_name} not authorized. Phone: {phone_number}")
                    return False
                else:
                    logger.error(f"Session {self.session_name} not authorized and no phone provided")
                    return False

            self.is_connected = True
            me = await self.client.get_me()
            logger.info(f"Connected to Telegram: {me.first_name} ({me.phone})")

            return True

        except Exception as e:
            logger.error(f"Failed to connect session {self.session_name}: {e}")
            self.is_connected = False
            return False

    async def disconnect(self):
        if self.client:
            await self.client.disconnect()
            self.is_connected = False
            logger.info(f"Disconnected session: {self.session_name}")

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
            logger.error(f"Error fetching dialogs for {self.session_name}: {e}")
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
            logger.error(f"Error fetching messages for {self.session_name}: {e}")
            return []

    async def send_message(self, peer_id: int, text: str):
        if not self.client or not self.is_connected:
            raise Exception("Client not connected")

        try:
            message = await self.client.send_message(peer_id, text)
            return {
                "message_id": message.id,
                "text": message.text,
                "date": message.date,
                "is_outgoing": True
            }
        except Exception as e:
            logger.error(f"Error sending message for {self.session_name}: {e}")
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


class TelethonService:
    def __init__(self):
        self.sessions: Dict[int, TelegramSession] = {}
        self.message_handlers: List[Callable] = []
        os.makedirs("sessions", exist_ok=True)

    def add_message_handler(self, handler: Callable):
        self.message_handlers.append(handler)

    async def create_session_from_string(
        self,
        session_name: str,
        account_id: int,
        session_string: str,
        phone_number: Optional[str] = None
    ) -> bool:
        session = TelegramSession(session_name, account_id)
        connected = await session.connect(session_string, phone_number)

        if connected:
            self.sessions[account_id] = session
            await self._setup_event_handlers(session)
            return True
        return False

    async def create_session_from_tdata(
        self,
        session_name: str,
        account_id: int,
        tdata_path: str,
        phone_number: Optional[str] = None
    ) -> bool:
        session = TelegramSession(session_name, account_id)
        connected = await session.connect(phone_number=phone_number)

        if connected:
            self.sessions[account_id] = session
            await self._setup_event_handlers(session)
            return True
        return False

    async def connect_session(self, account_id: int, session_string: Optional[str] = None) -> bool:
        if account_id in self.sessions and self.sessions[account_id].is_connected:
            return True

        row = await db.fetchrow(
            "SELECT session_name, phone_number FROM telegram_accounts WHERE id = $1",
            account_id
        )

        if not row:
            return False

        session_name = row['session_name']
        phone_number = row['phone_number']

        session = TelegramSession(session_name, account_id)
        connected = await session.connect(session_string, phone_number)

        if connected:
            self.sessions[account_id] = session
            await self._setup_event_handlers(session)
            await db.execute(
                "UPDATE telegram_accounts SET last_used = NOW() WHERE id = $1",
                account_id
            )
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

    async def _setup_event_handlers(self, session: TelegramSession):
        @session.client.on(events.NewMessage)
        async def handle_new_message(event):
            try:
                message = event.message
                peer_id = session._get_peer_id(await event.get_chat())

                message_data = {
                    "account_id": session.account_id,
                    "peer_id": peer_id,
                    "message_id": message.id,
                    "text": message.text,
                    "sender_id": message.sender_id,
                    "date": message.date,
                    "is_outgoing": message.out
                }

                for handler in self.message_handlers:
                    await handler(message_data)

            except Exception as e:
                logger.error(f"Error handling new message: {e}")

    async def disconnect_all(self):
        for account_id in list(self.sessions.keys()):
            await self.disconnect_session(account_id)

telethon_service = TelethonService()
