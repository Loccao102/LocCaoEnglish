ALTER TABLE learning_attempts
  ADD COLUMN IF NOT EXISTS skill TEXT NOT NULL DEFAULT 'Vocabulary';

UPDATE learning_attempts
SET skill = CASE
  WHEN activity = 'grammar-repair' THEN 'Grammar'
  ELSE skill
END;
