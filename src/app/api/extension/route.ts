import { NextRequest, NextResponse, after } from "next/server";
import { eq, and } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { bookmarks, bookmarkTags } from "@/db/schema";
import { extractMetadata } from "@/lib/extract";
import { enqueueEmbedding } from "@/lib/embeddings";
import { extensionSaveSchema } from "@/lib/validators";
import { z } from "zod/v4";

const patchTagsSchema = z.object({
  bookmarkId: z.string().uuid(),
  userId: z.string().min(1),
  tagIds: z.array(z.string().uuid()),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = extensionSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { url, userId, tagIds } = parsed.data;

  try {
    const domain = new URL(url).hostname.replace("www.", "");

    const [bookmark] = await db
      .insert(bookmarks)
      .values({
        userId,
        url,
        domain,
      })
      .returning();

    if (tagIds && tagIds.length > 0) {
      await db
        .insert(bookmarkTags)
        .values(tagIds.map((tagId) => ({ bookmarkId: bookmark.id, tagId })))
        .onConflictDoNothing();
    }

    revalidateTag(`user:${userId}:bookmarks`, "max");
    revalidateTag(`user:${userId}:url-check`, "max");
    revalidateTag(`user:${userId}:counts`, "max");
    if (tagIds && tagIds.length > 0) {
      revalidateTag(`user:${userId}:tags`, "max");
    }

    // Enrich bookmark with metadata after the response is sent
    after(async () => {
      try {
        const metadata = await extractMetadata(url);
        await db
          .update(bookmarks)
          .set({
            title: metadata.title,
            description: metadata.description,
            ogImage: metadata.ogImage,
            content: metadata.content,
            htmlContent: metadata.htmlContent,
            wordCount: metadata.wordCount,
          })
          .where(eq(bookmarks.id, bookmark.id));
      } catch (err) {
        console.error("Background enrichment failed:", err);
      }

      // Embedding piggybacks on enrichment so it sees the freshest summary/description.
      await enqueueEmbedding(bookmark.id);
    });

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error("Extension save error:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = patchTagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { bookmarkId, userId, tagIds } = parsed.data;

  try {
    // Verify bookmark belongs to user
    const [bookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .limit(1);

    if (!bookmark) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 },
      );
    }

    // Remove existing tags and replace with new set
    await db
      .delete(bookmarkTags)
      .where(eq(bookmarkTags.bookmarkId, bookmarkId));

    if (tagIds.length > 0) {
      await db
        .insert(bookmarkTags)
        .values(tagIds.map((tagId) => ({ bookmarkId, tagId })))
        .onConflictDoNothing();
    }

    revalidateTag(`user:${userId}:bookmarks`, "max");
    revalidateTag(`user:${userId}:url-check`, "max");
    revalidateTag(`user:${userId}:tags`, "max");
    revalidateTag(`bookmark:${bookmarkId}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Extension tag update error:", error);
    return NextResponse.json(
      { error: "Failed to update tags" },
      { status: 500 },
    );
  }
}
