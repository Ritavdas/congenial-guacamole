CREATE TABLE "bookmark_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "bookmark_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "bookmark_events_kind_check" CHECK (
    "kind" IN (
      'opened',
      'scroll_25',
      'scroll_50',
      'scroll_75',
      'scroll_100',
      'marked_read',
      'finished_inferred'
    )
  ),
  CONSTRAINT "bookmark_events_bookmark_id_fk" FOREIGN KEY ("bookmark_id")
    REFERENCES "bookmarks"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "bookmark_events_bookmark_id_idx"
  ON "bookmark_events" ("bookmark_id");
--> statement-breakpoint
CREATE INDEX "bookmark_events_user_bookmark_kind_idx"
  ON "bookmark_events" ("user_id", "bookmark_id", "kind");
--> statement-breakpoint
-- Dedup at DB level: at most one finished_inferred per (user, bookmark).
CREATE UNIQUE INDEX "bookmark_events_finished_inferred_uniq"
  ON "bookmark_events" ("user_id", "bookmark_id")
  WHERE "kind" = 'finished_inferred';
