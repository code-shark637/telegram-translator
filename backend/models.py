from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    is_active: bool
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None

class TelegramAccountCreate(BaseModel):
    display_name: str
    source_language: str = "auto"
    target_language: str = "en"

class TelegramAccountResponse(BaseModel):
    id: int
    account_name: str
    display_name: Optional[str]
    is_active: bool
    source_language: str
    target_language: str
    created_at: datetime
    last_used: Optional[datetime]
    is_connected: bool = False

class TelegramAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    display_name: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    is_active: Optional[bool] = None

class ConversationType(str, Enum):
    private = "private"
    group = "group"
    supergroup = "supergroup"
    channel = "channel"

class ConversationResponse(BaseModel):
    id: int
    telegram_account_id: int
    telegram_peer_id: int
    title: Optional[str]
    type: str
    is_archived: bool
    created_at: datetime
    last_message_at: Optional[datetime]
    unread_count: int = 0

class MessageType(str, Enum):
    text = "text"
    photo = "photo"
    video = "video"
    voice = "voice"
    document = "document"
    sticker = "sticker"
    system = "system"

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    telegram_message_id: Optional[int]
    sender_user_id: Optional[int]
    sender_name: Optional[str]
    sender_username: Optional[str]
    type: str
    original_text: Optional[str]
    translated_text: Optional[str]
    source_language: Optional[str]
    target_language: Optional[str]
    created_at: datetime
    edited_at: Optional[datetime]
    is_outgoing: bool = False

class MessageSend(BaseModel):
    conversation_id: int
    text: str
    translate: bool = True

class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = "auto"

class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_language: str
    target_language: str

class TdataUpload(BaseModel):
    account_name: str
    source_language: str = "auto"
    target_language: str = "en"

# Message Templates
class MessageTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)

class MessageTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = Field(None, min_length=1)

class MessageTemplateResponse(BaseModel):
    id: int
    user_id: int
    name: str
    content: str
    created_at: datetime
    updated_at: datetime

# Scheduled Messages
class ScheduledMessageCreate(BaseModel):
    conversation_id: int
    message_text: str = Field(..., min_length=1)
    days_delay: int = Field(..., ge=1)  # Number of days to wait before sending

class ScheduledMessageUpdate(BaseModel):
    message_text: Optional[str] = Field(None, min_length=1)
    days_delay: Optional[int] = Field(None, ge=1)

class ScheduledMessageResponse(BaseModel):
    id: int
    conversation_id: int
    message_text: str
    scheduled_at: datetime
    created_at: datetime
    is_sent: bool
    is_cancelled: bool
    sent_at: Optional[datetime]
    cancelled_at: Optional[datetime]
