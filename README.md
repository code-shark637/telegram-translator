# Telegram Translator

A comprehensive React + Node.js + PostgreSQL application for real-time Telegram message translation with multi-account support.

## Features

### Core Functionality
- **Real-time Translation**: Incoming messages appear in original language with translated subtitles
- **Auto-translation**: Outgoing messages are translated before sending
- **Multi-account Support**: Manage multiple Telegram accounts with TData sessions
- **Session Management**: Add, remove, and switch between Telegram accounts
- **Language Configuration**: Set source/target languages per account
- **Message Storage**: All messages (original + translated) stored in PostgreSQL

### Translation Engines
- **Google Translate** (Primary)
- **LibreTranslate** (Fallback)
- **DeepL** (Planned)
- **Azure Translator** (Planned)

### Authentication & Security
- Username/password authentication
- JWT-based session management
- Account isolation per user
- Secure session storage

### Technical Architecture
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Database**: PostgreSQL with comprehensive schema
- **Real-time**: WebSocket connections for live updates
- **Translation**: Multiple engine support with fallback
- **Session Management**: Telethon-compatible session handling

## Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Google Translate API key (recommended)

### Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE telegram_translator;
```

2. Run the schema:
```bash
psql -d telegram_translator -f server/src/database/schema.sql
```

### Environment Configuration

1. Copy environment template:
```bash
cp server/.env.example server/.env
```

2. Configure your `.env` file:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telegram_translator
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key

# Translation
GOOGLE_TRANSLATE_KEY=your_google_translate_api_key

# Telegram API (get from my.telegram.org)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
```

### Installation Steps

1. Install dependencies:
```bash
npm run install:all
```

2. Start development servers:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Usage Guide

### Getting Started

1. **Register Account**: Create your user account
2. **Add Telegram Account**: Upload TData session files
3. **Connect**: Connect to your Telegram accounts
4. **Configure**: Set translation languages
5. **Chat**: Start translating messages in real-time

### Adding Telegram Accounts

1. Export your Telegram session as TData format
2. Click "Add Account" in the sidebar
3. Upload your TData file
4. Configure session name and languages
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
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API services
│   └── types/            # TypeScript definitions
├── server/               # Node.js backend
│   ├── src/
│   │   ├── config/       # Configuration
│   │   ├── database/     # Database schema & connection
│   │   ├── middleware/   # Express middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utilities
│   └── package.json
└── package.json
```

### Database Schema

**Key Tables**:
- `users`: User authentication and profiles
- `telegram_accounts`: TData session management
- `conversations`: Chat/channel information
- `messages`: Message storage with translations
- `contacts`: CRM-style contact management
- `scheduled_messages`: Future scheduled sending
- `translation_engines`: Translation service configuration

### API Endpoints

**Authentication**:
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

**Telegram Management**:
- `GET /api/telegram/accounts` - List user's accounts
- `POST /api/telegram/accounts` - Add new account
- `POST /api/telegram/accounts/:id/connect` - Connect account
- `POST /api/telegram/accounts/:id/disconnect` - Disconnect account
- `DELETE /api/telegram/accounts/:id` - Delete account

**Translation**:
- `POST /api/translation/translate` - Translate text
- `GET /api/translation/engines` - List available engines
- `GET /api/translation/languages` - List supported languages

### Real-time Communication

Socket.IO events:
- `new_message`: Real-time message delivery
- `account_connected`: Account connection status
- `account_disconnected`: Account disconnection status
- `join_room`: Join account-specific room
- `leave_room`: Leave account room

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
cd server && npm run build
```

### Environment Variables

Ensure all production environment variables are configured:
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

Logs are stored in:
- `logs/error.log` - Error messages
- `logs/combined.log` - All messages
- Console output in development

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