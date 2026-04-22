-- Partial index to make the "unenriched bookmarks" COUNT(*) microsecond-fast.
-- Used by getEnrichStatusCached / GET /api/enrich/status.
CREATE INDEX IF NOT EXISTS "bookmarks_user_unenriched_idx"
  ON "bookmarks" ("user_id")
  WHERE "og_image" IS NULL AND "description" IS NULL AND "content" IS NULL;
