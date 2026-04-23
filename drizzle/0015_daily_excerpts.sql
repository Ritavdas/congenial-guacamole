CREATE TABLE IF NOT EXISTS daily_excerpts (
  user_id text NOT NULL,
  date date NOT NULL,
  bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  excerpt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS daily_excerpts_user_idx ON daily_excerpts(user_id, date DESC);
