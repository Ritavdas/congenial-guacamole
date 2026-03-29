"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookmarks, tags, bookmarkTags, collections, bookmarkCollections, highlights } from "@/db/schema";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
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

export async function getBookmarks(filter?: "all" | "favorites" | "archived" | "unread") {
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

  return db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt));
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

  return db
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

export async function addTagToBookmark(bookmarkId: string, tagId: string) {
  await db.insert(bookmarkTags).values({ bookmarkId, tagId });
  revalidatePath("/");
}

export async function removeTagFromBookmark(bookmarkId: string, tagId: string) {
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
