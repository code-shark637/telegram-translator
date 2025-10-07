-- PostgreSQL schema for Telegram Translator (local Postgres)

-- Users
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

-- Telegram accounts
CREATE TABLE IF NOT EXISTS telegram_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  app_id BIGINT NOT NULL,
  app_hash VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_language VARCHAR(16) NOT NULL DEFAULT 'auto',
  target_language VARCHAR(16) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_accounts_user_display_name ON telegram_accounts(user_id, display_name);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user ON telegram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_last_used ON telegram_accounts(last_used);

-- Conversation type enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type') THEN
    CREATE TYPE conversation_type AS ENUM ('private', 'group', 'supergroup', 'channel');
  END IF;
END $$;

-- Conversations
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_account_peer ON conversations(telegram_account_id, telegram_peer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);

-- Message type enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE message_type AS ENUM ('text', 'photo', 'video', 'voice', 'document', 'sticker', 'system');
  END IF;
END $$;

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  telegram_message_id BIGINT,
  sender_user_id BIGINT,
  sender_name VARCHAR(100) NOT NULL,
  sender_username VARCHAR(100) NOT NULL,
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

-- Contacts (for future CRM)
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_user_telegram ON contacts(user_id, telegram_user_id);

-- Scheduled messages (infrastructure)
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

-- Translation engines (future multi-engine config)
CREATE TABLE IF NOT EXISTS translation_engines (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  api_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_translation_engines_user_name ON translation_engines(user_id, name);


