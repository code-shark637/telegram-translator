# Telegram Translator Backend (FastAPI)

FastAPI backend for managing Telegram sessions with real-time translation using Telethon.

## Features

- **Multi-Account Management**: Manage multiple Telegram accounts via Telegram Desktop tdata
- **Real-Time Translation**: Incoming/outgoing text translated using `googletrans`
- **Telethon Integration**: Telegram client with session handling based on tdata
- **WebSocket**: Native WebSocket endpoint for real-time updates
- **PostgreSQL Storage**: Store original and translated messages
- **JWT Authentication**: Bearer token auth for all protected endpoints

## Requirements

- Python 3.9+
- PostgreSQL (local)

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables in `.env`:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/telegram_translator

JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

FRONTEND_URL=http://localhost:5173
```

3. Telegram API credentials are read automatically from the uploaded `tdata` zip during account creation (no manual env configuration needed).

## Running the Server

### Development
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Telegram Accounts
- `GET /api/telegram/accounts` - List all accounts
- `POST /api/telegram/accounts` - Add new account (tdata zip required)
- `POST /api/telegram/accounts/{id}/connect` - Connect to Telegram
- `POST /api/telegram/accounts/{id}/disconnect` - Disconnect from Telegram
- `PATCH /api/telegram/accounts/{id}` - Update account settings
- `DELETE /api/telegram/accounts/{id}` - Delete account
- `GET /api/telegram/accounts/{id}/conversations` - Get conversations for account

### Messages
- `GET /api/messages/conversations/{id}/messages` - Get messages for conversation
- `POST /api/messages/send` - Send message (optionally translated)
- `POST /api/messages/translate` - Translate arbitrary text

### WebSocket
- `WS /ws?token={jwt_token}` - Real-time message updates

## Architecture

### Core Components

#### `telethon_service.py`
Manages all Telegram sessions using Telethon library. Handles:
- Session creation from TData zip only
- Connection/disconnection of accounts
- Message sending/receiving
- Real-time event handlers

#### `websocket_manager.py`
Manages WebSocket connections for real-time updates:
- User-specific message broadcasting
- Account-specific message routing
- Connection lifecycle management

#### `translation_service.py`
Handles translation using Google Translate (`googletrans`):
- Automatic language detection
- Text translation between languages
- Fallbacks/caching can be added

#### `database.py`
PostgreSQL connection pool management:
- Async connection pooling with asyncpg
- Query execution helpers
- Connection lifecycle management

### Data Flow

1. **Incoming Messages**:
   - Telethon receives message from Telegram
   - Message is translated to user's target language
   - Both original and translated text stored in database
   - WebSocket notification sent to connected client
   - Message appears in real-time in UI

2. **Outgoing Messages**:
   - User types message in their language
   - Text is translated to conversation's target language
   - Translated message sent to Telegram
   - Both versions stored in database
   - Recipient only sees translated message

## Database Schema

### Tables
- `users` - User accounts and authentication
- `telegram_accounts` - Telegram account configurations
- `conversations` - Telegram chats/channels per account
- `messages` - All messages with original and translated text
 

## Adding Telegram Accounts

### TData Zip Upload (only)
Upload Telegram Desktop TData zip:
```bash
curl -X POST http://localhost:8000/api/telegram/accounts \
  -H "Authorization: Bearer {token}" \
  -F "displayName=My Account" \
  -F "sourceLanguage=auto" \
  -F "targetLanguage=en" \
  -F "tdata=@/path/to/tdata.zip"
```

 

## Security

- All API endpoints (except auth) require JWT authentication
- Passwords hashed with bcrypt
- Row Level Security (RLS) recommended for production
- WebSocket connections require valid JWT token
- API keys and secrets stored securely in environment variables

## Troubleshooting

### Telegram Connection Issues
- Verify `tdata` zip contains valid API credentials
- Check if session files exist in `sessions/` directory
- Check Telegram API rate limits

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check PostgreSQL connection configuration
- Ensure database migrations are applied

### WebSocket Issues
- Check JWT token is valid and not expired
- Verify WebSocket URL includes token parameter
- Check CORS settings in FastAPI

## Performance Notes

- Each Telegram session runs in async mode
- Connection pool size: 30 connections (configurable)
- WebSocket heartbeat: 30 seconds
- Supports 30+ concurrent Telegram sessions
- Translation requests are non-blocking

## Future Enhancements

- [ ] Support for message media (photos, videos, documents)
- [ ] Translation caching for repeated phrases
- [ ] Message templates and quick replies
- [ ] Bulk message operations
- [ ] Analytics and statistics
- [ ] Export conversation history
