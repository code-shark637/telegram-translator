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
import os
import shutil


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.get("/accounts", response_model=List[TelegramAccountResponse])
async def get_accounts(current_user = Depends(get_current_user)):
    accounts = await db.fetch(
        """
        SELECT id, session_name, account_name, phone_number, is_active,
               source_language, target_language, created_at, last_used
        FROM telegram_accounts
        WHERE user_id = $1
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
            "session_name": account['session_name'],
            "account_name": account['account_name'],
            "phone_number": account['phone_number'],
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
    session_name: str = Form(...),
    account_name: str = Form(...),
    phone_number: str = Form(None),
    source_language: str = Form("auto"),
    target_language: str = Form("en"),
    tdata_file: UploadFile = File(None),
    session_string: str = Form(None),
    current_user = Depends(get_current_user),
):
    existing = await db.fetchrow(
        "SELECT id FROM telegram_accounts WHERE user_id = $1 AND session_name = $2",
        current_user.user_id,
        session_name,
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session name already exists",
        )

    account_id = await db.fetchval(
        """
        INSERT INTO telegram_accounts
        (user_id, session_name, account_name, phone_number, source_language, target_language)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        current_user.user_id,
        session_name,
        account_name,
        phone_number,
        source_language,
        target_language,
    )

    if tdata_file:
        tdata_path = f"tdata/{account_id}"
        os.makedirs(tdata_path, exist_ok=True)

        file_location = f"{tdata_path}/{tdata_file.filename}"
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(tdata_file.file, buffer)

        connected = await telethon_service.create_session_from_tdata(
            session_name,
            account_id,
            tdata_path,
            phone_number,
        )
    elif session_string:
        connected = await telethon_service.create_session_from_string(
            session_name,
            account_id,
            session_string,
            phone_number,
        )
    else:
        connected = False

    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1",
        account_id,
    )

    logger.info(f"New Telegram account created: {session_name} for user {current_user.user_id}")

    return {
        "id": account['id'],
        "session_name": account['session_name'],
        "account_name": account['account_name'],
        "phone_number": account['phone_number'],
        "is_active": account['is_active'],
        "source_language": account['source_language'],
        "target_language": account['target_language'],
        "created_at": account['created_at'],
        "last_used": account['last_used'],
        "is_connected": connected,
    }


@router.post("/accounts/{account_id}/connect")
async def connect_account(
    account_id: int,
    session_string: str = Form(None),
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

    connected = await telethon_service.connect_session(account_id, session_string)

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

    values.extend([account_id, current_user.user_id])

    query = f"""
        UPDATE telegram_accounts
        SET {", ".join(update_fields)}
        WHERE id = ${param_count} AND user_id = ${param_count + 1}
        RETURNING *
    """

    updated_account = await db.fetchrow(query, *values)

    session = await telethon_service.get_session(account_id)
    is_connected = session.is_connected if session else False

    return {
        "id": updated_account['id'],
        "session_name": updated_account['session_name'],
        "account_name": updated_account['account_name'],
        "phone_number": updated_account['phone_number'],
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

    logger.info(f"Telegram account deleted: {account['session_name']} for user {current_user.user_id}")

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

    dialogs = await telethon_service.get_dialogs(account_id)

    result = []
    for dialog in dialogs:
        conv = await db.fetchrow(
            """
            SELECT * FROM conversations
            WHERE telegram_account_id = $1 AND telegram_peer_id = $2
            """,
            account_id,
            dialog['peer_id'],
        )

        if not conv:
            conv_id = await db.fetchval(
                """
                INSERT INTO conversations
                (telegram_account_id, telegram_peer_id, title, type, last_message_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                """,
                account_id,
                dialog['peer_id'],
                dialog['title'],
                dialog['type'],
                dialog.get('last_message_date'),
            )
        else:
            conv_id = conv['id']
            await db.execute(
                "UPDATE conversations SET last_message_at = $1 WHERE id = $2",
                dialog.get('last_message_date'),
                conv_id,
            )

        result.append({
            "id": conv_id,
            "telegram_account_id": account_id,
            "telegram_peer_id": dialog['peer_id'],
            "title": dialog['title'],
            "type": dialog['type'],
            "is_archived": False,
            "created_at": conv['created_at'] if conv else None,
            "last_message_at": dialog.get('last_message_date'),
            "unread_count": dialog.get('unread_count', 0),
        })

    return result



