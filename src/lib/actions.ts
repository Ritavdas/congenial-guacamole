"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookmarks, tags, bookmarkTags, collections, bookmarkCollections, highlights } from "@/db/schema";
import { eq, and, desc, ilike, or, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { extractMetadata } from "@/lib/extract";

export async function addBookmark(url: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

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
  return bookmark;
}

export async function getBookmarks(filter?: "all" | "favorites" | "archived" | "unread", tagId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

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

  if (tagId) {
    const taggedBookmarkIds = db
      .select({ bookmarkId: bookmarkTags.bookmarkId })
      .from(bookmarkTags)
      .where(eq(bookmarkTags.tagId, tagId));
    conditions.push(inArray(bookmarks.id, taggedBookmarkIds));
  }

  const rows = await db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt));

  const bookmarkIds = rows.map((b) => b.id);
  if (bookmarkIds.length === 0) return [];

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

  const tagsByBookmark = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of tagRows) {
    const arr = tagsByBookmark.get(row.bookmarkId) ?? [];
    arr.push({ id: row.tagId, name: row.tagName, color: row.tagColor });
    tagsByBookmark.set(row.bookmarkId, arr);
  }

  return rows.map((b) => ({
    ...b,
    tags: tagsByBookmark.get(b.id) ?? [],
  }));
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
}

export async function toggleBookmarkRead(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [existing] = await db
    .select({ isRead: bookmarks.isRead })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  if (!existing) throw new Error("Not found");

  await db
    .update(bookmarks)
    .set({ isRead: !existing.isRead, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath("/");
}

export async function deleteBookmark(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath("/");
}

export async function searchBookmarks(query: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!query.trim()) return [];

  const searchPattern = `%${query}%`;

  const rows = await db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        or(
          ilike(bookmarks.title, searchPattern),
          ilike(bookmarks.description, searchPattern),
          ilike(bookmarks.content, searchPattern),
          ilike(bookmarks.url, searchPattern)
        )
      )
    )
    .orderBy(desc(bookmarks.createdAt));

  const bookmarkIds = rows.map((b) => b.id);
  if (bookmarkIds.length === 0) return [];

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

  const tagsByBookmark = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of tagRows) {
    const arr = tagsByBookmark.get(row.bookmarkId) ?? [];
    arr.push({ id: row.tagId, name: row.tagName, color: row.tagColor });
    tagsByBookmark.set(row.bookmarkId, arr);
  }

  return rows.map((b) => ({
    ...b,
    tags: tagsByBookmark.get(b.id) ?? [],
  }));
}

export async function getBookmarkById(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [bookmark] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  return bookmark ?? null;
}

export async function updateBookmarkSummary(id: string, summary: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .update(bookmarks)
    .set({ summary, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath(`/read/${id}`);
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
  return tag;
}

export async function getTags() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.select().from(tags).where(eq(tags.userId, userId));
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
  return updated;
}

export async function deleteTag(tagId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));

  revalidatePath("/tags");
  revalidatePath("/");
}

export async function getTagsForBookmark(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(
      and(
        eq(bookmarkTags.bookmarkId, bookmarkId),
        eq(tags.userId, userId)
      )
    );
}

export async function getTagsWithCount() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

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
    .where(and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(bookmarkTags.tagId, tagId)));

  revalidatePath("/");
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
  return collection;
}

export async function getCollections() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.select().from(collections).where(eq(collections.userId, userId));
}

export async function addBookmarkToCollection(bookmarkId: string, collectionId: string) {
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
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!collection) throw new Error("Collection not found");

  await db.insert(bookmarkCollections).values({ bookmarkId, collectionId });
  revalidatePath("/");
}

// Highlight actions
export async function addHighlight(
  bookmarkId: string,
  text: string,
  startOffset: number,
  endOffset: number,
  note?: string,
  color?: string
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
  return highlight;
}

export async function getHighlights(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(highlights)
    .where(and(eq(highlights.bookmarkId, bookmarkId), eq(highlights.userId, userId)));
}
