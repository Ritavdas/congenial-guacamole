import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { parseTwitterBookmarksExport } from "@/lib/import-twitter-bookmarks";
import {
  fetchAllBookmarks,
  TwitterAuthError,
  type ExportedBookmark,
} from "@/lib/twitter-bookmarks-fetch";
import { enqueueEmbeddingsBatch } from "@/lib/embeddings";
import { upsertTwitterSyncStatus } from "@/lib/twitter-sync-status";

export const maxDuration = 300;

/**
 * Daily Vercel Cron: pull new X bookmarks and ingest them.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically when
 * the CRON_SECRET env var is set. This route is on the public middleware
 * allowlist and self-protects with that secret.
 *
 * Required env: CRON_SECRET, X_AUTH_TOKEN, X_CSRF_TOKEN, SYNC_USER_ID.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authToken = process.env.X_AUTH_TOKEN;
  const csrfToken = process.env.X_CSRF_TOKEN;
  const userId = process.env.SYNC_USER_ID;

  if (!authToken || !csrfToken || !userId) {
    return NextResponse.json(
      {
        error:
          "Missing env: X_AUTH_TOKEN, X_CSRF_TOKEN and SYNC_USER_ID are required",
      },
      { status: 500 },
    );
  }

  const insertedIds: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Ingest one page at a time and stop as soon as a page yields no new
  // bookmarks — keeps the daily run cheap and incremental.
  async function ingestPage(pageTweets: ExportedBookmark[]): Promise<boolean> {
    if (pageTweets.length === 0) return false;

    const parsed = parseTwitterBookmarksExport(JSON.stringify(pageTweets));
    if (parsed.length === 0) return false;

    const urls = parsed.map((t) => t.url);
    const existing = await db
      .select({ url: bookmarks.url })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId!), inArray(bookmarks.url, urls)));
    const existingUrls = new Set(existing.map((e) => e.url));

    const toInsert = parsed.filter((t) => !existingUrls.has(t.url));
    skipped += parsed.length - toInsert.length;

    if (toInsert.length === 0) {
      // Whole page already known → we've caught up. Stop paginating.
      return true;
    }

    const rows = await db
      .insert(bookmarks)
      .values(
        toInsert.map((t) => ({
          userId: userId!,
          url: t.url,
          title: t.title,
          description: t.description,
          ogImage: t.ogImage,
          content: t.content,
          htmlContent: t.htmlContent,
          wordCount: t.wordCount,
          domain: t.domain,
          createdAt: t.createdAt,
          updatedAt: new Date(),
        })),
      )
      .returning({ id: bookmarks.id });

    imported += rows.length;
    insertedIds.push(...rows.map((r) => r.id));
    return false;
  }

  try {
    const result = await fetchAllBookmarks({
      authToken,
      csrfToken,
      onPage: ingestPage,
    });

    if (imported > 0) {
      revalidateTag(`user:${userId}:bookmarks`, "max");
      revalidateTag(`user:${userId}:url-check`, "max");
      revalidateTag(`user:${userId}:counts`, "max");

      after(async () => {
        try {
          await enqueueEmbeddingsBatch(insertedIds);
        } catch (err) {
          console.error("[cron] embedding enqueue failed:", err);
        }
      });
    }

    await upsertTwitterSyncStatus(userId, {
      status: "ok",
      imported,
      skipped,
      pagesFetched: result.pagesFetched,
    });

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      pagesFetched: result.pagesFetched,
      stoppedEarly: result.stoppedEarly,
    });
  } catch (err) {
    if (err instanceof TwitterAuthError) {
      console.error("[cron] X auth expired:", err.message);
      await upsertTwitterSyncStatus(userId, {
        status: "auth_expired",
        imported,
        skipped,
        pagesFetched: 0,
        errorMessage: err.message,
      });
      return NextResponse.json(
        { ok: false, error: err.message, imported, skipped },
        { status: 401 },
      );
    }
    console.error("[cron] sync failed:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    await upsertTwitterSyncStatus(userId, {
      status: "error",
      imported,
      skipped,
      pagesFetched: 0,
      errorMessage: message,
    });
    return NextResponse.json(
      { ok: false, error: message, imported, skipped },
      { status: 500 },
    );
  }
}
