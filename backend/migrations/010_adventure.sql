-- Also applied idempotently by Store.EnsureAdventure at API startup.
CREATE TABLE IF NOT EXISTS player_adventures (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  save JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
