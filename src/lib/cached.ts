// @no-test-required — pure cached read helpers, exercised via integration tests.
//
// IMPORTANT: This file MUST NOT have a top-level "use server" directive.
// Functions here use the React/Next.js "use cache" directive which is
// incompatible with Server Actions.
//
// Public Server Actions in src/lib/actions.ts call auth() to derive userId,
// then forward to these `*Cached(userId, ...)` helpers. The helpers receive
// only primitive, JSON-serializable arguments so the cache key is stable.

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { bookmarks, tags, bookmarkTags } from "@/db/schema";
import { eq, and, desc, inArray, isNull, sql } from "drizzle-orm";

// Lean projection: every column from `bookmarks` except the heavy reader-only
// fields (content, htmlContent, summary). List views never render those.
const bookmarkLeanCols = {
  id: bookmarks.id,
  userId: bookmarks.userId,
  url: bookmarks.url,
  title: bookmarks.title,
  description: bookmarks.description,
  ogImage: bookmarks.ogImage,
  wordCount: bookmarks.wordCount,
  domain: bookmarks.domain,
  isRead: bookmarks.isRead,
  isArchived: bookmarks.isArchived,
  isFavorite: bookmarks.isFavorite,
  createdAt: bookmarks.createdAt,
  updatedAt: bookmarks.updatedAt,
} as const;

export type CountFilter = "all" | "favorites" | "archived" | "unread";

export async function getTagsCached(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}:tags`);

  return db.select().from(tags).where(eq(tags.userId, userId));
}

export async function getTagsWithCountCached(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}:tags`);

  const userTags = await db.select().from(tags).where(eq(tags.userId, userId));
  if (userTags.length === 0) return [];

  const tagIds = userTags.map((t) => t.id);
  const counts = await db
    .select({
      tagId: bookmarkTags.tagId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(bookmarkTags)
    .where(inArray(bookmarkTags.tagId, tagIds))
    .groupBy(bookmarkTags.tagId);

  const countMap = new Map(counts.map((c) => [c.tagId, Number(c.count)]));

  return userTags.map((t) => ({
    ...t,
    bookmarkCount: countMap.get(t.id) ?? 0,
  }));
}

export async function getBookmarkByIdCached(userId: string, id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`bookmark:${id}`);

  const [bookmark] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  return bookmark ?? null;
}

export async function getBookmarkCountCached(
  userId: string,
  filter?: CountFilter,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:counts`);

  const conditions = [eq(bookmarks.userId, userId)];

  switch (filter) {
    case "favorites":
      conditions.push(eq(bookmarks.isFavorite, true));
      break;
    case "archived":
      conditions.push(eq(bookmarks.isArchived, true));
      break;
    case "unread":
      conditions.push(eq(bookmarks.isRead, false));
      break;
    default:
      conditions.push(eq(bookmarks.isArchived, false));
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(bookmarks)
    .where(and(...conditions));

  return Number(result?.count ?? 0);
}

export async function getRecentBookmarksCached(userId: string, limit = 5) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:bookmarks`);

  const rows = await db
    .select(bookmarkLeanCols)
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.isArchived, false)))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const bookmarkIds = rows.map((b) => b.id);
  const tagRows = await db
    .select({
      bookmarkId: bookmarkTags.bookmarkId,
      tagId: tags.id,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(inArray(bookmarkTags.bookmarkId, bookmarkIds));

  const tagsByBookmark = new Map<
    string,
    { id: string; name: string; color: string }[]
  >();
  for (const row of tagRows) {
    const arr = tagsByBookmark.get(row.bookmarkId) ?? [];
    arr.push({ id: row.tagId, name: row.tagName, color: row.tagColor });
    tagsByBookmark.set(row.bookmarkId, arr);
  }

  return rows.map((b) => ({ ...b, tags: tagsByBookmark.get(b.id) ?? [] }));
}

export async function getUnreadBookmarksCached(userId: string, limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:bookmarks`);

  const rows = await db
    .select(bookmarkLeanCols)
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.isRead, false),
        eq(bookmarks.isArchived, false),
      ),
    )
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit);

  return rows;
}

export async function getTagBucketsCached(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}:tags`, `user:${userId}:bookmarks`);

  const tagRows = await db.execute<{
    id: string;
    name: string;
    color: string;
    created_at: string;
    bookmark_count: string;
    last_activity: string | null;
  }>(sql`
    SELECT t.id, t.name, t.color, t.created_at,
           COUNT(bt.bookmark_id) AS bookmark_count,
           MAX(b.created_at) AS last_activity
    FROM tags t
    LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
    LEFT JOIN bookmarks b ON bt.bookmark_id = b.id AND b.user_id = ${userId}
    WHERE t.user_id = ${userId}
    GROUP BY t.id, t.name, t.color, t.created_at
    ORDER BY last_activity DESC NULLS LAST
  `);

  const recentRows = await db.execute<{
    tag_id: string;
    title: string | null;
    domain: string | null;
    og_image: string | null;
  }>(sql`
    SELECT tag_id, title, domain, og_image FROM (
      SELECT bt.tag_id, b.title, b.domain, b.og_image, b.created_at,
             ROW_NUMBER() OVER (PARTITION BY bt.tag_id ORDER BY b.created_at DESC) AS rn
      FROM bookmark_tags bt
      INNER JOIN bookmarks b ON bt.bookmark_id = b.id
      WHERE b.user_id = ${userId}
    ) ranked
    WHERE rn <= 3
  `);

  const recentByTag = new Map<
    string,
    { title: string | null; domain: string | null; ogImage: string | null }[]
  >();
  for (const row of recentRows) {
    let arr = recentByTag.get(row.tag_id);
    if (!arr) {
      arr = [];
      recentByTag.set(row.tag_id, arr);
    }
    arr.push({ title: row.title, domain: row.domain, ogImage: row.og_image });
  }

  const buckets = tagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    bookmarkCount: Number(tag.bookmark_count),
    recentTitles: recentByTag.get(tag.id) ?? [],
    lastActivity: tag.last_activity
      ? new Date(tag.last_activity)
      : new Date(tag.created_at),
  }));

  const [untaggedRow] = await db.execute<{
    count: string;
    latest_title: string | null;
    latest_domain: string | null;
    latest_og_image: string | null;
  }>(sql`
    SELECT COUNT(*) AS count,
           (SELECT b2.title FROM bookmarks b2
            LEFT JOIN bookmark_tags bt2 ON b2.id = bt2.bookmark_id
            WHERE b2.user_id = ${userId} AND b2.is_archived = false AND bt2.bookmark_id IS NULL
            ORDER BY b2.created_at DESC LIMIT 1) AS latest_title,
           (SELECT b3.domain FROM bookmarks b3
            LEFT JOIN bookmark_tags bt3 ON b3.id = bt3.bookmark_id
            WHERE b3.user_id = ${userId} AND b3.is_archived = false AND bt3.bookmark_id IS NULL
            ORDER BY b3.created_at DESC LIMIT 1) AS latest_domain,
           (SELECT b4.og_image FROM bookmarks b4
            LEFT JOIN bookmark_tags bt4 ON b4.id = bt4.bookmark_id
            WHERE b4.user_id = ${userId} AND b4.is_archived = false AND bt4.bookmark_id IS NULL
            ORDER BY b4.created_at DESC LIMIT 1) AS latest_og_image
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    WHERE b.user_id = ${userId} AND b.is_archived = false AND bt.bookmark_id IS NULL
  `);

  const untaggedCount = Number(untaggedRow?.count ?? 0);
  const latestUntagged =
    untaggedCount > 0 && untaggedRow
      ? {
          title: untaggedRow.latest_title,
          domain: untaggedRow.latest_domain,
          ogImage: untaggedRow.latest_og_image,
        }
      : null;

  return { tagBuckets: buckets, untaggedCount, latestUntagged };
}

type BookmarkByTagRow = {
  id: string;
  url: string;
  title: string | null;
  ogImage: string | null;
  domain: string | null;
  wordCount: number | null;
  isFavorite: boolean;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
  tags: { id: string; name: string; color: string }[];
};

type TagRecord = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export async function getBookmarksByTagCached(userId: string, tagId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`tag:${tagId}`, `user:${userId}:bookmarks`);

  const rows = await db.execute<{
    tag: TagRecord | null;
    bookmarks: BookmarkByTagRow[] | null;
  }>(sql`
    WITH bm AS (
      SELECT b.id, b.url, b.title, b.og_image, b.domain, b.word_count,
             b.is_favorite, b.is_read, b.is_archived, b.created_at
      FROM bookmarks b
      INNER JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      WHERE bt.tag_id = ${tagId} AND b.user_id = ${userId}
    ),
    bm_tags AS (
      SELECT bt.bookmark_id,
             json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) AS tags
      FROM bookmark_tags bt
      INNER JOIN tags t ON bt.tag_id = t.id
      WHERE bt.bookmark_id IN (SELECT id FROM bm)
      GROUP BY bt.bookmark_id
    )
    SELECT
      (SELECT row_to_json(t.*) FROM tags t WHERE t.id = ${tagId} AND t.user_id = ${userId}) AS tag,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', bm.id,
          'url', bm.url,
          'title', bm.title,
          'ogImage', bm.og_image,
          'domain', bm.domain,
          'wordCount', bm.word_count,
          'isFavorite', bm.is_favorite,
          'isRead', bm.is_read,
          'isArchived', bm.is_archived,
          'createdAt', bm.created_at,
          'tags', COALESCE(bm_tags.tags, '[]'::json)
        ) ORDER BY bm.created_at DESC)
        FROM bm LEFT JOIN bm_tags ON bm_tags.bookmark_id = bm.id
      ), '[]'::json) AS bookmarks
  `);

  const row = rows[0];
  if (!row?.tag) throw new Error("Tag not found");

  const tag = {
    id: row.tag.id,
    userId: row.tag.user_id,
    name: row.tag.name,
    color: row.tag.color,
    createdAt: new Date(row.tag.created_at),
  };

  const bookmarkRows = (row.bookmarks ?? []).map((b) => ({
    ...b,
    createdAt: new Date(b.createdAt),
  }));

  return { tag, bookmarks: bookmarkRows };
}

export async function getUntaggedBookmarksCached(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}:bookmarks`, `user:${userId}:untagged`);

  const rows = await db
    .select({
      id: bookmarks.id,
      userId: bookmarks.userId,
      url: bookmarks.url,
      title: bookmarks.title,
      description: bookmarks.description,
      ogImage: bookmarks.ogImage,
      wordCount: bookmarks.wordCount,
      domain: bookmarks.domain,
      isRead: bookmarks.isRead,
      isArchived: bookmarks.isArchived,
      isFavorite: bookmarks.isFavorite,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
    })
    .from(bookmarks)
    .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.isArchived, false),
        isNull(bookmarkTags.bookmarkId),
      ),
    )
    .orderBy(desc(bookmarks.createdAt));

  return rows.map((b) => ({
    ...b,
    tags: [] as { id: string; name: string; color: string }[],
  }));
}
