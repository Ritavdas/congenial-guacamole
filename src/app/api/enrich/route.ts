import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import { extractMetadata } from "@/lib/extract";
import pLimit from "p-limit";
import { updateTag as updateCacheTag } from "next/cache";

export const maxDuration = 300; // allow up to 5 minutes for large batches

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let bookmarkIds: string[] | undefined;
  try {
    const body = await request.json();
    if (Array.isArray(body.bookmarkIds) && body.bookmarkIds.length > 0) {
      bookmarkIds = body.bookmarkIds;
    }
  } catch {
    // No body or invalid JSON — enrich all un-enriched bookmarks
  }

  // Fetch bookmarks to enrich
  const toEnrich = bookmarkIds
    ? await db
        .select({ id: bookmarks.id, url: bookmarks.url })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            inArray(bookmarks.id, bookmarkIds),
            isNull(bookmarks.ogImage),
            isNull(bookmarks.description),
            isNull(bookmarks.content),
          ),
        )
        .orderBy(asc(bookmarks.createdAt))
    : await db
        .select({ id: bookmarks.id, url: bookmarks.url })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            isNull(bookmarks.ogImage),
            isNull(bookmarks.description),
            isNull(bookmarks.content),
          ),
        )
        .orderBy(asc(bookmarks.createdAt));

  if (toEnrich.length === 0) {
    return new Response(
      JSON.stringify({
        message: "No bookmarks to enrich",
        enriched: 0,
        failed: 0,
        total: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Stream SSE responses
  const encoder = new TextEncoder();
  const limit = pLimit(5);

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      send({ type: "start", total: toEnrich.length });

      let enriched = 0;
      let failed = 0;
      let processed = 0;

      const tasks = toEnrich.map((bookmark) =>
        limit(async () => {
          try {
            const metadata = await extractMetadata(bookmark.url);

            // Only overwrite fields that have new data; preserve existing title from Pocket
            const updates: Record<string, unknown> = { updatedAt: new Date() };
            if (metadata.title) updates.title = metadata.title;
            if (metadata.description)
              updates.description = metadata.description;
            if (metadata.ogImage) updates.ogImage = metadata.ogImage;
            if (metadata.content) updates.content = metadata.content;
            if (metadata.htmlContent)
              updates.htmlContent = metadata.htmlContent;
            if (metadata.wordCount) updates.wordCount = metadata.wordCount;

            await db
              .update(bookmarks)
              .set(updates)
              .where(eq(bookmarks.id, bookmark.id));

            enriched++;
            processed++;
            send({
              type: "progress",
              bookmarkId: bookmark.id,
              index: processed,
              total: toEnrich.length,
              status: "success",
              title: metadata.title,
              ogImage: metadata.ogImage,
            });
          } catch {
            failed++;
            processed++;
            send({
              type: "progress",
              bookmarkId: bookmark.id,
              index: processed,
              total: toEnrich.length,
              status: "failed",
            });
          }
        }),
      );

      await Promise.all(tasks);

      try {
        updateCacheTag(`user:${userId}:enrich-status`);
        updateCacheTag(`user:${userId}:bookmarks`);
      } catch {
        // updateTag may throw outside a request context; ignore — cacheLife provides upper bound.
      }

      send({ type: "complete", enriched, failed, total: toEnrich.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
