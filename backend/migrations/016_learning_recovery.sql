ALTER TABLE learning_attempts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}';
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS progression_applied BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS learning_request_owner ON learning_attempts ((COALESCE(user_id,'')),request_id);
CREATE TABLE IF NOT EXISTS learning_daily_rewards (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  content_version TEXT NOT NULL,
  reward_day DATE NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES learning_attempts(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,item_key,content_version,reward_day)
);
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS grading_source TEXT NOT NULL DEFAULT 'legacy-client';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT '';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT '';
