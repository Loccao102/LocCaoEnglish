-- Additive, owner-scoped receipts make authenticated review scheduling retry-safe.
-- There is intentionally no review_items foreign key: a receipt remains
-- recoverable after the underlying queue item is removed.
CREATE TABLE IF NOT EXISTS review_schedule_receipts(
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 item_key TEXT NOT NULL,
 quality INTEGER NOT NULL CHECK(quality >= 0 AND quality <= 5),
 rules_version TEXT NOT NULL,
 expected_due_at TIMESTAMPTZ NOT NULL,
 scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 due_at TIMESTAMPTZ NOT NULL,
 interval_days INTEGER NOT NULL,
 ease DOUBLE PRECISION NOT NULL,
 failures INTEGER NOT NULL,
 PRIMARY KEY(owner_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_review_schedule_receipts_owner ON review_schedule_receipts(owner_id,scheduled_at DESC);
