-- Additive optimistic-concurrency snapshot for review scheduling. Existing
-- pre-v1 rows are anchored to their recorded due_at and remain readable.
ALTER TABLE review_schedule_receipts ADD COLUMN IF NOT EXISTS expected_due_at TIMESTAMPTZ;
UPDATE review_schedule_receipts SET expected_due_at=due_at WHERE expected_due_at IS NULL;
ALTER TABLE review_schedule_receipts ALTER COLUMN expected_due_at SET NOT NULL;
