import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

async function main() {
  console.log("Creating full-text search GIN index...");
  await sql`
    CREATE INDEX IF NOT EXISTS idx_bookmarks_fts ON bookmarks USING GIN (
      to_tsvector('english',
        coalesce(title, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(url, '') || ' ' ||
        coalesce(content, ''))
    )
  `;
  console.log("✅ GIN index created successfully.");
  await sql.end();
}

main().catch((err) => {
  console.error("❌ Failed to create index:", err.message);
  process.exit(1);
});
