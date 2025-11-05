-- Auto-responder rules table (global rules for all accounts)
CREATE TABLE IF NOT EXISTS auto_responder_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  keywords TEXT[] NOT NULL, -- Array of keywords/phrases to detect
  response_text TEXT NOT NULL,
  media_type VARCHAR(20), -- 'photo', 'video', or NULL
  media_file_path TEXT, -- Path to the media file if attached
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0, -- Higher priority rules are checked first
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_responder_rules_user ON auto_responder_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_responder_rules_active ON auto_responder_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_responder_rules_priority ON auto_responder_rules(user_id, priority DESC);

-- Auto-responder logs (track when rules are triggered)
CREATE TABLE IF NOT EXISTS auto_responder_logs (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT NOT NULL REFERENCES auto_responder_rules(id) ON DELETE CASCADE,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  incoming_message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  outgoing_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  matched_keyword TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_responder_logs_rule ON auto_responder_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_auto_responder_logs_conversation ON auto_responder_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_auto_responder_logs_triggered_at ON auto_responder_logs(triggered_at);
