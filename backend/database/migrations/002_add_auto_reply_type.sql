-- Add 'auto_reply' to message_type enum
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'auto_reply';
