-- Additive: preserve existing claims and classify absent receipts as legacy.
CREATE TABLE IF NOT EXISTS daily_claims(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day DATE NOT NULL,reward_xp INTEGER NOT NULL DEFAULT 50,claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,day));
ALTER TABLE daily_claims ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT 'legacy-unverified';
ALTER TABLE daily_claims ADD COLUMN IF NOT EXISTS receipt JSONB;
CREATE TABLE IF NOT EXISTS daily_plans(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day DATE NOT NULL,snapshot JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,day));
CREATE INDEX IF NOT EXISTS learning_completed_day ON learning_attempts(user_id,completed_at) WHERE status='completed';
