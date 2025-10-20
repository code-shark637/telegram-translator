from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime, timedelta
from database import db
from auth import get_current_user
from models import (
    ScheduledMessageCreate,
    ScheduledMessageUpdate,
    ScheduledMessageResponse,
    TokenData
)
from scheduler_service import scheduler_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduled-messages", tags=["scheduled-messages"])

@router.post("", response_model=ScheduledMessageResponse)
async def create_scheduled_message(
    scheduled_msg: ScheduledMessageCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Create a new scheduled message"""
    try:
        # Verify conversation belongs to user's account
        conversation = await db.fetchrow(
            """
            SELECT c.id, c.telegram_account_id
            FROM conversations c
            JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
            WHERE c.id = $1 AND ta.user_id = $2
            """,
            scheduled_msg.conversation_id,
            current_user.user_id
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Calculate scheduled time
        scheduled_at = datetime.now() + timedelta(days=scheduled_msg.days_delay)
        
        # Create scheduled message
        msg_id = await db.fetchval(
            """
            INSERT INTO scheduled_messages (conversation_id, message_text, scheduled_at)
            VALUES ($1, $2, $3)
            RETURNING id
            """,
            scheduled_msg.conversation_id,
            scheduled_msg.message_text,
            scheduled_at
        )
        
        row = await db.fetchrow(
            "SELECT * FROM scheduled_messages WHERE id = $1",
            msg_id
        )
        
        # Add to scheduler
        await scheduler_service.add_scheduled_message(msg_id)
        
        return ScheduledMessageResponse(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create scheduled message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create scheduled message: {str(e)}")

@router.get("/conversation/{conversation_id}", response_model=List[ScheduledMessageResponse])
async def get_scheduled_messages_by_conversation(
    conversation_id: int,
    current_user: TokenData = Depends(get_current_user)
):
    """Get all scheduled messages for a conversation"""
    try:
        # Verify conversation belongs to user
        conversation = await db.fetchrow(
            """
            SELECT c.id
            FROM conversations c
            JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
            WHERE c.id = $1 AND ta.user_id = $2
            """,
            conversation_id,
            current_user.user_id
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        rows = await db.fetch(
            """
            SELECT * FROM scheduled_messages
            WHERE conversation_id = $1 AND is_sent = FALSE AND is_cancelled = FALSE
            ORDER BY scheduled_at ASC
            """,
            conversation_id
        )
        
        return [ScheduledMessageResponse(**dict(row)) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch scheduled messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch scheduled messages: {str(e)}")

@router.get("", response_model=List[ScheduledMessageResponse])
async def get_all_scheduled_messages(
    current_user: TokenData = Depends(get_current_user)
):
    """Get all scheduled messages for the current user"""
    try:
        rows = await db.fetch(
            """
            SELECT sm.*
            FROM scheduled_messages sm
            JOIN conversations c ON sm.conversation_id = c.id
            JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
            WHERE ta.user_id = $1 AND sm.is_sent = FALSE AND sm.is_cancelled = FALSE
            ORDER BY sm.scheduled_at ASC
            """,
            current_user.user_id
        )
        
        return [ScheduledMessageResponse(**dict(row)) for row in rows]
    except Exception as e:
        logger.error(f"Failed to fetch all scheduled messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch scheduled messages: {str(e)}")

@router.put("/{message_id}", response_model=ScheduledMessageResponse)
async def update_scheduled_message(
    message_id: int,
    update_data: ScheduledMessageUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update a scheduled message"""
    try:
        # Verify message belongs to user and is not sent/cancelled
        existing = await db.fetchrow(
            """
            SELECT sm.id, sm.scheduled_at
            FROM scheduled_messages sm
            JOIN conversations c ON sm.conversation_id = c.id
            JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
            WHERE sm.id = $1 AND ta.user_id = $2 AND sm.is_sent = FALSE AND sm.is_cancelled = FALSE
            """,
            message_id,
            current_user.user_id
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Scheduled message not found or already sent/cancelled")
        
        # Build update query
        update_fields = []
        values = []
        param_count = 1
        
        if update_data.message_text is not None:
            update_fields.append(f"message_text = ${param_count}")
            values.append(update_data.message_text)
            param_count += 1
        
        if update_data.days_delay is not None:
            new_scheduled_at = datetime.now() + timedelta(days=update_data.days_delay)
            update_fields.append(f"scheduled_at = ${param_count}")
            values.append(new_scheduled_at)
            param_count += 1
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        values.append(message_id)
        
        query = f"""
            UPDATE scheduled_messages
            SET {', '.join(update_fields)}
            WHERE id = ${param_count}
            RETURNING *
        """
        
        row = await db.fetchrow(query, *values)
        
        # Update in scheduler
        await scheduler_service.remove_scheduled_message(message_id)
        await scheduler_service.add_scheduled_message(message_id)
        
        return ScheduledMessageResponse(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update scheduled message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update scheduled message: {str(e)}")

@router.delete("/{message_id}")
async def cancel_scheduled_message(
    message_id: int,
    current_user: TokenData = Depends(get_current_user)
):
    """Cancel a scheduled message"""
    try:
        result = await db.fetchrow(
            """
            UPDATE scheduled_messages sm
            SET is_cancelled = TRUE, cancelled_at = NOW()
            FROM conversations c
            JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
            WHERE sm.id = $1 AND sm.conversation_id = c.id AND ta.user_id = $2
            AND sm.is_sent = FALSE AND sm.is_cancelled = FALSE
            RETURNING sm.id
            """,
            message_id,
            current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Scheduled message not found or already sent/cancelled")
        
        # Remove from scheduler
        await scheduler_service.remove_scheduled_message(message_id)
        
        return {"message": "Scheduled message cancelled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel scheduled message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel scheduled message: {str(e)}")
