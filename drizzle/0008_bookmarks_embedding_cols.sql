-- Embedding columns for bookmarks.
-- No ANN index in this migration: exact cosine over a user's filtered subset
-- is fast for thousands of rows. Add ivfflat/HNSW partial index later if needed.
ALTER TABLE "bookmarks"
  ADD COLUMN "embedding" vector(1536),
  ADD COLUMN "embedding_model" text,
  ADD COLUMN "embedding_input_hash" text,
  ADD COLUMN "embedded_at" timestamp;
