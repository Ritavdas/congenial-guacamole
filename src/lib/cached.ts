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
import {
  bookmarks,
  tags,
  bookmarkTags,
  collections,
  highlights,
} from "@/db/schema";
import {
  eq,
  and,
  desc,
  inArray,
  isNull,
  sql,
  ilike,
  or,
  lt,
} from "drizzle-orm";

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
  outcomeChip: bookmarks.outcomeChip,
  completionScore: bookmarks.completionScore,
} as const;

export type CountFilter =
  | "all"
  | "favorites"
  | "archived"
  | "unread"
  | "everything";
export type BookmarkFilter =
  | "all"
  | "favorites"
  | "archived"
  | "unread"
  | "everything";

async function attachTagsToBookmarks<T extends { id: string }>(
  rows: T[],
): Promise<(T & { tags: { id: string; name: string; color: string }[] })[]> {
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

export async function getBookmarksCached(
  userId: string,
  filter?: BookmarkFilter,
  tagId?: string,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:bookmarks`);

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
    case "everything":
      break;
    default:
      conditions.push(eq(bookmarks.isArchived, false));
  }

  if (tagId) {
    const taggedBookmarkIds = db
      .select({ bookmarkId: bookmarkTags.bookmarkId })
      .from(bookmarkTags)
      .where(eq(bookmarkTags.tagId, tagId));
    conditions.push(inArray(bookmarks.id, taggedBookmarkIds));
  }

  const rows = await db
    .select(bookmarkLeanCols)
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt));

  return attachTagsToBookmarks(rows);
}

export async function searchBookmarksCached(userId: string, query: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:bookmarks`);

  if (!query.trim()) return [];

  const searchPattern = `%${query}%`;

  const rows = await db
    .select(bookmarkLeanCols)
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        or(
          ilike(bookmarks.title, searchPattern),
          ilike(bookmarks.description, searchPattern),
          ilike(bookmarks.url, searchPattern),
        ),
      ),
    )
    .orderBy(desc(bookmarks.createdAt));

  return attachTagsToBookmarks(rows);
}

export async function getBookmarksPaginatedCached(
  userId: string,
  filter?: BookmarkFilter,
  tagId?: string,
  cursor?: string,
  limit: number = 20,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:bookmarks`);

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
    case "everything":
      break;
    default:
      conditions.push(eq(bookmarks.isArchived, false));
  }

  if (tagId) {
    const taggedBookmarkIds = db
      .select({ bookmarkId: bookmarkTags.bookmarkId })
      .from(bookmarkTags)
      .where(eq(bookmarkTags.tagId, tagId));
    conditions.push(inArray(bookmarks.id, taggedBookmarkIds));
  }

  if (cursor) {
    const [cursorBookmark] = await db
      .select({ createdAt: bookmarks.createdAt })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, cursor), eq(bookmarks.userId, userId)));

    if (cursorBookmark) {
      conditions.push(
        or(
          lt(bookmarks.createdAt, cursorBookmark.createdAt),
          and(
            eq(bookmarks.createdAt, cursorBookmark.createdAt),
            lt(bookmarks.id, cursor),
          ),
        )!,
      );
    }
  }

  const rows = await db
    .select(bookmarkLeanCols)
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .limit(limit + 1);

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    rows.pop();
    nextCursor = rows[rows.length - 1].id;
  }

  if (rows.length === 0) return { items: [], nextCursor: null };

  const items = await attachTagsToBookmarks(rows);
  return { items, nextCursor };
}

export async function searchBookmarksPaginatedCached(
  userId: string,
  query: string,
  cursor?: string,
  limit: number = 20,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:bookmarks`);

  if (!query.trim()) return { items: [], nextCursor: null };

  // Cursor encodes "{rank}:{id}" of the previous page's last row, base64-encoded.
  let cursorRank: number | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, "base64url").toString("utf8");
      const [r, id] = decoded.split(":");
      const parsed = Number(r);
      if (Number.isFinite(parsed) && id) {
        cursorRank = parsed;
        cursorId = id;
      }
    } catch {
      // Invalid cursor → treat as no cursor.
    }
  }

  const conditions = [
    eq(bookmarks.userId, userId),
    sql`${bookmarks.searchVector} @@ plainto_tsquery('english', ${query})`,
  ];

  if (cursorRank !== null && cursorId !== null) {
    // Row-comparison-style filter: (rank, id) < (cursorRank, cursorId) with rank DESC, id DESC.
    conditions.push(
      sql`(ts_rank(${bookmarks.searchVector}, plainto_tsquery('english', ${query})), ${bookmarks.id}) < (${cursorRank}, ${cursorId})`,
    );
  }

  const rankExpr = sql<number>`ts_rank(${bookmarks.searchVector}, plainto_tsquery('english', ${query}))`;

  const rows = await db
    .select({ ...bookmarkLeanCols, rank: rankExpr.as("rank") })
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(sql`rank DESC`, desc(bookmarks.id))
    .limit(limit + 1);

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    rows.pop();
    const last = rows[rows.length - 1];
    nextCursor = Buffer.from(`${last.rank}:${last.id}`, "utf8").toString(
      "base64url",
    );
  }

  if (rows.length === 0) return { items: [], nextCursor: null };

  // Strip the rank field before attaching tags (frontend doesn't need it).
  const stripped = rows.map(({ rank: _rank, ...rest }) => rest);
  const items = await attachTagsToBookmarks(stripped);
  return { items, nextCursor };
}

export async function getTagsForBookmarkCached(
  userId: string,
  bookmarkId: string,
) {
  "use cache";
  cacheLife("hours");
  cacheTag(`bookmark:${bookmarkId}`, `user:${userId}:tags`);

  return db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(
      and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(tags.userId, userId)),
    );
}

export async function getCollectionsCached(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}:collections`);

  return db.select().from(collections).where(eq(collections.userId, userId));
}

export async function getHighlightsCached(userId: string, bookmarkId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`bookmark:${bookmarkId}`);

  return db
    .select()
    .from(highlights)
    .where(
      and(eq(highlights.bookmarkId, bookmarkId), eq(highlights.userId, userId)),
    );
}

export async function getBookmarkStatsCached(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:counts`);

  const allRows = await db
    .select({
      id: bookmarks.id,
      isRead: bookmarks.isRead,
      isFavorite: bookmarks.isFavorite,
      isArchived: bookmarks.isArchived,
      wordCount: bookmarks.wordCount,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId));

  const total = allRows.length;
  const read = allRows.filter((b) => b.isRead).length;
  const favorites = allRows.filter((b) => b.isFavorite).length;
  const unread = allRows.filter((b) => !b.isRead && !b.isArchived).length;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const savedThisWeek = allRows.filter((b) => b.createdAt >= weekAgo).length;

  const totalWords = allRows.reduce((sum, b) => sum + (b.wordCount ?? 0), 0);
  const readingHours = Math.round((totalWords / 200 / 60) * 10) / 10;

  const tagCount = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(tags)
    .where(eq(tags.userId, userId));

  return {
    total,
    read,
    favorites,
    unread,
    savedThisWeek,
    readingHours,
    tagCount: Number(tagCount[0]?.count ?? 0),
  };
}

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
    .select({
      id: bookmarks.id,
      userId: bookmarks.userId,
      url: bookmarks.url,
      title: bookmarks.title,
      description: bookmarks.description,
      ogImage: bookmarks.ogImage,
      content: bookmarks.content,
      htmlContent: bookmarks.htmlContent,
      summary: bookmarks.summary,
      wordCount: bookmarks.wordCount,
      domain: bookmarks.domain,
      isRead: bookmarks.isRead,
      isArchived: bookmarks.isArchived,
      isFavorite: bookmarks.isFavorite,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
      outcomeChip: bookmarks.outcomeChip,
      completionScore: bookmarks.completionScore,
    })
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
    case "everything":
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

type ExtensionCheckRow = {
  id: string;
  title: string | null;
  domain: string | null;
  created_at: string;
  tags: { id: string; name: string; color: string }[] | null;
};

export async function getBookmarkByUrlCached(
  userId: string,
  normalizedUrl: string,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:url-check`, `user:${userId}:bookmarks`);

  const rows = await db.execute<ExtensionCheckRow>(sql`
    WITH bm AS (
      SELECT b.id, b.title, b.domain, b.created_at
      FROM bookmarks b
      WHERE b.user_id = ${userId}
        AND lower(regexp_replace(b.url, '/+$', '')) = ${normalizedUrl}
      LIMIT 1
    )
    SELECT bm.id, bm.title, bm.domain, bm.created_at,
      COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FROM bookmark_tags bt
        INNER JOIN tags t ON bt.tag_id = t.id
        WHERE bt.bookmark_id = bm.id
      ), '[]'::json) AS tags
    FROM bm
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    domain: row.domain,
    createdAt: new Date(row.created_at),
    tags: row.tags ?? [],
  };
}

export async function getTagsWithCountForExtensionCached(userId: string) {
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

  return userTags
    .map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      bookmarkCount: countMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.bookmarkCount - a.bookmarkCount);
}

export async function getEnrichStatusCached(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:enrich-status`, `user:${userId}:bookmarks`);

  const [result] = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        isNull(bookmarks.ogImage),
        isNull(bookmarks.description),
        isNull(bookmarks.content),
      ),
    );

  return { unenriched: Number(result?.count ?? 0) };
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
