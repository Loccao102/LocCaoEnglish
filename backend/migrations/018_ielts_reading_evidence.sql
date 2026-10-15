-- Existing estimates retain their rows and source text. No receipt is invented.
CREATE TABLE IF NOT EXISTS ielts_attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,section TEXT NOT NULL,test_type TEXT NOT NULL DEFAULT 'academic',raw_score INTEGER,max_score INTEGER,band DOUBLE PRECISION NOT NULL,source TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ielts_attempts_user_created ON ielts_attempts(user_id,created_at DESC);
ALTER TABLE ielts_attempts ADD COLUMN IF NOT EXISTS attempt_id TEXT REFERENCES learning_attempts(id) ON DELETE CASCADE;
ALTER TABLE ielts_attempts ADD COLUMN IF NOT EXISTS receipt JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS ielts_attempt_receipt ON ielts_attempts(attempt_id) WHERE attempt_id IS NOT NULL;
