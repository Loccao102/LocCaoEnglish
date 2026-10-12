-- Additive: old clears remain legacy. Never synthesize evidence for old scores.
-- Progression originally shipped through API startup schema. Support a database
-- initialized only from numbered migrations as well as existing installations.
CREATE TABLE IF NOT EXISTS player_bosses (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boss_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, boss_id)
);
ALTER TABLE player_bosses ADD COLUMN IF NOT EXISTS evidence JSONB;
