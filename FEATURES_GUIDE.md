# Message Templates & Scheduled Messages Features

This guide explains the new features added to the Telegram Translator App: **Message Templates** and **Scheduled Messages** (Auto Follow-up).

## Features Overview

### 1. Message Templates
Quick message templates for greeting and replies that can be easily reused in conversations.

**Features:**
- Create, edit, and delete message templates
- Quick access to templates in chat window
- Copy template content to message input with one click
- Manage templates through a dedicated modal

### 2. Scheduled Messages (Auto Follow-up)
Automatically send follow-up messages after X days of silence from the recipient.

**Features:**
- Schedule messages to be sent after a specified number of days
- Automatic cancellation when recipient responds
- View scheduled messages in conversation
- Edit or cancel scheduled messages
- Background scheduler service that runs continuously

## Installation & Setup

### 1. Database Migration

Run the migration script to add the required database tables:

```bash
cd backend
python migrate_add_templates_scheduled.py
```

This will create:
- `message_templates` table
- `scheduled_messages` table
- Required indexes

### 2. Backend Dependencies

All required dependencies are already in `requirements.txt`. No additional packages needed.

### 3. Frontend Dependencies

All required dependencies are already in `package.json`. No additional packages needed.

## Usage Guide

### Message Templates

#### Creating Templates

1. Click the **"Manage"** button in the chat window (next to the Templates button)
2. Click **"Create New Template"**
3. Enter a name and content for your template
4. Click **"Save"**

#### Using Templates

1. Click the **"Templates"** button in the chat window
2. Select a template from the dropdown
3. The template content will be copied to the message input
4. Edit if needed and send

#### Managing Templates

1. Click the **"Manage"** button
2. Edit: Click the edit icon next to any template
3. Delete: Click the trash icon next to any template

### Scheduled Messages

#### Scheduling a Message

1. Select a conversation
2. Click the **purple clock icon** next to the send button
3. Enter your message text
4. Set the number of days to wait before sending
5. Click **"Schedule Message"**

#### Viewing Scheduled Messages

Scheduled messages appear at the top of the chat window with:
- Blue notification banner
- Message preview
- Days until sending
- Cancel button

#### Automatic Cancellation

Scheduled messages are **automatically cancelled** when:
- The recipient sends you a message
- You manually cancel the scheduled message

This prevents sending follow-up messages to people who have already responded.

## API Endpoints

### Message Templates

```
GET    /api/templates                    - Get all templates
GET    /api/templates/{id}               - Get specific template
POST   /api/templates                    - Create template
PUT    /api/templates/{id}               - Update template
DELETE /api/templates/{id}               - Delete template
```

### Scheduled Messages

```
GET    /api/scheduled-messages                        - Get all scheduled messages
GET    /api/scheduled-messages/conversation/{id}     - Get by conversation
POST   /api/scheduled-messages                        - Create scheduled message
PUT    /api/scheduled-messages/{id}                   - Update scheduled message
DELETE /api/scheduled-messages/{id}                   - Cancel scheduled message
```

## Database Schema

### message_templates

```sql
CREATE TABLE message_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### scheduled_messages

```sql
CREATE TABLE scheduled_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
```

## Architecture

### Backend Components

1. **Models** (`models.py`)
   - `MessageTemplateCreate`, `MessageTemplateUpdate`, `MessageTemplateResponse`
   - `ScheduledMessageCreate`, `ScheduledMessageUpdate`, `ScheduledMessageResponse`

2. **Routes**
   - `/app/features/templates/routes.py` - Template CRUD operations
   - `/app/features/scheduled/routes.py` - Scheduled message operations

3. **Scheduler Service** (`scheduler_service.py`)
   - Background task that checks for messages to send every 30 seconds
   - Loads scheduled messages on startup
   - Sends messages via Telethon when scheduled time arrives
   - Handles automatic cancellation on incoming messages

### Frontend Components

1. **Modals**
   - `MessageTemplatesModal.tsx` - Manage templates
   - `ScheduleMessageModal.tsx` - Schedule new messages

2. **ChatWindow Updates**
   - Template selector dropdown
   - Schedule message button
   - Scheduled messages display
   - Integration with modals

3. **API Services** (`services/api.ts`)
   - `templatesAPI` - Template operations
   - `scheduledMessagesAPI` - Scheduled message operations

## Use Cases

### Sales Outreach Example

1. **First Contact**
   - Use template: "Initial Greeting"
   - Send to prospect

2. **No Response After 3 Days**
   - Schedule follow-up: "Just checking in..."
   - Set delay: 3 days

3. **No Response After 7 Days**
   - Schedule another follow-up: "Last chance offer..."
   - Set delay: 7 days (from now)

4. **Prospect Responds**
   - All scheduled messages automatically cancelled
   - Continue normal conversation

## Configuration

### Scheduler Settings

Edit `scheduler_service.py` to adjust:

```python
self.check_interval = 30  # Check every 30 seconds
```

### Translation

Scheduled messages are automatically translated using the account's configured languages before sending.

## Troubleshooting

### Scheduled Messages Not Sending

1. Check backend logs for errors
2. Verify scheduler service is running: Look for "Scheduler service started" in logs
3. Check database for scheduled messages: `SELECT * FROM scheduled_messages WHERE is_sent = FALSE AND is_cancelled = FALSE`

### Templates Not Loading

1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check authentication token is valid

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check database connection string in `.env`
3. Run migration script if tables don't exist

## Security Considerations

- All API endpoints require authentication
- Users can only access their own templates
- Users can only schedule messages for their own conversations
- Scheduled messages are tied to conversation ownership

## Performance

- Scheduler checks every 30 seconds (configurable)
- Scheduled messages are loaded into memory on startup
- Minimal database queries during operation
- Automatic cleanup of sent/cancelled messages

## Future Enhancements

Potential improvements:
- Template categories/folders
- Template variables (e.g., {name}, {company})
- Recurring scheduled messages
- A/B testing for templates
- Analytics on template usage
- Scheduled message sequences (drip campaigns)
