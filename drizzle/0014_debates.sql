CREATE TABLE IF NOT EXISTS "debates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "topic" text,
  "bookmark_ids" text[] NOT NULL,
  "transcript" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "debates_status_check" CHECK (
    "status" IN ('pending', 'running', 'complete', 'failed')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debates_user_created_idx"
  ON "debates" ("user_id", "created_at" DESC);
