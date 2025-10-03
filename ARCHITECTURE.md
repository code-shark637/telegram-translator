# Telegram Translator - System Architecture

## Overview

Multi-account Telegram translator system with real-time message translation. Built with React frontend, FastAPI backend, Telethon for Telegram integration, and local PostgreSQL for data persistence.

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **WebSocket API** - Real-time updates
- **React Router** - Navigation
- **js-cookie** - Cookie management

### Backend
- **FastAPI** - Web framework
- **Python 3.9+** - Language
- **Telethon** - Telegram client library
- **asyncpg** - PostgreSQL async driver
- **python-jose** - JWT handling
- **passlib** - Password hashing
- **googletrans** - Translation service
- **uvicorn** - ASGI server

### Database
- **PostgreSQL** - Relational database (local or managed)
- **Row Level Security** - Data isolation (recommended for production)

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Auth    │  │ Accounts │  │  Chat    │  │ Messages │   │
│  │  Pages   │  │  Manager │  │ Interface│  │  List    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              │                       │                      │
│         ┌────▼────┐          ┌──────▼──────┐              │
│         │   HTTP  │          │  WebSocket  │              │
│         │  Client │          │   Client    │              │
│         └────┬────┘          └──────┬──────┘              │
└──────────────┼──────────────────────┼────────────────────┘
               │                      │
        ┌──────▼──────────────────────▼──────┐
        │           Internet                  │
        └──────┬──────────────────────┬──────┘
               │                      │
┌──────────────▼──────────────────────▼────────────────────┐
│                       Backend (FastAPI)                   │
│                                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │    Auth    │  │  Telegram  │  │  Messages  │        │
│  │   Routes   │  │   Routes   │  │   Routes   │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
│        │               │               │                │
│  ┌─────▼───────────────▼───────────────▼──────┐        │
│  │          Route Layer / Middleware            │        │
│  └─────┬────────────────────────────────┬──────┘        │
│        │                                 │               │
│  ┌─────▼─────────┐    ┌────────────────▼─────┐         │
│  │   JWT Auth    │    │   WebSocket Manager   │         │
│  └─────┬─────────┘    └────────────────┬─────┘         │
│        │                                │               │
│  ┌─────▼────────────────────────────────▼─────────┐    │
│  │              Core Services                      │    │
│  │                                                 │    │
│  │  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │   Telethon   │  │ Translation  │           │    │
│  │  │   Service    │  │   Service    │           │    │
│  │  │              │  │              │           │    │
│  │  │ ┌──────────┐ │  │ ┌──────────┐ │           │    │
│  │  │ │ Session  │ │  │ │  Google  │ │           │    │
│  │  │ │ Manager  │ │  │ │ Translate│ │           │    │
│  │  │ └────┬─────┘ │  │ └──────────┘ │           │    │
│  │  └──────┼───────┘  └──────────────┘           │    │
│  │         │                                      │    │
│  │  ┌──────▼──────────────────────────────────┐  │    │
│  │  │      Database Connection Pool           │  │    │
│  │  │           (asyncpg)                     │  │    │
│  │  └──────┬──────────────────────────────────┘  │    │
│  └─────────┼─────────────────────────────────────┘    │
└────────────┼──────────────────────────────────────────┘
             │
      ┌──────▼──────┐        ┌────────────────┐
      │  Telegram   │        │  PostgreSQL    │
      └─────────────┘        └────────────────┘
```

## Core Components

### 1. Authentication System

**Frontend (`useAuth` hook)**
- Manages authentication state
- Stores JWT in cookies
- Auto-refreshes user data
- Handles login/register/logout

**Backend (`auth.py`)**
- JWT token generation and validation
- Password hashing with bcrypt
- Token expiration management
- Route protection middleware

**Flow:**
1. User submits credentials
2. Backend validates and returns JWT
3. Frontend stores token in cookie
4. Token included in all API requests
5. Backend validates token on each request

### 2. Telegram Integration (Telethon)

**Session Management (`telethon_service.py`)**
- Maintains 30+ active Telegram sessions
- Handles session creation from TData or string
- Manages connection lifecycle
- Event-driven message handling

**Key Classes:**
- `TelegramSession`: Represents single Telegram account
- `TelethonService`: Manages all sessions globally

**Session States:**
- Disconnected: Session exists but not connected
- Connecting: Authentication in progress
- Connected: Actively receiving messages
- Error: Connection failed

**Message Flow:**
```
Telegram Server
     │
     ▼
Telethon Client
     │
     ▼
Event Handler (New Message)
     │
     ├─► Translate Message
     │        │
     │        ▼
     ├─► Store in Database
     │        │
     │        ▼
     └─► Broadcast via WebSocket
```

### 3. Real-Time Communication (WebSocket)

**Connection Management (`websocket_manager.py`)**
- Per-user WebSocket connections
- Message broadcasting to specific users
- Connection health monitoring
- Automatic reconnection support

**Protocol:**
```json
// Ping/Pong (heartbeat)
Client: { "type": "ping" }
Server: { "type": "pong" }

// New Message Event
Server: {
  "type": "new_message",
  "account_id": 123,
  "message": {
    "id": 456,
    "conversation_id": 789,
    "original_text": "Hello",
    "translated_text": "Hola",
    ...
  }
}
```

### 4. Translation Service

**Google Translate Integration (`translation_service.py`)**
- Automatic language detection
- Text translation
- Error handling and fallbacks

**Translation Pipeline:**
1. Receive text and target language
2. Detect source language (if auto)
3. Call Google Translate API
4. Return original and translated text
5. Cache common translations (future)

### 5. Database Layer

**Schema Design:**

**Users Table**
- Authentication and user management
- One-to-many with telegram_accounts

**Telegram Accounts Table**
- Account configurations
- Language preferences
- Session metadata

**Conversations Table**
- Telegram chats/channels
- Linked to specific account
- Track last message time

**Messages Table**
- Full message history
- Both original and translated text
- Timestamps for sorting

**Security:**
- Row Level Security (RLS) on all tables
- User can only access their own data
- Cascade deletes for data integrity

## Data Flow Examples

### Adding New Telegram Account

```
Frontend                    Backend                  Database
   │                           │                         │
   │ POST /api/telegram/       │                         │
   │  accounts                 │                         │
   ├──────────────────────────►│                         │
   │                           │                         │
   │                           │ Insert telegram_        │
   │                           │  accounts               │
   │                           ├────────────────────────►│
   │                           │                         │
   │                           │ Create Telethon         │
   │                           │  Session                │
   │                           │                         │
   │                           │ Connect to Telegram     │
   │                           ├─────────────────►       │
   │                           │             Telegram    │
   │                           │             Servers     │
   │                           │                         │
   │◄──────────────────────────┤                         │
   │ {account_id, connected}   │                         │
   │                           │                         │
```

### Receiving Telegram Message

```
Telegram     Telethon      Translation    Database    WebSocket    Frontend
Servers       Service        Service                   Manager
   │             │               │            │            │           │
   │ New Message │               │            │            │           │
   ├────────────►│               │            │            │           │
   │             │               │            │            │           │
   │             │ Translate     │            │            │           │
   │             ├──────────────►│            │            │           │
   │             │               │            │            │           │
   │             │◄──────────────┤            │            │           │
   │             │ {original,    │            │            │           │
   │             │  translated}  │            │            │           │
   │             │               │            │            │           │
   │             │               │ Store      │            │           │
   │             │               │ Message    │            │           │
   │             ├───────────────┴───────────►│            │           │
   │             │                            │            │           │
   │             │               Broadcast    │            │           │
   │             ├────────────────────────────┴───────────►│           │
   │             │                                         │           │
   │             │                                         │ Push      │
   │             │                                         ├──────────►│
   │             │                                         │  Message  │
   │             │                                         │           │
```

### Sending Message with Translation

```
Frontend    Backend     Translation    Telethon     Database    Telegram
                        Service        Service                  Servers
   │           │            │              │            │           │
   │ Send      │            │              │            │           │
   │ Message   │            │              │            │           │
   ├──────────►│            │              │            │           │
   │           │            │              │            │           │
   │           │ Translate  │              │            │           │
   │           ├───────────►│              │            │           │
   │           │            │              │            │           │
   │           │◄───────────┤              │            │           │
   │           │ Translated │              │            │           │
   │           │            │              │            │           │
   │           │            │ Send to      │            │           │
   │           │            │ Telegram     │            │           │
   │           ├────────────┴─────────────►│            │           │
   │           │                           │            │           │
   │           │                           │ API Call   │           │
   │           │                           ├───────────────────────►│
   │           │                           │            │           │
   │           │                           │◄───────────────────────┤
   │           │                           │  Sent      │           │
   │           │                           │            │           │
   │           │            Store Message  │            │           │
   │           ├───────────────────────────┴───────────►│           │
   │           │                                        │           │
   │◄──────────┤                                        │           │
   │ Success   │                                        │           │
```

## Extension Architecture

### Future Features - Plugin Points

**1. Scheduled Messages**
```python
# backend/services/scheduler_service.py
class SchedulerService:
    async def schedule_message(
        self,
        account_id: int,
        conversation_id: int,
        text: str,
        schedule_at: datetime
    ):
        # Add to scheduled_messages table
        # Background task will process
        pass
```

**2. Automatic Follow-ups**
```python
# backend/services/followup_service.py
class FollowupService:
    async def check_conversations(self):
        # Find conversations with no reply > X days
        # Send automated follow-up
        pass
```

**3. CRM Features**
```python
# backend/routes/contacts.py
@router.post("/contacts/{contact_id}/tags")
async def add_tags(contact_id: int, tags: List[str]):
    # Add tags to contact for organization
    pass

@router.post("/contacts/{contact_id}/notes")
async def add_note(contact_id: int, note: str):
    # Add CRM note
    pass
```

**4. Multiple Translation Engines**
```python
# backend/services/translation_service.py
class TranslationService:
    def __init__(self):
        self.engines = {
            'google': GoogleTranslator(),
            'deepl': DeepLTranslator(),
            'azure': AzureTranslator(),
        }

    async def translate(self, text, target, engine='google'):
        return await self.engines[engine].translate(text, target)
```

## Performance Considerations

### Concurrency
- FastAPI runs on asyncio event loop
- Non-blocking I/O for all operations
- Connection pooling for database (30 connections)
- Each Telegram session runs independently

### Scalability
- Horizontal scaling: Multiple backend instances
- Load balancing: Nginx/HAProxy
- Session affinity: WebSocket connections
- Database: Read replicas for queries

### Optimization Opportunities
1. **Translation Caching**: Cache frequent translations
2. **Message Batching**: Batch database inserts
3. **CDN**: Static assets via CDN
4. **Compression**: Enable gzip/brotli
5. **Database Indexes**: Optimize query performance

## Security Model

### Authentication & Authorization
- JWT tokens with expiration
- HTTPOnly cookies for token storage
- Route-level authentication middleware
- Role-based access control (future)

### Data Protection
- Row Level Security (RLS) in PostgreSQL
- User data isolation
- Encrypted database connections
- API key encryption in database

### Input Validation
- Pydantic models for request validation
- SQL injection prevention (parameterized queries)
- XSS prevention (React escaping)
- Rate limiting (future)

## Monitoring & Logging

### Backend Logging
```python
# Structured logging with context
logger.info("User login", {
    "user_id": user.id,
    "ip": request.client.host,
    "success": True
})
```

### Metrics to Track
- Active WebSocket connections
- Active Telegram sessions
- Translation API usage
- Database query performance
- Message throughput

### Error Handling
- Centralized error handlers
- User-friendly error messages
- Detailed server logs
- Error reporting (future: Sentry)

## Development Workflow

### Local Development
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2: Frontend
npm run dev:client
```

### Testing Strategy
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for critical flows
- Load testing for concurrent sessions

### Code Organization
```
backend/
  ├── main.py              # FastAPI application
  ├── config.py            # Configuration
  ├── database.py          # DB connection
  ├── models.py            # Pydantic models
  ├── auth.py              # Authentication
  ├── routes_*.py          # API routes
  ├── telethon_service.py  # Telegram integration
  ├── translation_service.py  # Translation
  └── websocket_manager.py # WebSocket handling

frontend/
  ├── src/
  │   ├── components/      # React components
  │   ├── hooks/          # Custom hooks
  │   ├── services/       # API clients
  │   └── types/          # TypeScript types
```

## Deployment Architecture

### Production Setup
```
Internet
   │
   ▼
[Load Balancer]
   │
   ├──► [Backend Instance 1] ──┐
   ├──► [Backend Instance 2] ──┼──► [PostgreSQL]
   └──► [Backend Instance 3] ──┘
   │
   └──► [Frontend CDN]
```

### Environment Configuration
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

### Backup Strategy
- Daily database backups
- Session file backups
- Configuration backups
- Rollback procedures

## Conclusion

This architecture provides:
- **Scalability**: Handle 30+ concurrent Telegram sessions
- **Extensibility**: Easy to add new features
- **Maintainability**: Clear separation of concerns
- **Security**: Multi-layer security model
- **Performance**: Async I/O for high throughput
- **Reliability**: Error handling and recovery
