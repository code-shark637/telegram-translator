# Telegram Translator

A comprehensive React + FastAPI + PostgreSQL application for real-time Telegram message translation with multi-account support.

## Features

### Core Functionality
- **Real-time Translation**: Incoming messages appear in original language with translated subtitles
- **Auto-translation**: Outgoing messages are translated before sending
- **Multi-account Support**: Manage multiple Telegram accounts with TData sessions
- **Session Management**: Add, remove, and switch between Telegram accounts
- **Language Configuration**: Set source/target languages per account
- **Message Storage**: All messages (original + translated) stored in PostgreSQL

### Translation Engines
- **Google Translate** (current)
- Additional engines: planned

### Authentication & Security
- Username/password authentication
- JWT-based session management
- Account isolation per user
- Secure session storage

### Technical Architecture
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) + WebSocket
- **Database**: PostgreSQL (local)
- **Real-time**: WebSocket connections for live updates
- **Translation**: Google Translate via `googletrans`
- **Session Management**: Telethon-compatible session handling

## Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Google Translate API key (recommended)

### Database Setup (Local PostgreSQL)

1. Create PostgreSQL database:
```sql
CREATE DATABASE telegram_translator;
```

2. Create a user (if needed) and grant privileges:
```sql
CREATE USER postgres WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE telegram_translator TO postgres;
```

3. Apply schema:
```bash
psql -d telegram_translator -h localhost -U postgres -f backend/database/schema.sql
```

### Environment Configuration

Create `backend/.env` with:
```env
# Database (local Postgres)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/telegram_translator

# Auth
JWT_SECRET_KEY=your_super_secret_jwt_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Frontend
FRONTEND_URL=http://localhost:5173
```

### Installation Steps

1. Install dependencies:
```bash
npm run install:all
```

2. Start development servers (FastAPI + Vite):
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## Usage Guide

### Getting Started

1. **Register Account**: Create your user account
2. **Add Telegram Account**: Upload TData session files
3. **Connect**: Connect to your Telegram accounts
4. **Configure**: Set translation languages
5. **Chat**: Start translating messages in real-time

### Adding Telegram Accounts

1. Export your Telegram Desktop `tdata` as a zip
2. Click "Add Account" in the sidebar
3. Provide a display name and select languages
4. Upload the `tdata` zip (the backend will extract `app_id` and `app_hash` from it automatically)
5. Click "Add Account" to save

### Translation Settings

- **Source Language**: Choose specific language or "Auto-detect"
- **Target Language**: Your preferred translation language
- **Translation Engine**: Primary engine with automatic fallback

### Message Flow

**Incoming Messages**:
1. Original message appears instantly
2. Translation appears as subtitle below
3. Both versions stored in database

**Outgoing Messages**:
1. Type in your language
2. Message auto-translated to target language
3. Only translated version sent to recipient
4. Both versions stored locally

## Architecture

### Project Structure
```
telegram-translator/
├── src/                    # React frontend
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
├── backend/                # FastAPI backend
│   ├── main.py             # FastAPI application
│   ├── app/
│   │   ├── core/           # config, database, security
│   │   └── features/
│   │       ├── auth/routes.py
│   │       ├── telegram/routes.py
│   │       ├── messages/routes.py
│   │       └── translation/routes.py
│   ├── models.py           # Pydantic models
│   ├── auth.py             # JWT helpers
│   ├── translation_service.py
│   ├── telethon_service.py
│   ├── websocket_manager.py
│   └── requirements.txt
└── package.json
```

### Database Schema

Key tables include:
- `users`: User authentication and profiles
- `telegram_accounts`: Account and language configuration
- `conversations`: Chat/channel information
- `messages`: Message storage with translations

### API Endpoints

See `backend/API.md` for the full FastAPI reference (including `/api/translation/*`).

### Real-time Communication

Native WebSocket endpoint:
- URL: `ws://localhost:8000/ws?token=YOUR_JWT_TOKEN`
- Heartbeat: send `{ "type": "ping" }`, server replies `{ "type": "pong" }`
- Server push: `{ "type": "new_message", "message": { ... } }`

## Extension Points

### Adding Translation Engines

1. Implement `TranslationEngine` interface in `server/src/services/translationService.ts`
2. Register engine in `TranslationService` constructor
3. Add configuration to database `translation_engines` table

### Adding Message Types

1. Extend `message_type` enum in database schema
2. Add handling in `TelegramService`
3. Update frontend components for new message types

### CRM Features

The schema includes `contacts` table for future CRM functionality:
- Contact tagging and categorization
- Interaction history
- Favorite/blocked status
- Notes and custom fields

### Scheduled Messages

Infrastructure exists for scheduled messaging:
- `scheduled_messages` table
- Cron job framework in place
- API endpoints ready for implementation

## Development

### Code Standards

- **TypeScript**: Strict typing throughout
- **ESLint**: Code quality enforcement
- **Clean Architecture**: Separation of concerns
- **Error Handling**: Comprehensive error boundaries
- **Logging**: Winston-based logging system

### Testing Strategy

- Unit tests for core business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Database migration testing

### Performance Considerations

- Connection pooling for PostgreSQL
- Message pagination for large chats
- Efficient translation caching
- WebSocket connection management
- Index optimization for queries

## Production Deployment

### Build Process
```bash
npm run build
# Backend is Python; no build step required for deployment
```

### Environment Variables

Ensure production environment variables are configured (see `backend/.env` template):
- Secure JWT secrets
- Production database credentials
- Translation API keys
- Proper CORS origins

### Security Checklist

- [ ] Environment variables secured
- [ ] Database connections encrypted
- [ ] JWT tokens properly configured
- [ ] API rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] HTTPS enabled
- [ ] CORS properly configured

## Troubleshooting

### Common Issues

**Database Connection Failed**:
- Verify PostgreSQL is running
- Check connection credentials
- Ensure database exists

**Translation API Errors**:
- Verify API keys are correct
- Check API quotas and limits
- Ensure fallback engines are configured

**TData Session Import**:
- Verify TData file format
- Check Telegram API credentials
- Ensure proper file permissions

### Logging

Backend logs output to console. Configure Python logging handlers for files as needed.

## Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request with detailed description

## License

This project is for educational and development purposes. Ensure compliance with Telegram's Terms of Service when using with real accounts.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review error logs
3. Create detailed issue reports
4. Include relevant configuration (without secrets)