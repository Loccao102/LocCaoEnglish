CREATE TABLE IF NOT EXISTS ielts_writing_attempts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS writing_owner_updated ON ielts_writing_attempts(user_id,updated_at DESC);
