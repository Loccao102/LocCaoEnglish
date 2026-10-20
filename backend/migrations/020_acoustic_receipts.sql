CREATE TABLE IF NOT EXISTS speaking_assessments (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 attempt_id TEXT NOT NULL REFERENCES learning_attempts(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS speaking_assessment_owner ON speaking_assessments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS speaking_assessment_attempt ON speaking_assessments(user_id,attempt_id,created_at DESC);
