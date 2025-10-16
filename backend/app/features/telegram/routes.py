from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from typing import List
from app.core.database import db
from app.core.security import get_current_user
from models import (
    TelegramAccountCreate,
    TelegramAccountResponse,
    TelegramAccountUpdate,
    ConversationResponse,
    MessageResponse,
    MessageSend,
)
from telethon_service import telethon_service
from translation_service import translation_service
from websocket_manager import manager
import logging
import os, json
import shutil
import zipfile
import io


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.get("/accounts", response_model=List[TelegramAccountResponse])
async def get_accounts(current_user = Depends(get_current_user)):
    accounts = await db.fetch(
        """
        SELECT id, account_name, display_name, is_active,
               source_language, target_language, created_at, last_used
        FROM telegram_accounts
        WHERE user_id = $1 AND is_active = true
        ORDER BY last_used DESC NULLS LAST, created_at DESC
        """,
        current_user.user_id,
    )

    result = []
    for account in accounts:
        session = await telethon_service.get_session(account['id'])
        is_connected = session.is_connected if session else False

        result.append({
            "id": account['id'],
            "account_name": account['account_name'],
            "display_name": account['display_name'],
            "is_active": account['is_active'],
            "source_language": account['source_language'],
            "target_language": account['target_language'],
            "created_at": account['created_at'],
            "last_used": account['last_used'],
            "is_connected": is_connected,
        })

    return result


@router.post("/accounts", response_model=TelegramAccountResponse)
async def create_account(
    displayName: str = Form(...),
    sourceLanguage: str = Form("auto"),
    targetLanguage: str = Form("en"),
    tdata: UploadFile = File(None),
    current_user = Depends(get_current_user),
):
    if tdata:
        temp_path = f"temp"
        # Read the file content into memory to avoid SpooledTemporaryFile issues
        file_content = await tdata.read()
        with zipfile.ZipFile(io.BytesIO(file_content), 'r') as zip_ref:
            os.makedirs(f"{temp_path}", exist_ok=True)
            zip_ref.extractall(f"{temp_path}")
            tg_account_id = zip_ref.namelist()[0].split('/')[0]
        app_data = json.load(open(f"{temp_path}/{tg_account_id}/{tg_account_id}.json"))
        account_name = app_data['username']
        app_id = app_data['app_id']
        app_hash = app_data['app_hash']
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TData file (Zip format) is required",
        )

    existing = await db.fetchrow(
        "SELECT id FROM telegram_accounts WHERE user_id = $1 AND account_name = $2",
        current_user.user_id,
        account_name,
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account name already exists",
        )

    account_id = await db.fetchval(
        """
        INSERT INTO telegram_accounts
        (user_id, display_name, account_name, source_language, target_language, app_id, app_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """,
        current_user.user_id,
        displayName,
        account_name,
        sourceLanguage,
        targetLanguage,
        app_id,
        app_hash,
    )

    if tdata:
        tdata_path = f"sessions"
        os.makedirs(f"{tdata_path}", exist_ok=True)

        session_location = f"{tdata_path}/{current_user.user_id}_{account_name}.session"
        shutil.move(f"{temp_path}/{tg_account_id}/{tg_account_id}.session", session_location)
        tdata.file.close()

    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND is_active = true",
        account_id,
    )

    logger.info(f"New Telegram account created: {account_name} for user {current_user.user_id}")

    return {
        "id": account['id'],
        "account_name": account['account_name'],
        "display_name": account['display_name'],
        "is_active": account['is_active'],
        "source_language": account['source_language'],
        "target_language": account['target_language'],
        "created_at": account['created_at'],
        "last_used": account['last_used'],
        "is_connected": False,
    }


@router.post("/accounts/{account_id}/connect")
async def connect_account(
    account_id: int,
    current_user = Depends(get_current_user),
):
    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND user_id = $2",
        account_id,
        current_user.user_id,
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    connected = await telethon_service.connect_session(account_id)

    if not connected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect to Telegram",
        )

    return {"message": "Connected successfully", "connected": True}


@router.post("/accounts/{account_id}/disconnect")
async def disconnect_account(
    account_id: int,
    current_user = Depends(get_current_user),
):
    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND user_id = $2",
        account_id,
        current_user.user_id,
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    await telethon_service.disconnect_session(account_id)

    return {"message": "Disconnected successfully", "connected": False}


@router.patch("/accounts/{account_id}", response_model=TelegramAccountResponse)
async def update_account(
    account_id: int,
    update_data: TelegramAccountUpdate,
    current_user = Depends(get_current_user),
):
    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND user_id = $2",
        account_id,
        current_user.user_id,
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    update_fields = []
    values = []
    param_count = 1

    if update_data.account_name is not None:
        update_fields.append(f"account_name = ${param_count}")
        values.append(update_data.account_name)
        param_count += 1

    if update_data.display_name is not None:
        update_fields.append(f"display_name = ${param_count}")
        values.append(update_data.display_name)
        param_count += 1

    if update_data.source_language is not None:
        update_fields.append(f"source_language = ${param_count}")
        values.append(update_data.source_language)
        param_count += 1

    if update_data.target_language is not None:
        update_fields.append(f"target_language = ${param_count}")
        values.append(update_data.target_language)
        param_count += 1

    if update_data.is_active is not None:
        update_fields.append(f"is_active = ${param_count}")
        values.append(update_data.is_active)
        param_count += 1

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    query = f"""
        UPDATE telegram_accounts
        SET {", ".join(update_fields)}
        WHERE id = {account_id}
        RETURNING *
    """

    updated_account = await db.fetchrow(query, *values)

    session = await telethon_service.get_session(account_id)
    is_connected = session.is_connected if session else False

    return {
        "id": updated_account['id'],
        "account_name": updated_account['account_name'],
        "display_name": updated_account['display_name'],
        "is_active": updated_account['is_active'],
        "source_language": updated_account['source_language'],
        "target_language": updated_account['target_language'],
        "created_at": updated_account['created_at'],
        "last_used": updated_account['last_used'],
        "is_connected": is_connected,
    }


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: int,
    current_user = Depends(get_current_user),
):
    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND user_id = $2",
        account_id,
        current_user.user_id,
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    await telethon_service.disconnect_session(account_id)

    await db.execute(
        "DELETE FROM telegram_accounts WHERE id = $1 AND user_id = $2",
        account_id,
        current_user.user_id,
    )

    logger.info(f"Telegram account deleted: {account['account_name']} for user {current_user.user_id}")

    return {"message": "Account deleted successfully"}


@router.get("/accounts/{account_id}/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    account_id: int,
    current_user = Depends(get_current_user),
):
    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND user_id = $2",
        account_id,
        current_user.user_id,
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    # Fetch conversations directly from database
    conversations = await db.fetch(
        """
        SELECT c.*, 
               COUNT(m.id) as message_count,
               MAX(m.created_at) as last_message_at
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.telegram_account_id = $1
        GROUP BY c.id, c.telegram_account_id, c.telegram_peer_id, c.title, c.type, c.is_archived, c.created_at
        ORDER BY c.created_at DESC
        """,
        account_id,
    )

    result = []
    for conv in conversations:
        result.append({
            "id": conv['id'],
            "telegram_account_id": conv['telegram_account_id'],
            "telegram_peer_id": conv['telegram_peer_id'],
            "title": conv['title'],
            "type": conv['type'],
            "is_archived": conv['is_archived'],
            "created_at": conv['created_at'],
            "last_message_at": conv['last_message_at'],
            "unread_count": 0,  # Messages are automatically marked as read when received
        })

    return result



