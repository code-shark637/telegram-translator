# Quick Start: Message Templates & Scheduled Messages

## 🚀 Getting Started in 3 Steps

### Step 1: Run Database Migration

```bash
cd backend
python migrate_add_templates_scheduled.py
```

Expected output:
```
Connecting to database...
Creating message_templates table...
Creating scheduled_messages table...
Migration completed successfully!
Database connection closed.
```

### Step 2: Restart Backend Server

The scheduler service will start automatically when the backend starts.

```bash
# If using uvicorn directly:
cd backend
uvicorn main:app --reload

# Or if using the run script:
python main.py
```

Look for this in the logs:
```
Starting scheduler service...
Loaded X scheduled messages
Scheduler service started
Application startup complete
```

### Step 3: Use the Features!

#### Create Your First Template

1. Open the app in your browser
2. Select a conversation
3. Click **"Manage"** button (next to Templates)
4. Click **"Create New Template"**
5. Name: "Greeting"
6. Content: "Hi! How are you doing?"
7. Click **"Save"**

#### Schedule Your First Message

1. Select a conversation
2. Click the **purple clock icon** (⏰) next to the send button
3. Enter message: "Just following up on my previous message"
4. Set days: 3
5. Click **"Schedule Message"**

You'll see a blue notification at the top of the chat showing the scheduled message!

## 📋 Quick Reference

### Message Templates
- **Access**: Click "Templates" button in chat
- **Manage**: Click "Manage" button in chat
- **Use**: Select from dropdown, content copies to input

### Scheduled Messages
- **Create**: Click purple clock icon (⏰)
- **View**: Blue banner at top of chat
- **Cancel**: Click "Cancel" on the notification
- **Auto-cancel**: Happens automatically when recipient responds

## ⚠️ Important Notes

1. **Scheduler runs every 30 seconds** - messages may be delayed by up to 30 seconds
2. **Auto-cancellation** - scheduled messages are cancelled when recipient responds
3. **Translation** - scheduled messages are automatically translated before sending
4. **Persistence** - scheduled messages survive server restarts

## 🔍 Troubleshooting

### Migration fails
- Check PostgreSQL is running
- Verify database connection in `.env`
- Check user has CREATE TABLE permissions

### Scheduler not starting
- Check backend logs for errors
- Verify migration completed successfully
- Restart backend server

### Templates not loading
- Check browser console for errors
- Verify you're logged in
- Check API endpoints are accessible

## 📚 More Information

- **Full Guide**: See `FEATURES_GUIDE.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **API Documentation**: See `backend/API.md`

## 🎉 That's It!

You're ready to use message templates and scheduled messages for your sales outreach and follow-ups!
