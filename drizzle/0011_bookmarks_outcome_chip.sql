ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS outcome_chip text,
  ADD COLUMN IF NOT EXISTS outcome_chip_model text,
  ADD COLUMN IF NOT EXISTS outcome_chip_at timestamptz;
