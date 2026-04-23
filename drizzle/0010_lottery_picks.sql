CREATE TABLE IF NOT EXISTS "lottery_picks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "bookmark_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "picked_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "settled_at" timestamptz,
  CONSTRAINT "lottery_picks_status_check" CHECK (
    "status" IN ('active', 'read', 'expired', 'skipped')
  ),
  CONSTRAINT "lottery_picks_bookmark_id_fk" FOREIGN KEY ("bookmark_id")
    REFERENCES "bookmarks"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lottery_picks_user_status_idx"
  ON "lottery_picks" ("user_id", "status");
--> statement-breakpoint
-- Enforce at most one active lottery pick per user (prevents double-spin races).
CREATE UNIQUE INDEX IF NOT EXISTS "lottery_picks_one_active_per_user"
  ON "lottery_picks" ("user_id")
  WHERE "status" = 'active';
