-- Add encryption support to the system
-- This migration adds:
-- 1. System settings table for encryption configuration
-- 2. is_encrypted column to messages table

-- Create system settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  encryption_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  encryption_enabled_at TIMESTAMPTZ,
  encryption_disabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50) DEFAULT 'admin',
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert default settings row
INSERT INTO system_settings (id, encryption_enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Add is_encrypted column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for encrypted messages queries
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(is_encrypted);

-- Add comment to explain the encryption column
COMMENT ON COLUMN messages.is_encrypted IS 'Indicates whether the original_text and translated_text fields are encrypted with AES-256';

-- Add comment to system_settings table
COMMENT ON TABLE system_settings IS 'Global system configuration settings including encryption mode';
