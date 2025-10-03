/*
  # Telegram Translator Database Schema

  ## Overview
  Complete database schema for multi-account Telegram translator with real-time message translation.

  ## New Tables

  ### 1. users
  - `id` (bigserial, primary key) - User ID
  - `username` (varchar) - Unique username for login
  - `password_hash` (text) - Bcrypt hashed password
  - `email` (varchar) - Optional email address
  - `is_active` (boolean) - Account active status
  - `created_at` (timestamptz) - Registration timestamp
  - `last_login` (timestamptz) - Last login timestamp

  ### 2. telegram_accounts
  - `id` (bigserial, primary key) - Account ID
  - `user_id` (bigint) - Reference to users table
  - `session_name` (varchar) - Unique session identifier
  - `account_name` (varchar) - Display name for the account
  - `phone_number` (varchar) - Telegram phone number
  - `is_active` (boolean) - Account active status
  - `source_language` (varchar) - Default source language for translation
  - `target_language` (varchar) - Default target language for translation
  - `created_at` (timestamptz) - Account creation timestamp
  - `last_used` (timestamptz) - Last activity timestamp

  ### 3. conversations
  - `id` (bigserial, primary key) - Conversation ID
  - `telegram_account_id` (bigint) - Reference to telegram_accounts
  - `telegram_peer_id` (bigint) - Telegram peer/chat ID
  - `title` (text) - Chat/channel title
  - `type` (enum) - Conversation type (private, group, supergroup, channel)
  - `is_archived` (boolean) - Archive status
  - `created_at` (timestamptz) - First message timestamp
  - `last_message_at` (timestamptz) - Last message timestamp

  ### 4. messages
  - `id` (bigserial, primary key) - Message ID
  - `conversation_id` (bigint) - Reference to conversations
  - `telegram_message_id` (bigint) - Telegram message ID
  - `sender_user_id` (bigint) - Telegram sender user ID
  - `type` (enum) - Message type (text, photo, video, etc.)
  - `original_text` (text) - Original message text
  - `translated_text` (text) - Translated message text
  - `source_language` (varchar) - Detected/specified source language
  - `target_language` (varchar) - Target translation language
  - `created_at` (timestamptz) - Message creation timestamp
  - `edited_at` (timestamptz) - Message edit timestamp

  ### 5. contacts
  - `id` (bigserial, primary key) - Contact ID
  - `user_id` (bigint) - Reference to users
  - `telegram_user_id` (bigint) - Telegram user ID
  - `display_name` (text) - Contact display name
  - `phone` (varchar) - Contact phone number
  - `is_favorite` (boolean) - Favorite status
  - `is_blocked` (boolean) - Blocked status
  - `tags` (text[]) - Custom tags for CRM
  - `notes` (text) - CRM notes
  - `created_at` (timestamptz) - Contact creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 6. scheduled_messages
  - `id` (bigserial, primary key) - Scheduled message ID
  - `telegram_account_id` (bigint) - Reference to telegram_accounts
  - `conversation_id` (bigint) - Reference to conversations
  - `text` (text) - Message text to send
  - `schedule_at` (timestamptz) - Scheduled send time
  - `is_sent` (boolean) - Sent status
  - `created_at` (timestamptz) - Creation timestamp
  - `sent_at` (timestamptz) - Actual send timestamp

  ### 7. translation_engines
  - `id` (bigserial, primary key) - Engine ID
  - `user_id` (bigint) - Reference to users
  - `name` (varchar) - Engine name (google, deepl, etc.)
  - `api_key` (text) - API key for the engine
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on all tables
  - Policies for user-specific data access
  - Cascade deletes for data integrity

  ## Indexes
  - Performance indexes on foreign keys
  - Indexes on frequently queried columns
  - Unique constraints on session names and usernames
*/

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::text::bigint = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text::bigint = id)
  WITH CHECK (auth.uid()::text::bigint = id);

CREATE TABLE IF NOT EXISTS telegram_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_language VARCHAR(16) NOT NULL DEFAULT 'auto',
  target_language VARCHAR(16) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_accounts_user_session 
  ON telegram_accounts(user_id, session_name);

CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user ON telegram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_last_used ON telegram_accounts(last_used);

ALTER TABLE telegram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own telegram accounts"
  ON telegram_accounts FOR ALL
  TO authenticated
  USING (auth.uid()::text::bigint = user_id)
  WITH CHECK (auth.uid()::text::bigint = user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type') THEN
    CREATE TYPE conversation_type AS ENUM ('private', 'group', 'supergroup', 'channel');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  telegram_account_id BIGINT NOT NULL REFERENCES telegram_accounts(id) ON DELETE CASCADE,
  telegram_peer_id BIGINT NOT NULL,
  title TEXT,
  type conversation_type NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_account_peer 
  ON conversations(telegram_account_id, telegram_peer_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own conversations"
  ON conversations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM telegram_accounts
      WHERE telegram_accounts.id = conversations.telegram_account_id
      AND telegram_accounts.user_id = auth.uid()::text::bigint
    )
  );

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE message_type AS ENUM ('text', 'photo', 'video', 'voice', 'document', 'sticker', 'system');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  telegram_message_id BIGINT,
  sender_user_id BIGINT,
  type message_type NOT NULL DEFAULT 'text',
  original_text TEXT,
  translated_text TEXT,
  source_language VARCHAR(16),
  target_language VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own messages"
  ON messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN telegram_accounts ta ON c.telegram_account_id = ta.id
      WHERE c.id = messages.conversation_id
      AND ta.user_id = auth.uid()::text::bigint
    )
  );

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT,
  display_name TEXT NOT NULL,
  phone VARCHAR(32),
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_user_telegram 
  ON contacts(user_id, telegram_user_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contacts"
  ON contacts FOR ALL
  TO authenticated
  USING (auth.uid()::text::bigint = user_id)
  WITH CHECK (auth.uid()::text::bigint = user_id);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_account_id BIGINT NOT NULL REFERENCES telegram_accounts(id) ON DELETE CASCADE,
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  schedule_at TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due ON scheduled_messages(is_sent, schedule_at);

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled messages"
  ON scheduled_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM telegram_accounts
      WHERE telegram_accounts.id = scheduled_messages.telegram_account_id
      AND telegram_accounts.user_id = auth.uid()::text::bigint
    )
  );

CREATE TABLE IF NOT EXISTS translation_engines (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  api_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_translation_engines_user_name 
  ON translation_engines(user_id, name);

ALTER TABLE translation_engines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own translation engines"
  ON translation_engines FOR ALL
  TO authenticated
  USING (auth.uid()::text::bigint = user_id)
  WITH CHECK (auth.uid()::text::bigint = user_id);
