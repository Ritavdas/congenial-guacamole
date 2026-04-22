import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const host = new URL(url.replace("postgresql://", "http://")).host;
console.log(`DB host: ${host}`);

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const out = await fn();
  console.log(`  ${label}: ${Date.now() - t}ms`);
  return out;
}

async function run() {
  const sql = postgres(url, { prepare: false, max: 1 });

  // Network/connection cold start
  console.log("\n=== Cold connect + trivial query ===");
  await timed("SELECT 1 (cold)", () => sql`SELECT 1`);
  await timed("SELECT 1 (warm 1)", () => sql`SELECT 1`);
  await timed("SELECT 1 (warm 2)", () => sql`SELECT 1`);
  await timed("SELECT 1 (warm 3)", () => sql`SELECT 1`);

  // Pick a real user + tag
  console.log("\n=== Pick a sample user + tag ===");
  const userRow = await timed(
    "find any user with bookmarks",
    () =>
      sql`SELECT user_id, COUNT(*)::int AS n FROM bookmarks GROUP BY user_id ORDER BY n DESC LIMIT 1`,
  );
  if (userRow.length === 0) {
    console.log("No bookmarks in DB. Aborting.");
    await sql.end();
    return;
  }
  const userId: string = userRow[0].user_id;
  console.log(`  userId=${userId} (${userRow[0].n} bookmarks)`);

  const tagRow = await timed(
    "find tag with most bookmarks for user",
    () => sql`
      SELECT t.id, t.name, COUNT(bt.bookmark_id)::int AS n
      FROM tags t
      LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
      WHERE t.user_id = ${userId}
      GROUP BY t.id, t.name
      ORDER BY n DESC
      LIMIT 1
    `,
  );
  if (tagRow.length === 0) {
    console.log("No tags. Aborting.");
    await sql.end();
    return;
  }
  const tagId: string = tagRow[0].id;
  console.log(`  tag=${tagRow[0].name} id=${tagId} (${tagRow[0].n} bookmarks)`);

  // Replicate getBookmarksByTag exactly
  console.log("\n=== Run getBookmarksByTag (1st pass) ===");
  await runGetBookmarksByTag(sql, userId, tagId);

  console.log("\n=== Run getBookmarksByTag (2nd pass — warm) ===");
  await runGetBookmarksByTag(sql, userId, tagId);

  console.log("\n=== Run getBookmarksByTag (3rd pass — warm) ===");
  await runGetBookmarksByTag(sql, userId, tagId);

  // Compare: skinny SELECT (no content/html_content/summary)
  console.log("\n=== Skinny SELECT bookmarks (no content/html/summary) ===");
  await runSkinny(sql, userId, tagId);

  // Single-query alternative
  console.log("\n=== One-shot single query (CTE) ===");
  await runOneShot(sql, userId, tagId);

  // Payload size
  console.log("\n=== Payload size comparison ===");
  await measurePayloadSizes(sql, userId, tagId);

  await sql.end();
}

async function runGetBookmarksByTag(
  sql: postgres.Sql,
  userId: string,
  tagId: string,
) {
  const overall = Date.now();

  await timed(
    "Q1 tag lookup",
    () =>
      sql`SELECT * FROM tags WHERE id = ${tagId} AND user_id = ${userId} LIMIT 1`,
  );

  const taggedIds = await timed(
    "Q2 tagged ids",
    () => sql`SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ${tagId}`,
  );

  const ids = taggedIds.map((r: any) => r.bookmark_id);
  if (ids.length === 0) {
    console.log("  (no bookmarks)");
    return;
  }

  const rows = await timed(
    `Q3 SELECT * FROM bookmarks (n=${ids.length})`,
    () => sql`
      SELECT * FROM bookmarks
      WHERE user_id = ${userId} AND id = ANY(${ids}::uuid[])
      ORDER BY created_at DESC
    `,
  );

  const bIds = rows.map((r: any) => r.id);
  await timed(
    `Q4 bookmark_tags join (n=${bIds.length})`,
    () => sql`
      SELECT bt.bookmark_id, t.id AS tag_id, t.name, t.color
      FROM bookmark_tags bt
      INNER JOIN tags t ON bt.tag_id = t.id
      WHERE bt.bookmark_id = ANY(${bIds}::uuid[])
    `,
  );

  console.log(`  TOTAL: ${Date.now() - overall}ms`);
}

async function runSkinny(sql: postgres.Sql, userId: string, tagId: string) {
  const overall = Date.now();
  const rows = await timed(
    "Skinny bookmarks select",
    () => sql`
      SELECT b.id, b.url, b.title, b.og_image, b.word_count, b.domain,
             b.is_read, b.is_favorite, b.created_at
      FROM bookmarks b
      INNER JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      WHERE bt.tag_id = ${tagId} AND b.user_id = ${userId}
      ORDER BY b.created_at DESC
    `,
  );
  const bIds = rows.map((r: any) => r.id);
  await timed(
    `Tags for ${bIds.length} bookmarks`,
    () => sql`
      SELECT bt.bookmark_id, t.id AS tag_id, t.name, t.color
      FROM bookmark_tags bt
      INNER JOIN tags t ON bt.tag_id = t.id
      WHERE bt.bookmark_id = ANY(${bIds}::uuid[])
    `,
  );
  console.log(`  TOTAL: ${Date.now() - overall}ms`);
}

async function runOneShot(sql: postgres.Sql, userId: string, tagId: string) {
  const overall = Date.now();
  await timed(
    "single CTE query",
    () => sql`
      WITH tag_row AS (
        SELECT id, name, color FROM tags
        WHERE id = ${tagId} AND user_id = ${userId} LIMIT 1
      ),
      bm AS (
        SELECT b.id, b.url, b.title, b.og_image, b.word_count, b.domain,
               b.is_read, b.is_favorite, b.created_at
        FROM bookmarks b
        INNER JOIN bookmark_tags bt ON bt.bookmark_id = b.id
        WHERE bt.tag_id = ${tagId} AND b.user_id = ${userId}
        ORDER BY b.created_at DESC
      )
      SELECT
        (SELECT row_to_json(tag_row.*) FROM tag_row) AS tag,
        COALESCE(json_agg(row_to_json(bm.*)), '[]'::json) AS bookmarks
      FROM bm
    `,
  );
  console.log(`  TOTAL: ${Date.now() - overall}ms`);
}

async function measurePayloadSizes(
  sql: postgres.Sql,
  userId: string,
  tagId: string,
) {
  const fat = await sql`
    SELECT b.* FROM bookmarks b
    INNER JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    WHERE bt.tag_id = ${tagId} AND b.user_id = ${userId}
  `;
  const skinny = await sql`
    SELECT b.id, b.url, b.title, b.og_image, b.word_count, b.domain,
           b.is_read, b.is_favorite, b.created_at
    FROM bookmarks b
    INNER JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    WHERE bt.tag_id = ${tagId} AND b.user_id = ${userId}
  `;
  const fatBytes = Buffer.byteLength(JSON.stringify(fat));
  const skinnyBytes = Buffer.byteLength(JSON.stringify(skinny));
  console.log(
    `  fat SELECT *  : ${(fatBytes / 1024).toFixed(1)} KB (n=${fat.length})`,
  );
  console.log(`  skinny SELECT : ${(skinnyBytes / 1024).toFixed(1)} KB`);
  console.log(
    `  ratio         : ${(fatBytes / Math.max(skinnyBytes, 1)).toFixed(1)}x larger`,
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
