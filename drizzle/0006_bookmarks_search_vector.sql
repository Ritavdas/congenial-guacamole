-- Add stored generated tsvector column for full-text search across title, description, url, content.
-- 'A'/'B'/'C'/'D' weights bias rank toward title > description > url > content.
ALTER TABLE "bookmarks"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("url", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'D')
  ) STORED;
--> statement-breakpoint
CREATE INDEX "bookmarks_search_vector_idx" ON "bookmarks" USING gin ("search_vector");
