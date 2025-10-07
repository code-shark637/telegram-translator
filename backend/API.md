# API Documentation

FastAPI backend API reference for Telegram Translator.

## Base URL

```
http://localhost:8000
```

## Interactive Documentation

FastAPI provides automatic interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Authentication

All protected endpoints require JWT authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Health Check

#### GET /api/health

Check API health status.

**Authentication**: Not required

**Response**:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

### Authentication

#### POST /api/auth/register

Register a new user account.

**Authentication**: Not required

**Request Body**:
```json
{
  "username": "john_doe",
  "password": "secure_password_123",
  "email": "john@example.com"  // optional
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid input
- `409`: Username already exists

---

#### POST /api/auth/login

Authenticate user and get JWT token.

**Authentication**: Not required

**Request Body**:
```json
{
  "username": "john_doe",
  "password": "secure_password_123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Status Codes**:
- `200`: Success
- `401`: Invalid credentials
- `403`: Account deactivated

---

#### GET /api/auth/me

Get current authenticated user information.

**Authentication**: Required

**Response**:
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "is_active": true,
  "created_at": "2025-01-01T12:00:00Z"
}
```

**Status Codes**:
- `200`: Success
- `401`: Not authenticated
- `404`: User not found

---

### Telegram Accounts

#### GET /api/telegram/accounts

List all Telegram accounts for authenticated user.

**Authentication**: Required

**Response**:
```json
[
  {
    "id": 1,
    "session_name": "main_account",
    "account_name": "My Main Account",
    "is_active": true,
    "source_language": "en",
    "target_language": "es",
    "created_at": "2025-01-01T12:00:00Z",
    "last_used": "2025-01-15T14:30:00Z",
    "is_connected": true
  }
]
```

---

#### POST /api/telegram/accounts

Create a Telegram account from Telegram Desktop tdata zip. The backend extracts `app_id` and `app_hash` from the zip automatically.

**Authentication**: Required

**Request Body** (multipart/form-data):
```
displayName: string (required)
sourceLanguage: string (default: "auto")
targetLanguage: string (default: "en")
tdata: file (required, zip exported from Telegram Desktop)
```

**Example with cURL**:
```bash
curl -X POST http://localhost:8000/api/telegram/accounts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "displayName=My Account" \
  -F "sourceLanguage=auto" \
  -F "targetLanguage=en" \
  -F "tdata=@/path/to/tdata.zip"
```

**Response**:
```json
{
  "id": 2,
  "session_name": "my_account",
  "account_name": "My Account",
  "is_active": true,
  "source_language": "en",
  "target_language": "es",
  "created_at": "2025-01-15T15:00:00Z",
  "last_used": null,
  "is_connected": false
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid input
- `409`: Session name already exists

---

#### POST /api/telegram/accounts/{account_id}/connect

Connect to Telegram for specific account.

**Authentication**: Required

**Parameters**:
- `account_id` (path): Account ID to connect

**Response**:
```json
{
  "message": "Connected successfully",
  "connected": true
}
```

**Status Codes**:
- `200`: Success
- `404`: Account not found
- `500`: Connection failed

---

#### POST /api/telegram/accounts/{account_id}/disconnect

Disconnect from Telegram for specific account.

**Authentication**: Required

**Parameters**:
- `account_id` (path): Account ID to disconnect

**Response**:
```json
{
  "message": "Disconnected successfully",
  "connected": false
}
```

---

#### PATCH /api/telegram/accounts/{account_id}

Update Telegram account settings.

**Authentication**: Required

**Parameters**:
- `account_id` (path): Account ID to update

**Request Body**:
```json
{
  "account_name": "Updated Account Name",
  "source_language": "fr",
  "target_language": "de",
  "is_active": true
}
```

All fields are optional.

**Response**:
```json
{
  "id": 1,
  "session_name": "main_account",
  "account_name": "Updated Account Name",
  "is_active": true,
  "source_language": "fr",
  "target_language": "de",
  "created_at": "2025-01-01T12:00:00Z",
  "last_used": "2025-01-15T14:30:00Z",
  "is_connected": true
}
```

---

#### DELETE /api/telegram/accounts/{account_id}

Delete Telegram account.

**Authentication**: Required

**Parameters**:
- `account_id` (path): Account ID to delete

**Response**:
```json
{
  "message": "Account deleted successfully"
}
```

**Status Codes**:
- `200`: Success
- `404`: Account not found

---

#### GET /api/telegram/accounts/{account_id}/conversations

Get all conversations for specific account.

**Authentication**: Required

**Parameters**:
- `account_id` (path): Account ID

**Response**:
```json
[
  {
    "id": 10,
    "telegram_account_id": 1,
    "telegram_peer_id": 123456789,
    "title": "John Smith",
    "type": "private",
    "is_archived": false,
    "created_at": "2025-01-10T10:00:00Z",
    "last_message_at": "2025-01-15T16:20:00Z",
    "unread_count": 3
  },
  {
    "id": 11,
    "telegram_account_id": 1,
    "telegram_peer_id": -1001234567890,
    "title": "Project Team",
    "type": "supergroup",
    "is_archived": false,
    "created_at": "2025-01-05T09:00:00Z",
    "last_message_at": "2025-01-15T15:00:00Z",
    "unread_count": 12
  }
]
```

---

### Messages

#### GET /api/messages/conversations/{conversation_id}/messages

Get messages for a specific conversation.

**Authentication**: Required

**Parameters**:
- `conversation_id` (path): Conversation ID
- `limit` (query, optional): Number of messages to retrieve (default: 50)

**Response**:
```json
[
  {
    "id": 100,
    "conversation_id": 10,
    "telegram_message_id": 987654321,
    "sender_user_id": 123456789,
    "type": "text",
    "original_text": "Hello, how are you?",
    "translated_text": "Hola, ¿cómo estás?",
    "source_language": "en",
    "target_language": "es",
    "created_at": "2025-01-15T16:20:00Z",
    "edited_at": null,
    "is_outgoing": false
  },
  {
    "id": 101,
    "conversation_id": 10,
    "telegram_message_id": 987654322,
    "sender_user_id": null,
    "type": "text",
    "original_text": "I'm doing great, thanks!",
    "translated_text": "¡Me va muy bien, gracias!",
    "source_language": "en",
    "target_language": "es",
    "created_at": "2025-01-15T16:21:00Z",
    "edited_at": null,
    "is_outgoing": true
  }
]
```

---

#### POST /api/messages/send

Send a message with translation.

**Authentication**: Required

**Request Body**:
```json
{
  "conversation_id": 10,
  "text": "I'm doing great, thanks!",
  "translate": true
}
```

**Response**:
```json
{
  "id": 101,
  "conversation_id": 10,
  "telegram_message_id": 987654322,
  "sender_user_id": null,
  "type": "text",
  "original_text": "I'm doing great, thanks!",
  "translated_text": "¡Me va muy bien, gracias!",
  "source_language": "en",
  "target_language": "es",
  "created_at": "2025-01-15T16:21:00Z",
  "edited_at": null,
  "is_outgoing": true
}
```

**Status Codes**:
- `200`: Success
- `404`: Conversation not found
- `500`: Failed to send message

---

#### POST /api/messages/translate

Translate text without sending a message.

**Authentication**: Required

You can send either JSON body or query parameters.

- JSON body example:
```json
{
  "text": "Hello",
  "target_language": "es",
  "source_language": "en"
}
```

- Query parameters example:
```
POST /api/messages/translate?text=Hello&target_language=es&source_language=en
```

---

### WebSocket

#### WS /ws

Real-time message updates via WebSocket.

**Authentication**: Required (via query parameter)

**Connection URL**:
```
ws://localhost:8000/ws?token=YOUR_JWT_TOKEN
```

**Client Messages**:

Heartbeat (ping):
```json
{
  "type": "ping"
}
```

**Server Messages**:

Heartbeat response:
```json
{
  "type": "pong"
}
```

New message notification:
```json
{
  "type": "new_message",
  "account_id": 1,
  "message": {
    "id": 102,
    "conversation_id": 10,
    "telegram_message_id": 987654323,
    "sender_user_id": 123456789,
    "type": "text",
    "original_text": "Hello again!",
    "translated_text": "¡Hola de nuevo!",
    "source_language": "en",
    "target_language": "es",
    "created_at": "2025-01-15T16:25:00Z",
    "is_outgoing": false
  }
}
```

**JavaScript Example**:
```javascript
const token = 'YOUR_JWT_TOKEN';
const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected');

  // Send heartbeat every 30 seconds
  setInterval(() => {
    ws.send(JSON.stringify({ type: 'ping' }));
  }, 30000);
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'new_message') {
    console.log('New message:', data.message);
    // Update UI with new message
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
  // Implement reconnection logic
};
```

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message description"
}
```

### Common Status Codes

- `200`: Success
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Authentication required or token invalid
- `403`: Forbidden - Access denied
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Resource already exists
- `422`: Unprocessable Entity - Validation error
- `500`: Internal Server Error - Server-side error

### Validation Errors (422)

```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": ["body", "password"],
      "msg": "ensure this value has at least 6 characters",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

---

## Translation API (Dedicated)

Endpoints under `/api/translation` provide a JSON-friendly translate route that accepts both JSON and form data.

### POST /api/translation/translate

Translate text. Accepts JSON or form data with the following fields:

```
text: string (required)
target_language or targetLanguage: string (required)
source_language or sourceLanguage: string (optional, default: "auto")
```

Example JSON request:
```json
{
  "text": "How are you?",
  "target_language": "es"
}
```

Response:
```json
{
  "original_text": "How are you?",
  "translated_text": "¿Cómo estás?",
  "source_language": "en",
  "target_language": "es"
}
```

---

## Language Codes

Supported language codes (current):

- `auto` - Auto-detect (source only)
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `ru` - Russian
- `zh` - Chinese

---

## CORS

CORS is enabled for the following origins:
- http://localhost:5173
- http://localhost:3000
- Configured frontend URL from environment

All methods and headers are allowed for these origins.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are integers (bigint)
- Session names must be unique per user
- WebSocket connections require valid JWT token
- Original and translated text are both stored for all messages
