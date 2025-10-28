-- Add media fields to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS media_file_path TEXT,
ADD COLUMN IF NOT EXISTS media_file_name TEXT,
ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS media_file_size BIGINT,
ADD COLUMN IF NOT EXISTS media_thumbnail_path TEXT,
ADD COLUMN IF NOT EXISTS is_outgoing BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for media queries
CREATE INDEX IF NOT EXISTS idx_messages_media ON messages(conversation_id, type) WHERE type IN ('photo', 'video', 'document');
