-- PostgreSQL schema for Telegram Translator
-- Run with: psql -d telegram_translator -f server/src/database/schema.sql

-- Safe create: create schema in a transaction
BEGIN;

-- Enable extensions if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables in reverse dependency order (idempotent re-run)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS translation_engines CASCADE;
DROP TABLE IF EXISTS telegram_accounts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- USERS
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- TELEGRAM ACCOUNTS
CREATE TABLE telegram_accounts (
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

-- A user cannot have duplicate session names
CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_accounts_user_session 
  ON telegram_accounts(user_id, session_name);

CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user ON telegram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_last_used ON telegram_accounts(last_used);

-- CONVERSATIONS (chats/channels)
-- Represents a dialog or channel per telegram account
CREATE TYPE conversation_type AS ENUM ('private', 'group', 'supergroup', 'channel');

CREATE TABLE conversations (
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

-- MESSAGES
-- Store original and translated message content
CREATE TYPE message_type AS ENUM ('text', 'photo', 'video', 'voice', 'document', 'sticker', 'system');

CREATE TABLE messages (
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

-- CONTACTS (for future CRM features)
CREATE TABLE contacts (
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

-- SCHEDULED MESSAGES
CREATE TABLE scheduled_messages (
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

-- TRANSLATION ENGINES
CREATE TABLE translation_engines (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  api_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_translation_engines_user_name 
  ON translation_engines(user_id, name);

COMMIT; 