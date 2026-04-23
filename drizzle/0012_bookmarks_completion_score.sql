ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS completion_score real,
  ADD COLUMN IF NOT EXISTS completion_score_at timestamptz;
CREATE INDEX IF NOT EXISTS bookmarks_completion_score_idx ON bookmarks(user_id, completion_score) WHERE is_archived = false;
