from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import logging
from app.core.config import settings
from database import db
from telethon_service import telethon_service
from websocket_manager import manager
from translation_service import translation_service
from scheduler_service import scheduler_service
from app.features.auth.routes import router as auth_router
from app.features.telegram.routes import router as telegram_router
from app.features.messages.routes import router as messages_router
from app.features.translation.routes import router as translation_router
from app.features.templates.routes import router as templates_router
from app.features.scheduled.routes import router as scheduled_router
from app.features.contacts.routes import router as contacts_router
from auth import get_current_user
from jose import jwt, JWTError

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application...")

    await db.connect()
    logger.info("Database connected")

    async def handle_new_message(message_data: dict):
        try:
            account_id = message_data['account_id']
            peer_id = message_data['peer_id']

            account = await db.fetchrow(
                "SELECT user_id, target_language, source_language FROM telegram_accounts WHERE id = $1",
                account_id
            )

            if not account:
                return

            conversation = await db.fetchrow(
                "SELECT id FROM conversations WHERE telegram_account_id = $1 AND telegram_peer_id = $2",
                account_id,
                peer_id
            )

            if not conversation:
                conversation_id = await db.fetchval(
                    """
                    INSERT INTO conversations (telegram_account_id, telegram_peer_id, title, type)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                    """,
                    account_id,
                    peer_id,
                    message_data.get('peer_title', 'Unknown'),
                    message_data.get('type', 'private')
                )
            else:
                conversation_id = conversation['id']

            if message_data.get('text'):
                translation = await translation_service.translate_text(
                    message_data['text'],
                    account['target_language'],
                    account['source_language']
                )

                # Ensure we have a valid datetime for created_at
                created_at = message_data['date'] if message_data['date'] is not None else datetime.now()
                
                message_id = await db.fetchval(
                    """
                    INSERT INTO messages
                    (conversation_id, telegram_message_id, sender_user_id, sender_name, sender_username, type,
                     original_text, translated_text, source_language, target_language, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id
                    """,
                    conversation_id,
                    message_data['message_id'],
                    message_data.get('sender_id'),
                    message_data.get('sender_name'),
                    message_data.get('sender_username'),
                    'text',
                    message_data['text'],
                    translation['translated_text'],
                    translation['source_language'],
                    account['target_language'],
                    created_at
                )

                await db.execute(
                    "UPDATE conversations SET last_message_at = $1 WHERE id = $2",
                    created_at,
                    conversation_id
                )
                
                # Cancel scheduled messages if this is an incoming message
                if not message_data.get('is_outgoing', False):
                    await scheduler_service.cancel_scheduled_messages_for_conversation(conversation_id)

                await manager.send_to_account(
                    {
                        "type": "new_message",
                        "message": {
                            "id": message_id,
                            "conversation_id": conversation_id,
                            "telegram_message_id": message_data['message_id'],
                            "sender_user_id": message_data.get('sender_id'),
                            "sender_name": message_data.get('sender_name'),
                            "sender_username": message_data.get('sender_username'),
                            "peer_title": message_data.get('peer_title'),
                            "type": "text",
                            "original_text": message_data['text'],
                            "translated_text": translation['translated_text'],
                            "source_language": translation['source_language'],
                            "target_language": account['target_language'],
                            "created_at": created_at.isoformat() if created_at else None,
                            "is_outgoing": message_data.get('is_outgoing', False)
                        }
                    },
                    account_id,
                    account['user_id']
                )

        except Exception as e:
            logger.error(f"Error handling new message: {e}")

    telethon_service.add_message_handler(handle_new_message)
    
    # Start scheduler service
    await scheduler_service.start()

    logger.info("Application startup complete")

    yield

    logger.info("Shutting down application...")
    await scheduler_service.stop()
    await telethon_service.disconnect_all()
    await db.disconnect()
    logger.info("Application shutdown complete")

app = FastAPI(
    title="Telegram Translator API",
    description="FastAPI backend for Telegram multi-account translator with Telethon",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(telegram_router)
app.include_router(translation_router)
app.include_router(messages_router)
app.include_router(templates_router)
app.include_router(scheduled_router)
app.include_router(contacts_router, prefix="/api/contacts", tags=["contacts"])

@app.get("/")
async def root():
    return {
        "message": "Telegram Translator API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected" if db.pool else "disconnected"
    }

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("user_id")

        if not user_id:
            await websocket.close(code=1008)
            return

        await manager.connect(websocket, user_id)

        try:
            while True:
                data = await websocket.receive_json()

                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

        except WebSocketDisconnect:
            manager.disconnect(websocket, user_id)

    except JWTError:
        await websocket.close(code=1008)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
