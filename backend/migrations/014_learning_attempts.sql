CREATE TABLE IF NOT EXISTS learning_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  activity TEXT NOT NULL,
  item_key TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  content_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  correct_answer TEXT NOT NULL,
  feedback TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  submitted_answer TEXT NOT NULL DEFAULT '',
  correct BOOLEAN NOT NULL DEFAULT FALSE,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  result_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  result_level INTEGER NOT NULL DEFAULT 0,
  review_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE(user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_created
  ON learning_attempts(user_id, created_at DESC);
