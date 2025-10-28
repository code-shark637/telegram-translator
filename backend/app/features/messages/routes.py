from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List
from datetime import datetime
from app.core.database import db
from app.core.security import get_current_user
from models import MessageResponse, MessageSend
from telethon_service import telethon_service
from translation_service import translation_service
from websocket_manager import manager
import logging
import os
import aiofiles


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: int,
    limit: int = 50,
    current_user = Depends(get_current_user),
):
    conversation = await db.fetchrow(
        """
        SELECT c.*, ta.user_id FROM conversations c
        JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
        WHERE c.id = $1
        """,
        conversation_id,
    )

    if not conversation or conversation['user_id'] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    messages = await db.fetch(
        """
        SELECT * FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        conversation_id,
        limit,
    )

    result = []
    for msg in messages:
        # Ensure created_at is not None - use current time if it's None
        created_at = msg['created_at'] if msg['created_at'] is not None else datetime.now()
        
        result.append({
            "id": msg['id'],
            "conversation_id": msg['conversation_id'],
            "telegram_message_id": msg['telegram_message_id'],
            "sender_user_id": msg['sender_user_id'],
            "sender_name": msg['sender_name'],
            "sender_username": msg['sender_username'],
            "type": msg['type'],
            "original_text": msg['original_text'],
            "translated_text": msg['translated_text'],
            "source_language": msg['source_language'],
            "target_language": msg['target_language'],
            "created_at": created_at,
            "edited_at": msg['edited_at'],
        })

    return result


@router.post("/send", response_model=MessageResponse)
async def send_message(
    message_data: MessageSend,
    current_user = Depends(get_current_user),
):
    conversation = await db.fetchrow(
        """
        SELECT c.*, ta.user_id, ta.target_language, ta.source_language
        FROM conversations c
        JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
        WHERE c.id = $1
        """,
        message_data.conversation_id,
    )

    if not conversation or conversation['user_id'] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    original_text = message_data.text
    translated_text = original_text

    if message_data.translate:
        translation = await translation_service.translate_text(
            original_text,
            conversation['source_language'],
            conversation['target_language'],
        )
        translated_text = translation['translated_text']

    try:
        sent_message = await telethon_service.send_message(
            conversation['telegram_account_id'],
            conversation['telegram_peer_id'],
            translated_text,
        )

        message_id = await db.fetchval(
            """
            INSERT INTO messages
            (conversation_id, telegram_message_id, sender_user_id, sender_name, sender_username, type, original_text, translated_text,
             source_language, target_language, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
            """,
            message_data.conversation_id,
            sent_message['message_id'],
            sent_message['sender_user_id'],
            sent_message['sender_name'],
            sent_message['sender_username'],
            'text',
            original_text,
            translated_text,
            conversation['target_language'],
            conversation['source_language'],
            sent_message['date'],
        )

        await db.execute(
            "UPDATE conversations SET last_message_at = $1 WHERE id = $2",
            sent_message['date'],
            message_data.conversation_id,
        )

        message_response = {
            "id": message_id,
            "conversation_id": message_data.conversation_id,
            "telegram_message_id": sent_message['message_id'],
            "sender_user_id": sent_message['sender_user_id'],
            "sender_name": sent_message['sender_name'],
            "sender_username": sent_message['sender_username'],
            "peer_title": conversation['title'],
            "type": "text",
            "original_text": original_text,
            "translated_text": translated_text,
            "source_language": conversation['target_language'],
            "target_language": conversation['source_language'],
            "created_at": sent_message['date'].isoformat() if sent_message['date'] else None,
            "edited_at": None,
            "is_outgoing": True,
        }

        await manager.send_to_account(
            {
                "type": "new_message",
                "message": message_response,
            },
            conversation['telegram_account_id'],
            current_user.user_id,
        )

        return message_response

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}",
        )


@router.post("/translate")
async def translate_message(
    text: str,
    target_language: str,
    source_language: str = "auto",
    current_user = Depends(get_current_user),
):
    translation = await translation_service.translate_text(
        text,
        target_language,
        source_language,
    )

    return translation


@router.post("/send-media")
async def send_media(
    conversation_id: int = Form(...),
    file: UploadFile = File(...),
    caption: str = Form(""),
    current_user = Depends(get_current_user),
):
    """Send a media file (photo, video, document) to a conversation"""
    conversation = await db.fetchrow(
        """
        SELECT c.*, ta.user_id, ta.target_language, ta.source_language
        FROM conversations c
        JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
        WHERE c.id = $1
        """,
        conversation_id,
    )

    if not conversation or conversation['user_id'] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    try:
        # Translate caption if provided
        original_caption = caption
        translated_caption = caption
        source_lang = None
        
        if caption:
            translation = await translation_service.translate_text(
                caption,
                conversation['source_language'],
                conversation['target_language'],
            )
            translated_caption = translation['translated_text']
            source_lang = translation['source_language']
        
        # Create uploads directory if it doesn't exist
        os.makedirs("temp/uploads", exist_ok=True)
        
        # Save uploaded file temporarily
        file_path = f"temp/uploads/{file.filename}"
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Send media via Telethon with translated caption
        sent_message = await telethon_service.send_media(
            conversation['telegram_account_id'],
            conversation['telegram_peer_id'],
            file_path,
            translated_caption
        )
        
        # Save message to database with both original and translated caption
        message_id = await db.fetchval(
            """
            INSERT INTO messages
            (conversation_id, telegram_message_id, sender_user_id, sender_name, sender_username, type,
             original_text, translated_text, source_language, target_language, created_at, is_outgoing)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
            """,
            conversation_id,
            sent_message['message_id'],
            sent_message['sender_user_id'],
            sent_message['sender_name'],
            sent_message['sender_username'],
            sent_message['type'],
            original_caption,
            translated_caption,
            source_lang,
            conversation['source_language'],
            sent_message['date'],
            True
        )
        
        await db.execute(
            "UPDATE conversations SET last_message_at = $1 WHERE id = $2",
            sent_message['date'],
            conversation_id,
        )
        
        # Clean up temp file
        os.remove(file_path)
        
        message_response = {
            "id": message_id,
            "conversation_id": conversation_id,
            "telegram_message_id": sent_message['message_id'],
            "sender_user_id": sent_message['sender_user_id'],
            "sender_name": sent_message['sender_name'],
            "sender_username": sent_message['sender_username'],
            "type": sent_message['type'],
            "original_text": original_caption,
            "translated_text": translated_caption,
            "source_language": source_lang,
            "target_language": conversation['source_language'],
            "created_at": sent_message['date'].isoformat() if sent_message['date'] else None,
            "is_outgoing": True,
        }
        
        await manager.send_to_account(
            {
                "type": "new_message",
                "message": message_response,
            },
            conversation['telegram_account_id'],
            current_user.user_id,
        )
        
        return message_response
        
    except Exception as e:
        logger.error(f"Error sending media: {e}")
        # Clean up temp file if it exists
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send media: {str(e)}",
        )


@router.get("/download-media/{conversation_id}/{message_id}")
async def download_media(
    conversation_id: int,
    message_id: int,
    telegram_message_id: int,
    current_user = Depends(get_current_user),
):
    """Download media from a message"""
    conversation = await db.fetchrow(
        """
        SELECT c.*, ta.user_id
        FROM conversations c
        JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
        WHERE c.id = $1
        """,
        conversation_id,
    )

    if not conversation or conversation['user_id'] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    try:
        # Create downloads directory if it doesn't exist
        os.makedirs("temp/downloads", exist_ok=True)
        
        download_path = f"temp/downloads/{telegram_message_id}"
        
        # Download media via Telethon
        file_path = await telethon_service.download_media(
            conversation['telegram_account_id'],
            telegram_message_id,
            conversation['telegram_peer_id'],
            download_path
        )
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Media file not found",
            )
        
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type='application/octet-stream'
        )
        
    except Exception as e:
        logger.error(f"Error downloading media: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download media: {str(e)}",
        )


