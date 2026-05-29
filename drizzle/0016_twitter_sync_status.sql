CREATE TABLE IF NOT EXISTS "twitter_sync_status" (
  "user_id" text PRIMARY KEY,
  "ran_at" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL,
  "imported" integer NOT NULL DEFAULT 0,
  "skipped" integer NOT NULL DEFAULT 0,
  "pages_fetched" integer NOT NULL DEFAULT 0,
  "error_message" text
);
