-- Run this to add full-text search index for bookmarks
-- Usage: psql $DATABASE_URL -f scripts/add-search-index.sql

CREATE INDEX IF NOT EXISTS idx_bookmarks_fts ON bookmarks USING GIN (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(url, '') || ' ' || coalesce(content, ''))
);
