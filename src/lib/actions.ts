// @no-test-required — server actions tested via integration tests in __tests__/pipelines/
"use server";

import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { db } from "@/db";
import {
  bookmarks,
  bookmarkEvents,
  tags,
  bookmarkTags,
  collections,
  bookmarkCollections,
  highlights,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  revalidatePath,
  revalidateTag,
  updateTag as updateCacheTag,
} from "next/cache";
import { extractMetadata } from "@/lib/extract";
import { enqueueEmbedding } from "@/lib/embeddings";
import { generateOutcomeChip } from "@/lib/outcome";
import { recomputeAllScores } from "@/lib/completion-score";
import { drawLottery, settleLottery } from "@/lib/lottery";
import { rebuildClusters } from "@/lib/clustering";
import { redirect } from "next/navigation";
import {
  getTagsCached,
  getTagsWithCountCached,
  getBookmarkByIdCached,
  getBookmarkCountCached,
  getRecentBookmarksCached,
  getUnreadBookmarksCached,
  getTagBucketsCached,
  getBookmarksByTagCached,
  getUntaggedBookmarksCached,
  getBookmarksCached,
  searchBookmarksCached,
  getBookmarksPaginatedCached,
  searchBookmarksPaginatedCached,
  getTagsForBookmarkCached,
  getCollectionsCached,
  getHighlightsCached,
  getBookmarkStatsCached,
  type CountFilter,
} from "@/lib/cached";

export async function addBookmark(url: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Mirror the extension's normalization (case-insensitive, trailing-slash
  // stripped) so the dialog and the extension agree on what counts as a
  // duplicate.
  const normalized = url.toLowerCase().replace(/\/+$/, "");
  const [existing] = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      domain: bookmarks.domain,
      url: bookmarks.url,
      ogImage: bookmarks.ogImage,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        sql`lower(regexp_replace(${bookmarks.url}, '/+$', '')) = ${normalized}`,
      ),
    )
    .limit(1);

  if (existing) {
    const associatedTags = await db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(bookmarkTags)
      .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(eq(bookmarkTags.bookmarkId, existing.id));

    return {
      action: "existing" as const,
      bookmark: { ...existing, tags: associatedTags },
    };
  }

  const metadata = await extractMetadata(url);

  const [bookmark] = await db
    .insert(bookmarks)
    .values({
      userId,
      url,
      title: metadata.title,
      description: metadata.description,
      ogImage: metadata.ogImage,
      domain: metadata.domain,
      content: metadata.content,
      htmlContent: metadata.htmlContent,
      wordCount: metadata.wordCount,
    })
    .returning();

  revalidatePath("/");
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`user:${userId}:tags`);
  updateCacheTag(`user:${userId}:counts`);
  updateCacheTag(`user:${userId}:untagged`);
  updateCacheTag(`user:${userId}:enrich-status`);

  after(() => enqueueEmbedding(bookmark.id));

  return {
    action: "created" as const,
    bookmark: {
      id: bookmark.id,
      title: bookmark.title,
      domain: bookmark.domain,
      url: bookmark.url,
      ogImage: bookmark.ogImage,
      createdAt: bookmark.createdAt,
      tags: [] as { id: string; name: string; color: string }[],
    },
  };
}

// Lean projection helpers now live in src/lib/cached.ts; list reads here
// delegate to the *Cached helpers, so no local projection is needed.

export async function getBookmarks(
  filter?: "all" | "favorites" | "archived" | "unread" | "everything",
  tagId?: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getBookmarksCached(userId, filter, tagId);
}

export async function toggleBookmarkFavorite(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [existing] = await db
    .select({ isFavorite: bookmarks.isFavorite })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  if (!existing) throw new Error("Not found");

  await db
    .update(bookmarks)
    .set({ isFavorite: !existing.isFavorite, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath("/");
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`user:${userId}:counts`);
  updateCacheTag(`bookmark:${id}`);
}

export async function toggleBookmarkArchive(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [existing] = await db
    .select({ isArchived: bookmarks.isArchived })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  if (!existing) throw new Error("Not found");

  await db
    .update(bookmarks)
    .set({ isArchived: !existing.isArchived, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath("/");
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`user:${userId}:counts`);
  updateCacheTag(`bookmark:${id}`);
}

export async function toggleBookmarkRead(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [existing] = await db
    .select({ isRead: bookmarks.isRead })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  if (!existing) throw new Error("Not found");

  const wasUnread = !existing.isRead;

  await db
    .update(bookmarks)
    .set({ isRead: !existing.isRead, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  // Transitioning unread -> read counts as an explicit "marked_read" signal.
  // Distinct from finished_inferred (scroll+dwell): keep raw events separate
  // so the recommender can weight them differently later.
  if (wasUnread) {
    await db.insert(bookmarkEvents).values({
      userId,
      bookmarkId: id,
      kind: "marked_read",
    });
    // Settle any active lottery pick for this bookmark as 'read'.
    // No-op if there's no active row. We intentionally only settle from the
    // explicit mark-as-read path for V1 — a future iteration may also settle
    // when finished_inferred fires from /api/bookmark-events.
    await settleLottery(userId, id, "read");

    after(() => generateOutcomeChip(id));
  }

  revalidatePath("/");
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`bookmark:${id}`);
}

export async function drawLotteryAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const picked = await drawLottery(userId);
  revalidatePath("/");
  if (!picked) {
    // Flash via search param so the widget can render an inline note.
    redirect("/?lottery=empty");
  }
}

export async function skipLotteryAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Settle whatever is currently active as 'skipped'. We don't need the
  // bookmark id from the form — there's at most one active row per user
  // (enforced by the partial unique index).
  const { getActiveLottery } = await import("@/lib/lottery");
  const active = await getActiveLottery(userId);
  if (active) {
    await settleLottery(userId, active.bookmarkId, "skipped");
  }
  revalidatePath("/");
}

export async function deleteBookmark(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath("/");
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`user:${userId}:counts`);
  updateCacheTag(`user:${userId}:untagged`);
  updateCacheTag(`user:${userId}:tags`);
  updateCacheTag(`user:${userId}:enrich-status`);
  updateCacheTag(`bookmark:${id}`);
}

export async function searchBookmarks(query: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return searchBookmarksCached(userId, query);
}

export async function getBookmarkById(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getBookmarkByIdCached(userId, id);
}

export async function updateBookmarkSummary(id: string, summary: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .update(bookmarks)
    .set({ summary, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath(`/read/${id}`);
  updateCacheTag(`bookmark:${id}`);
  updateCacheTag(`user:${userId}:enrich-status`);
}

// Tag actions
export async function createTag(name: string, color?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [tag] = await db
    .insert(tags)
    .values({ userId, name, color: color ?? "#6366f1" })
    .returning();

  revalidatePath("/tags");
  updateCacheTag(`user:${userId}:tags`);
  return tag;
}

export async function getTags() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getTagsCached(userId);
}

export async function updateTag(tagId: string, name: string, color: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [updated] = await db
    .update(tags)
    .set({ name, color })
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .returning();

  if (!updated) throw new Error("Tag not found");

  revalidatePath("/tags");
  revalidatePath("/");
  updateCacheTag(`user:${userId}:tags`);
  updateCacheTag(`tag:${tagId}`);
  return updated;
}

export async function deleteTag(tagId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId)));

  revalidatePath("/tags");
  revalidatePath("/");
  updateCacheTag(`user:${userId}:tags`);
  updateCacheTag(`tag:${tagId}`);
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
}

export async function getTagsForBookmark(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getTagsForBookmarkCached(userId, bookmarkId);
}

export async function getTagsWithCount() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getTagsWithCountCached(userId);
}

export async function addTagToBookmark(bookmarkId: string, tagId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify ownership of both bookmark and tag
  const [bookmark] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
  if (!bookmark) throw new Error("Bookmark not found");

  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
  if (!tag) throw new Error("Tag not found");

  await db
    .insert(bookmarkTags)
    .values({ bookmarkId, tagId })
    .onConflictDoNothing();

  revalidatePath("/");
  updateCacheTag(`tag:${tagId}`);
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`user:${userId}:tags`);
  updateCacheTag(`user:${userId}:untagged`);
  updateCacheTag(`bookmark:${bookmarkId}`);
}

export async function removeTagFromBookmark(bookmarkId: string, tagId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify ownership
  const [bookmark] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
  if (!bookmark) throw new Error("Bookmark not found");

  await db
    .delete(bookmarkTags)
    .where(
      and(
        eq(bookmarkTags.bookmarkId, bookmarkId),
        eq(bookmarkTags.tagId, tagId),
      ),
    );

  revalidatePath("/");
  updateCacheTag(`tag:${tagId}`);
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:url-check`);
  updateCacheTag(`user:${userId}:tags`);
  updateCacheTag(`user:${userId}:untagged`);
  updateCacheTag(`bookmark:${bookmarkId}`);
}

// Collection actions
export async function createCollection(name: string, description?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [collection] = await db
    .insert(collections)
    .values({ userId, name, description })
    .returning();

  revalidatePath("/collections");
  updateCacheTag(`user:${userId}:collections`);
  return collection;
}

export async function getCollections() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getCollectionsCached(userId);
}

export async function addBookmarkToCollection(
  bookmarkId: string,
  collectionId: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [bookmark] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
  if (!bookmark) throw new Error("Bookmark not found");

  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    );
  if (!collection) throw new Error("Collection not found");

  await db.insert(bookmarkCollections).values({ bookmarkId, collectionId });
  revalidatePath("/");
  updateCacheTag(`user:${userId}:collections`);
}

// Highlight actions
export async function addHighlight(
  bookmarkId: string,
  text: string,
  startOffset: number,
  endOffset: number,
  note?: string,
  color?: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [highlight] = await db
    .insert(highlights)
    .values({
      userId,
      bookmarkId,
      text,
      startOffset,
      endOffset,
      note,
      color: color ?? "#fbbf24",
    })
    .returning();

  revalidatePath(`/read/${bookmarkId}`);
  updateCacheTag(`bookmark:${bookmarkId}`);
  return highlight;
}

export async function getHighlights(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getHighlightsCached(userId, bookmarkId);
}

export async function getBookmarkStats() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getBookmarkStatsCached(userId);
}

export async function getRecentBookmarks(limit = 5) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getRecentBookmarksCached(userId, limit);
}

export async function getUnreadBookmarks(limit = 6) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getUnreadBookmarksCached(userId, limit);
}

export async function getBookmarksPaginated(
  filter?: "all" | "favorites" | "archived" | "unread" | "everything",
  tagId?: string,
  cursor?: string,
  limit: number = 20,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getBookmarksPaginatedCached(userId, filter, tagId, cursor, limit);
}

export async function getBookmarkCount(filter?: CountFilter) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getBookmarkCountCached(userId, filter);
}

export async function searchBookmarksPaginated(
  query: string,
  cursor?: string,
  limit: number = 20,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return searchBookmarksPaginatedCached(userId, query, cursor, limit);
}

export async function getTagBuckets() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getTagBucketsCached(userId);
}

export async function getBookmarksByTag(tagId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getBookmarksByTagCached(userId, tagId);
}

export async function getUntaggedBookmarks() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getUntaggedBookmarksCached(userId);
}

export async function recomputeCompletionScoresAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const result = await recomputeAllScores(userId, { onlyMissing: false });
  revalidatePath("/");
  updateCacheTag(`user:${userId}:bookmarks`);
  return result;
}

export async function triggerRebuildClustersAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const result = await rebuildClusters(userId);
  revalidatePath("/clusters");
  return { clusters: result.clusters };
}

export async function archiveBulkAction(bookmarkIds: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
    return { count: 0 };
  }

  const result = await db
    .update(bookmarks)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(eq(bookmarks.userId, userId), inArray(bookmarks.id, bookmarkIds)),
    )
    .returning({ id: bookmarks.id });

  revalidatePath("/cull");
  revalidatePath("/");
  revalidatePath("/archive");
  updateCacheTag(`user:${userId}:bookmarks`);
  updateCacheTag(`user:${userId}:counts`);
  for (const id of result) {
    updateCacheTag(`bookmark:${id.id}`);
  }

  return { count: result.length };
}

export async function refreshHonestyAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  revalidateTag(`honesty:${userId}`, "max");
  revalidatePath("/honesty");
}
