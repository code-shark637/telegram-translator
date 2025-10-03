# Telegram Translator Setup Guide

Complete setup guide for the Telegram Translator application with FastAPI backend.

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Telegram account and API credentials
- Supabase account (database already configured)

## Step 1: Get Telegram API Credentials

1. Visit https://my.telegram.org
2. Log in with your phone number
3. Navigate to "API development tools"
4. Create a new application with these details:
   - App title: Telegram Translator
   - Short name: tg-translator
   - Platform: Desktop
   - Description: Multi-account telegram translator
5. Copy your `api_id` and `api_hash`

## Step 2: Configure Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Update the `.env` file with your credentials:
```env
SUPABASE_URL=https://qkfmkyulfrzwiimjapmr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZm1reXVsZnJ6d2lpbWphcG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQxNTYsImV4cCI6MjA3NTA1MDE1Nn0.7UVxN77Wo6Z4WzrxHgsOuADhZvWuQPA1Nw0Ht9yPO6o
DATABASE_URL=postgresql://postgres.qkfmkyulfrzwiimjapmr:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

JWT_SECRET_KEY=your-very-long-random-secret-key-change-this
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

TELEGRAM_API_ID=YOUR_API_ID_HERE
TELEGRAM_API_HASH=YOUR_API_HASH_HERE

FRONTEND_URL=http://localhost:5173
```

Important:
- Replace `YOUR-PASSWORD` with your Supabase database password
- Replace `YOUR_API_ID_HERE` with your Telegram API ID
- Replace `YOUR_API_HASH_HERE` with your Telegram API hash
- Generate a secure random string for `JWT_SECRET_KEY`

## Step 3: Install Dependencies

### Backend (Python)
```bash
cd backend
pip install -r requirements.txt
```

### Frontend (Node.js)
```bash
cd ..
npm install
```

## Step 4: Database Setup

The database schema has already been applied to your Supabase instance. To verify:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to Table Editor
4. You should see these tables:
   - users
   - telegram_accounts
   - conversations
   - messages
   - contacts
   - scheduled_messages
   - translation_engines

## Step 5: Start the Application

### Option 1: Start Both Frontend and Backend Together
```bash
npm run dev
```

This will start:
- FastAPI backend on http://localhost:8000
- React frontend on http://localhost:5173

### Option 2: Start Separately

Backend:
```bash
npm run dev:backend
# or
cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:
```bash
npm run dev:client
# or
npm run dev
```

## Step 6: First Time Usage

1. Open http://localhost:5173 in your browser
2. Register a new account (username and password)
3. Log in with your credentials
4. Add your first Telegram account

## Adding Telegram Accounts

### Method 1: Using Telegram Desktop TData

1. Open Telegram Desktop
2. Go to Settings → Advanced → Export Telegram data
3. Or locate your TData folder:
   - Windows: `%APPDATA%\Telegram Desktop\tdata`
   - macOS: `~/Library/Application Support/Telegram Desktop/tdata`
   - Linux: `~/.local/share/TelegramDesktop/tdata`

4. In the app, click "Add Account"
5. Upload the TData folder or files
6. Set your preferred source and target languages
7. Click "Connect"

### Method 2: Using Phone Number (Fresh Login)

1. Click "Add Account"
2. Enter a session name (e.g., "main_account")
3. Enter your phone number (with country code, e.g., +1234567890)
4. You'll receive a login code via Telegram
5. Enter the code to complete authentication

### Method 3: Using Session String

If you have a Telethon session string from another application:

1. Click "Add Account"
2. Enter session name
3. Paste the session string
4. Click "Connect"

## How It Works

### Real-Time Translation Flow

**Incoming Messages:**
1. Someone sends you a message on Telegram
2. Backend receives the message via Telethon
3. Message is automatically translated to your target language
4. Both original and translated versions are stored in database
5. WebSocket pushes update to your browser in real-time
6. You see the original message with translation subtitle

**Outgoing Messages:**
1. You type a message in your language
2. Message is translated to recipient's language
3. Only translated message is sent to Telegram
4. Both versions stored in database
5. Recipient sees only the translated message
6. They don't know you're using translation

### Language Settings

Each Telegram account has:
- **Source Language**: Your language (what you type in)
- **Target Language**: Language for translation (what they see)

You can have different language settings for each account.

## Testing the Setup

### 1. Test Backend API
```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 2. Test User Registration
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'
```

### 3. Test WebSocket Connection

Open browser console at http://localhost:5173 and check for:
```
WebSocket connected
```

## Troubleshooting

### Backend Won't Start

**Error: Module not found**
```bash
cd backend
pip install -r requirements.txt
```

**Error: Database connection failed**
- Check your DATABASE_URL in .env
- Verify Supabase project is active
- Check your database password

**Error: Telegram API error**
- Verify api_id and api_hash are correct
- Check you're not exceeding API limits
- Try regenerating API credentials

### Frontend Won't Start

**Error: npm install failed**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Error: Port 5173 already in use**
```bash
# Kill the process
lsof -ti:5173 | xargs kill -9
# Or use different port
PORT=3000 npm run dev:client
```

### Cannot Add Telegram Account

**Session not authorized**
- Phone number format must include country code (+1234567890)
- TData files must be from Telegram Desktop
- Session string must be valid Telethon format

**Connection timeout**
- Check your internet connection
- Verify Telegram isn't blocked by firewall
- Try with different Telegram account

### Messages Not Appearing

**WebSocket disconnected**
- Check browser console for errors
- Verify JWT token is valid
- Try logging out and back in

**Translation not working**
- Check backend logs for translation errors
- Verify Google Translate isn't rate-limiting
- Check source/target languages are valid

## Production Deployment

### Backend

1. Set production environment variables
2. Use production-grade ASGI server:
```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

3. Set up reverse proxy (nginx):
```nginx
location /api {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /ws {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Frontend

```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

## Security Notes

- Never commit `.env` files to version control
- Use strong passwords for user accounts
- Rotate JWT secret keys regularly
- Keep Telegram API credentials secure
- Enable HTTPS in production
- Set up proper CORS policies
- Regular database backups

## Support

For issues or questions:
1. Check backend logs: Look for errors in terminal
2. Check frontend console: Open browser DevTools
3. Review API documentation: http://localhost:8000/docs
4. Check Supabase logs in dashboard

## Next Steps

After setup:
- Add multiple Telegram accounts
- Test real-time translation
- Customize language settings per account
- Explore conversation management
- Plan CRM features integration
