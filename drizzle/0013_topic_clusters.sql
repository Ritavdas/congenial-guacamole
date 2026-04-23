CREATE TABLE IF NOT EXISTS topic_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  label text,
  centroid vector(1536) NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS topic_clusters_user_idx ON topic_clusters(user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS bookmark_topics (
  bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  topic_cluster_id uuid NOT NULL REFERENCES topic_clusters(id) ON DELETE CASCADE,
  distance real NOT NULL,
  PRIMARY KEY (bookmark_id, topic_cluster_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bookmark_topics_cluster_idx ON bookmark_topics(topic_cluster_id);
