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
    UserSearchResult,
    ConversationCreate,
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
    if not tdata:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TData file (Zip format) is required",
        )

    # Create temporary extraction directory with timestamp to avoid conflicts
    import time
    temp_id = f"{current_user.user_id}_{int(time.time())}"
    temp_path = f"temp/TData/{temp_id}"
    
    try:
        # Read the file content into memory to avoid SpooledTemporaryFile issues
        file_content = await tdata.read()
        with zipfile.ZipFile(io.BytesIO(file_content), 'r') as zip_ref:
            os.makedirs(temp_path, exist_ok=True)
            zip_ref.extractall(temp_path)
            tg_account_id = zip_ref.namelist()[0].split('/')[0]
        
        app_data = json.load(open(f"{temp_path}/{tg_account_id}/{tg_account_id}.json"))
        account_name = app_data['username']
        app_id = app_data['app_id']
        app_hash = app_data['app_hash']
    except Exception as e:
        # Clean up temp directory on error
        if os.path.exists(temp_path):
            shutil.rmtree(temp_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid TData file: {str(e)}",
        )

    # Check for existing account (only active accounts)
    existing = await db.fetchrow(
        "SELECT id, is_active FROM telegram_accounts WHERE user_id = $1 AND account_name = $2",
        current_user.user_id,
        account_name,
    )

    if existing and existing['is_active']:
        # Clean up temp directory
        if os.path.exists(temp_path):
            shutil.rmtree(temp_path)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account name already exists",
        )

    # If account exists but is inactive, reactivate it
    try:
        if existing and not existing['is_active']:
            account_id = existing['id']
            await db.execute(
                """
                UPDATE telegram_accounts 
                SET is_active = true, 
                    display_name = $1, 
                    source_language = $2, 
                    target_language = $3,
                    app_id = $4,
                    app_hash = $5,
                    last_used = NULL
                WHERE id = $6
                """,
                displayName,
                sourceLanguage,
                targetLanguage,
                app_id,
                app_hash,
                account_id,
            )
            logger.info(f"Reactivated telegram account: {account_name} for user {current_user.user_id}")
        else:
            # Create new account
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
    except Exception as e:
        # Clean up temp directory on database error
        if os.path.exists(temp_path):
            shutil.rmtree(temp_path)
        
        # Handle specific database errors
        error_msg = str(e)
        if "uq_telegram_accounts_user_display_name" in error_msg or "duplicate key" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Display name '{displayName}' is already in use. Please choose a different display name.",
            )
        else:
            logger.error(f"Database error creating account: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}",
            )

    # Move session file to sessions directory
    tdata_path = f"sessions"
    os.makedirs(tdata_path, exist_ok=True)

    session_location = f"{tdata_path}/{current_user.user_id}_{account_name}.session"
    
    # Remove old session file if exists
    if os.path.exists(session_location):
        os.remove(session_location)
    
    shutil.move(f"{temp_path}/{tg_account_id}/{tg_account_id}.session", session_location)
    
    # Clean up temp directory
    if os.path.exists(temp_path):
        shutil.rmtree(temp_path)
    
    tdata.file.close()

    # Try to auto-connect the account
    try:
        connected = await telethon_service.connect_session(account_id)
        
        if not connected:
            # Connection failed, delete the account and session file
            await db.execute(
                "DELETE FROM telegram_accounts WHERE id = $1",
                account_id
            )
            if os.path.exists(session_location):
                os.remove(session_location)
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to connect to Telegram. Please check your session file and try again.",
            )
        
        # Update last_used to place account at top of list
        await db.execute(
            "UPDATE telegram_accounts SET last_used = NOW() WHERE id = $1",
            account_id
        )
        
        logger.info(f"New Telegram account created and connected: {account_name} for user {current_user.user_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        # Connection error, delete the account and session file
        error_msg = str(e).lower()
        logger.error(f"Error connecting new account {account_name}: {e}")
        
        await db.execute(
            "DELETE FROM telegram_accounts WHERE id = $1",
            account_id
        )
        if os.path.exists(session_location):
            os.remove(session_location)
        
        # Provide specific error messages for common issues
        if "authorization key" in error_msg and "two different ip" in error_msg:
            detail = "Session conflict: This session is being used on another device or IP address. Please use the session exclusively on one device, or export a new session from Telegram Desktop."
        elif "unauthorized" in error_msg or "auth key" in error_msg:
            detail = "Session expired or invalid. Please export a fresh session from Telegram Desktop."
        elif "flood" in error_msg:
            detail = "Too many connection attempts. Please wait a few minutes and try again."
        elif "timeout" in error_msg or "connection" in error_msg:
            detail = "Connection timeout. Please check your internet connection and try again."
        else:
            detail = f"Failed to connect to Telegram: {str(e)}"
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )

    account = await db.fetchrow(
        "SELECT * FROM telegram_accounts WHERE id = $1 AND is_active = true",
        account_id,
    )

    return {
        "id": account['id'],
        "account_name": account['account_name'],
        "display_name": account['display_name'],
        "is_active": account['is_active'],
        "source_language": account['source_language'],
        "target_language": account['target_language'],
        "created_at": account['created_at'],
        "last_used": account['last_used'],
        "is_connected": True,
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

    try:
        connected = await telethon_service.connect_session(account_id)

        if not connected:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to connect to Telegram. Please check your session file.",
            )

        return {"message": "Connected successfully", "connected": True}
    
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        logger.error(f"Error connecting account {account_id}: {e}")
        
        # Provide specific error messages for common issues
        if "authorization key" in error_msg and "two different ip" in error_msg:
            detail = "Session conflict: This session is being used on another device or IP address. Please use the session exclusively on one device, or export a new session from Telegram Desktop."
        elif "unauthorized" in error_msg or "auth key" in error_msg:
            detail = "Session expired or invalid. Please export a fresh session from Telegram Desktop."
        elif "flood" in error_msg:
            detail = "Too many connection attempts. Please wait a few minutes and try again."
        elif "timeout" in error_msg or "connection" in error_msg:
            detail = "Connection timeout. Please check your internet connection and try again."
        else:
            detail = f"Failed to connect to Telegram: {str(e)}"
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )


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


@router.get("/accounts/{account_id}/search-users", response_model=List[UserSearchResult])
async def search_users(
    account_id: int,
    username: str,
    current_user = Depends(get_current_user),
):
    """Search for Telegram users by username"""
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

    # Check if session is connected
    session = await telethon_service.get_session(account_id)
    if not session or not session.is_connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account not connected",
        )

    try:
        users = await telethon_service.search_users(account_id, username, limit=10)
        return users
    except Exception as e:
        logger.error(f"Error searching users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search users: {str(e)}",
        )


@router.post("/accounts/{account_id}/conversations", response_model=ConversationResponse)
async def create_conversation(
    account_id: int,
    conversation_data: ConversationCreate,
    current_user = Depends(get_current_user),
):
    """Create a new conversation with a Telegram user"""
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

    # Check if conversation already exists
    existing = await db.fetchrow(
        "SELECT * FROM conversations WHERE telegram_account_id = $1 AND telegram_peer_id = $2",
        account_id,
        conversation_data.telegram_peer_id,
    )

    if existing:
        # Return existing conversation
        return {
            "id": existing['id'],
            "telegram_account_id": existing['telegram_account_id'],
            "telegram_peer_id": existing['telegram_peer_id'],
            "title": existing['title'],
            "type": existing['type'],
            "is_archived": existing['is_archived'],
            "created_at": existing['created_at'],
            "last_message_at": existing.get('last_message_at'),
            "unread_count": 0,
        }

    # Create new conversation
    conversation_id = await db.fetchval(
        """
        INSERT INTO conversations (telegram_account_id, telegram_peer_id, title, type)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        account_id,
        conversation_data.telegram_peer_id,
        conversation_data.title or conversation_data.username or "Unknown",
        conversation_data.type,
    )

    conversation = await db.fetchrow(
        "SELECT * FROM conversations WHERE id = $1",
        conversation_id,
    )

    logger.info(f"New conversation created: {conversation_id} for account {account_id}")

    return {
        "id": conversation['id'],
        "telegram_account_id": conversation['telegram_account_id'],
        "telegram_peer_id": conversation['telegram_peer_id'],
        "title": conversation['title'],
        "type": conversation['type'],
        "is_archived": conversation['is_archived'],
        "created_at": conversation['created_at'],
        "last_message_at": conversation.get('last_message_at'),
        "unread_count": 0,
    }


