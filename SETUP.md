# Telegram Translator Setup Guide

Complete setup guide for the Telegram Translator application with FastAPI backend.

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Telegram account and API credentials
- Local PostgreSQL 13+

## Step 1: Prepare Telegram Desktop tdata (.zip)

Ensure you already have your Telegram Desktop `tdata` exported as a `.zip` file. You'll upload this zip in the app. You don't need to configure `api_id`/`api_hash` manually; they are read from `tdata`.

## Step 2: Configure Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create or update the `.env` file with your local settings:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/telegram_translator

JWT_SECRET_KEY=your-very-long-random-secret-key-change-this
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

FRONTEND_URL=http://localhost:5173
```

Important:
- Replace `YOUR-PASSWORD` with your local Postgres password
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

Create the database locally:

1. Create database:
```sql
CREATE DATABASE telegram_translator;
```

2. Ensure your Postgres user has access:
```sql
GRANT ALL PRIVILEGES ON DATABASE telegram_translator TO postgres;
```

3. Apply schema:
```bash
psql -d telegram_translator -h localhost -U postgres -f backend/database/schema.sql
```

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
```

### Verify everything works

1. Open `http://localhost:5173` and sign up/sign in
2. Health check: `curl http://localhost:8000/api/health`
3. API docs: open `http://localhost:8000/docs`

## Step 6: First Time Usage

1. Open http://localhost:5173 in your browser
2. Register a new account (username and password)
3. Log in with your credentials
4. Add your first Telegram account

## Adding Telegram Accounts

### Using Telegram Desktop tdata (.zip)

1. In the app, click "Add Account"
2. Upload your `tdata` `.zip` file
3. Set your preferred source and target languages
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
- **Source Language**: Language for translation (what they see)
- **Target Language**: Your language (what you type in)

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

Connect to `ws://localhost:8000/ws?token=YOUR_JWT_TOKEN`. Heartbeat: send `{ "type": "ping" }`, expect `{ "type": "pong" }`.

## Troubleshooting

### Backend Won't Start

**Error: Module not found**
```bash
cd backend
pip install -r requirements.txt
```

**Error: Database connection failed**
- Check your DATABASE_URL in .env
- Verify PostgreSQL is running locally
- Check your database password

**Error: Telegram API error**
- Verify `tdata` contains valid API credentials
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
- `tdata` zip must be exported from Telegram Desktop
- Zip should contain the `tdata` directory and expected files
- Ensure the zip is not password-protected or corrupted

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
4. Check PostgreSQL logs

## Next Steps

After setup:
- Add multiple Telegram accounts
- Test real-time translation
- Customize language settings per account
- Explore conversation management
