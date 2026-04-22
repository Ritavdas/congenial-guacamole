import { NextRequest, NextResponse, after } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod/v4";
import { db } from "@/db";
import { bookmarks, bookmarkTags, tags } from "@/db/schema";
import { extractMetadata } from "@/lib/extract";
import { urlSchema, userIdSchema } from "@/lib/validators";

const upsertSchema = z.object({
  url: urlSchema,
  userId: userIdSchema,
});

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { url, userId } = parsed.data;

  try {
    const normalized = normalizeUrl(url);

    // Check if bookmark already exists (case-insensitive, trailing-slash normalized)
    const [existing] = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        domain: bookmarks.domain,
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

      return NextResponse.json({
        action: "existing",
        bookmark: { ...existing, tags: associatedTags },
      });
    }

    // New bookmark — insert
    const domain = new URL(url).hostname.replace("www.", "");
    const [bookmark] = await db
      .insert(bookmarks)
      .values({ userId, url, domain })
      .returning();

    revalidateTag(`user:${userId}:bookmarks`, "max");
    revalidateTag(`user:${userId}:url-check`, "max");
    revalidateTag(`user:${userId}:counts`, "max");

    // Background enrichment
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
    });

    return NextResponse.json({
      action: "created",
      bookmark: { id: bookmark.id, url: bookmark.url, domain: bookmark.domain },
    });
  } catch (error) {
    console.error("Extension upsert error:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 },
    );
  }
}
