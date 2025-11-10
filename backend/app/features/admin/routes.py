from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from app.core.admin_security import (
    verify_admin_password,
    create_admin_access_token,
    get_current_admin,
    is_admin_password_set,
)
from database import db
from auth import get_password_hash

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Request/Response Models
class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ColleagueCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class ColleagueUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class PasswordReset(BaseModel):
    password: str

# Authentication Routes
@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login with encrypted password"""
    if not is_admin_password_set():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin password not configured. Please set up admin password first."
        )
    
    if not verify_admin_password(request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    access_token = create_admin_access_token({"admin": True})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/verify")
async def verify_admin_token(admin = Depends(get_current_admin)):
    """Verify admin token is valid"""
    return {"status": "valid"}

# Colleague Management Routes
@router.get("/colleagues")
async def get_colleagues(admin = Depends(get_current_admin)):
    """Get all colleagues with their accounts and statistics"""
    colleagues = await db.fetch("""
        SELECT 
            u.id, u.username, u.email, u.is_active, u.created_at, u.last_login,
            COUNT(DISTINCT ta.id) as account_count,
            COUNT(DISTINCT c.id) as conversation_count,
            COUNT(DISTINCT m.id) as message_count
        FROM users u
        LEFT JOIN telegram_accounts ta ON ta.user_id = u.id
        LEFT JOIN conversations c ON c.telegram_account_id = ta.id
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY u.id, u.username, u.email, u.is_active, u.created_at, u.last_login
        ORDER BY u.created_at DESC
    """)
    
    result = []
    for colleague in colleagues:
        # Get accounts for this colleague
        accounts = await db.fetch("""
            SELECT id, user_id, display_name, account_name, is_active, 
                   source_language, target_language, created_at, last_used
            FROM telegram_accounts
            WHERE user_id = $1
            ORDER BY created_at DESC
        """, colleague['id'])
        
        result.append({
            "id": colleague['id'],
            "username": colleague['username'],
            "email": colleague['email'],
            "is_active": colleague['is_active'],
            "created_at": colleague['created_at'].isoformat(),
            "last_login": colleague['last_login'].isoformat() if colleague['last_login'] else None,
            "accounts": [dict(acc) for acc in accounts],
            "total_messages": colleague['message_count'],
            "total_conversations": colleague['conversation_count'],
        })
    
    return result

@router.get("/colleagues/{colleague_id}")
async def get_colleague(colleague_id: int, admin = Depends(get_current_admin)):
    """Get specific colleague details"""
    colleague = await db.fetchrow("""
        SELECT id, username, email, is_active, created_at, last_login
        FROM users
        WHERE id = $1
    """, colleague_id)
    
    if not colleague:
        raise HTTPException(status_code=404, detail="Colleague not found")
    
    accounts = await db.fetch("""
        SELECT id, user_id, display_name, account_name, is_active, 
               source_language, target_language, created_at, last_used
        FROM telegram_accounts
        WHERE user_id = $1
        ORDER BY created_at DESC
    """, colleague_id)
    
    return {
        **dict(colleague),
        "accounts": [dict(acc) for acc in accounts]
    }

@router.post("/colleagues", status_code=status.HTTP_201_CREATED)
async def create_colleague(data: ColleagueCreate, admin = Depends(get_current_admin)):
    """Create new colleague account"""
    # Check if username exists
    existing = await db.fetchrow("SELECT id FROM users WHERE username = $1", data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    password_hash = get_password_hash(data.password)
    
    colleague_id = await db.fetchval("""
        INSERT INTO users (username, password_hash, email, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, data.username, password_hash, data.email)
    
    return {"id": colleague_id, "message": "Colleague created successfully"}

@router.put("/colleagues/{colleague_id}")
async def update_colleague(
    colleague_id: int,
    data: ColleagueUpdate,
    admin = Depends(get_current_admin)
):
    """Update colleague information"""
    colleague = await db.fetchrow("SELECT id FROM users WHERE id = $1", colleague_id)
    if not colleague:
        raise HTTPException(status_code=404, detail="Colleague not found")
    
    # Build update query dynamically
    updates = []
    values = []
    param_count = 1
    
    if data.username is not None:
        updates.append(f"username = ${param_count}")
        values.append(data.username)
        param_count += 1
    
    if data.email is not None:
        updates.append(f"email = ${param_count}")
        values.append(data.email)
        param_count += 1
    
    if data.is_active is not None:
        updates.append(f"is_active = ${param_count}")
        values.append(data.is_active)
        param_count += 1
    
    if not updates:
        return {"message": "No updates provided"}
    
    values.append(colleague_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ${param_count}"
    
    await db.execute(query, *values)
    return {"message": "Colleague updated successfully"}

@router.delete("/colleagues/{colleague_id}")
async def delete_colleague(colleague_id: int, admin = Depends(get_current_admin)):
    """Delete colleague and all associated data"""
    colleague = await db.fetchrow("SELECT id FROM users WHERE id = $1", colleague_id)
    if not colleague:
        raise HTTPException(status_code=404, detail="Colleague not found")
    
    await db.execute("DELETE FROM users WHERE id = $1", colleague_id)
    return {"message": "Colleague deleted successfully"}

@router.post("/colleagues/{colleague_id}/reset-password")
async def reset_colleague_password(
    colleague_id: int,
    data: PasswordReset,
    admin = Depends(get_current_admin)
):
    """Reset colleague password"""
    colleague = await db.fetchrow("SELECT id FROM users WHERE id = $1", colleague_id)
    if not colleague:
        raise HTTPException(status_code=404, detail="Colleague not found")
    
    password_hash = get_password_hash(data.password)
    await db.execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        password_hash,
        colleague_id
    )
    
    return {"message": "Password reset successfully"}

# Message Review Routes
@router.get("/conversations")
async def get_conversations(
    user_id: Optional[int] = None,
    account_id: Optional[int] = None,
    admin = Depends(get_current_admin)
):
    """Get conversations with filters"""
    from telethon_service import telethon_service
    
    query = """
        SELECT c.*, ta.id as account_id, ta.display_name as account_name, u.username as colleague_username
        FROM conversations c
        JOIN telegram_accounts ta ON ta.id = c.telegram_account_id
        JOIN users u ON u.id = ta.user_id
        WHERE 1=1
    """
    params = []
    
    if user_id:
        params.append(user_id)
        query += f" AND u.id = ${len(params)}"
    
    if account_id:
        params.append(account_id)
        query += f" AND ta.id = ${len(params)}"
    
    query += " ORDER BY c.last_message_at DESC NULLS LAST"
    
    conversations = await db.fetch(query, *params)
    
    # Add account owner's Telegram user ID to each conversation
    result = []
    for conv in conversations:
        conv_dict = dict(conv)
        # Try to get the account owner's Telegram user ID from the session
        session = telethon_service.sessions.get(conv['account_id'])
        if session and session.client and session.is_connected:
            try:
                me = await session.client.get_me()
                conv_dict['account_telegram_user_id'] = me.id
            except Exception:
                conv_dict['account_telegram_user_id'] = None
        else:
            conv_dict['account_telegram_user_id'] = None
        result.append(conv_dict)
    
    return result

@router.get("/messages")
async def get_messages(
    user_id: Optional[int] = None,
    account_id: Optional[int] = None,
    conversation_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    admin = Depends(get_current_admin)
):
    """Get messages with filters"""
    query = """
        SELECT m.*
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        JOIN telegram_accounts ta ON ta.id = c.telegram_account_id
        JOIN users u ON u.id = ta.user_id
        WHERE 1=1
    """
    params = []
    
    if user_id:
        params.append(user_id)
        query += f" AND u.id = ${len(params)}"
    
    if account_id:
        params.append(account_id)
        query += f" AND ta.id = ${len(params)}"
    
    if conversation_id:
        params.append(conversation_id)
        query += f" AND c.id = ${len(params)}"
    
    query += " ORDER BY m.created_at ASC"
    
    params.append(limit)
    query += f" LIMIT ${len(params)}"
    
    params.append(offset)
    query += f" OFFSET ${len(params)}"
    
    messages = await db.fetch(query, *params)
    return [dict(msg) for msg in messages]

# Statistics Route
@router.get("/statistics")
async def get_statistics(admin = Depends(get_current_admin)):
    """Get overall statistics"""
    stats = await db.fetchrow("""
        SELECT 
            COUNT(DISTINCT u.id) as total_users,
            COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
            COUNT(DISTINCT ta.id) as total_accounts,
            COUNT(DISTINCT c.id) as total_conversations,
            COUNT(DISTINCT m.id) as total_messages
        FROM users u
        LEFT JOIN telegram_accounts ta ON ta.user_id = u.id
        LEFT JOIN conversations c ON c.telegram_account_id = ta.id
        LEFT JOIN messages m ON m.conversation_id = c.id
    """)
    
    return dict(stats)
