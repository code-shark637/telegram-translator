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

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_templates_user ON message_templates(user_id);

-- Scheduled Messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
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
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_conversation ON scheduled_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_at ON scheduled_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(is_sent, is_cancelled, scheduled_at);

-- Contact CRM Information
CREATE TABLE IF NOT EXISTS contact_info (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  name VARCHAR(255),
  address TEXT,
  telephone VARCHAR(50),
  telegram_id VARCHAR(100),
  telegram_id2 VARCHAR(100),
  signal_id VARCHAR(100),
  signal_id2 VARCHAR(100),
  product_interest TEXT,
  sales_volume VARCHAR(100),
  ready_for_sample BOOLEAN DEFAULT FALSE,
  sample_recipient_info TEXT,
  sample_feedback TEXT,
  payment_method VARCHAR(100),
  delivery_method VARCHAR(100),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_info_conversation ON contact_info(conversation_id);
