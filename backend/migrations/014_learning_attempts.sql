CREATE TABLE IF NOT EXISTS learning_attempts (
 id TEXT PRIMARY KEY,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 snapshot JSONB NOT NULL,
 submission JSONB,
 verdict JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS learning_request_owner ON learning_attempts ((COALESCE(user_id,'')),request_id);
CREATE TABLE IF NOT EXISTS learning_daily_rewards (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 content_id TEXT NOT NULL,
 content_version INTEGER NOT NULL,
 reward_day DATE NOT NULL,
 attempt_id TEXT NOT NULL REFERENCES learning_attempts(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,content_id,content_version,reward_day)
);
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS grading_source TEXT NOT NULL DEFAULT 'legacy-client';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rules_version INTEGER NOT NULL DEFAULT 0;
