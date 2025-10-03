# Telegram Translator Backend (FastAPI)

FastAPI backend for managing 30+ Telegram sessions with real-time translation using Telethon.

## Features

- **Multi-Account Management**: Handle 30+ Telegram accounts simultaneously
- **Real-Time Translation**: Instant translation of incoming/outgoing messages using Google Translate
- **Telethon Integration**: Full Telegram client functionality with TData session support
- **WebSocket Support**: Real-time message updates to connected clients
- **PostgreSQL Storage**: All messages (original and translated) stored in Supabase database
- **JWT Authentication**: Secure user authentication and authorization
- **CRM-Ready**: Extensible architecture for future features (scheduled messages, follow-ups, contact management)

## Requirements

- Python 3.9+
- PostgreSQL (Supabase)
- Telegram API credentials (api_id and api_hash)

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables in `.env`:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://user:password@host:port/database

JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

TELEGRAM_API_ID=your-telegram-api-id
TELEGRAM_API_HASH=your-telegram-api-hash

FRONTEND_URL=http://localhost:5173
```

3. Get Telegram API credentials:
   - Visit https://my.telegram.org
   - Login with your phone number
   - Go to "API development tools"
   - Create a new application
   - Copy your `api_id` and `api_hash`

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
- `POST /api/telegram/accounts` - Add new account (supports TData upload)
- `POST /api/telegram/accounts/{id}/connect` - Connect to Telegram
- `POST /api/telegram/accounts/{id}/disconnect` - Disconnect from Telegram
- `PATCH /api/telegram/accounts/{id}` - Update account settings
- `DELETE /api/telegram/accounts/{id}` - Delete account
- `GET /api/telegram/accounts/{id}/conversations` - Get conversations for account

### Messages
- `GET /api/messages/conversations/{id}/messages` - Get messages for conversation
- `POST /api/messages/send` - Send translated message
- `POST /api/messages/translate` - Translate text

### WebSocket
- `WS /ws?token={jwt_token}` - Real-time message updates

## Architecture

### Core Components

#### `telethon_service.py`
Manages all Telegram sessions using Telethon library. Handles:
- Session creation from TData or string sessions
- Connection/disconnection of accounts
- Message sending/receiving
- Real-time event handlers

#### `websocket_manager.py`
Manages WebSocket connections for real-time updates:
- User-specific message broadcasting
- Account-specific message routing
- Connection lifecycle management

#### `translation_service.py`
Handles translation using Google Translate:
- Automatic language detection
- Text translation between languages
- Translation caching (future enhancement)

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
- `contacts` - Contact management (CRM features)
- `scheduled_messages` - Future scheduled message sending
- `translation_engines` - Translation service configurations

## Adding Telegram Accounts

### Method 1: Session String
If you have a Telethon session string:
```python
POST /api/telegram/accounts
{
  "session_name": "my_account",
  "account_name": "My Account",
  "phone_number": "+1234567890",
  "session_string": "your_session_string",
  "source_language": "en",
  "target_language": "es"
}
```

### Method 2: TData Upload
Upload Telegram Desktop TData folder:
```bash
curl -X POST http://localhost:8000/api/telegram/accounts \
  -H "Authorization: Bearer {token}" \
  -F "session_name=my_account" \
  -F "account_name=My Account" \
  -F "phone_number=+1234567890" \
  -F "tdata_file=@/path/to/tdata.zip"
```

## Extension Points

The architecture is designed for easy extension:

### Adding New Translation Engines
1. Create new translator class in `translation_service.py`
2. Implement `translate_text()` method
3. Update API to support engine selection

### Adding Scheduled Messages
1. Create background task scheduler
2. Implement message queue in database
3. Add cron job to process scheduled messages

### Adding CRM Features
1. Use existing `contacts` table
2. Add routes for contact management
3. Implement follow-up tracking
4. Add tag-based filtering

## Security

- All API endpoints (except auth) require JWT authentication
- Passwords hashed with bcrypt
- Row Level Security (RLS) enabled on all database tables
- WebSocket connections require valid JWT token
- API keys and secrets stored securely in environment variables

## Troubleshooting

### Telegram Connection Issues
- Verify API credentials are correct
- Check if session files exist in `sessions/` directory
- Ensure phone number format is correct (+country code)
- Check Telegram API rate limits

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check Supabase connection pooling limits
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
- [ ] Multiple translation engine support (DeepL, Azure, etc.)
- [ ] Scheduled message sending
- [ ] Automatic follow-ups after X days
- [ ] Advanced CRM features (tags, notes, custom fields)
- [ ] Message templates and quick replies
- [ ] Bulk message operations
- [ ] Analytics and statistics
- [ ] Export conversation history

## License

MIT
