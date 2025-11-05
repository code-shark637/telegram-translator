-- Add language field to auto_responder_rules
ALTER TABLE auto_responder_rules ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';
