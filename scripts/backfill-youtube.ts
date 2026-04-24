/**
 * Backfill YouTube transcripts (+ refreshed metadata) for bookmarks that
 * point at YouTube but have no extracted content yet.
 *
 * Run:
 *   npm run backfill:youtube
 *
 * Idempotent — re-runs skip rows that already have content.
 *
 * Strategy:
 *   1. Find bookmarks where the URL is a YouTube URL AND content IS NULL/empty.
 *   2. For each, call extractYouTubeMetadata(url) to fetch oEmbed + transcript.
 *   3. If a transcript came back, update content/wordCount and (if missing)
 *      title/description/og_image. Mark embedding stale by clearing
 *      input_hash so the next embeddings backfill re-embeds with the
 *      transcript text.
 *
 * Env vars:
 *   BACKFILL_LIMIT  — stop after processing this many rows (testing)
 *   BACKFILL_DELAY  — ms between videos to be polite to YouTube (default 800)
 */

import "dotenv/config";
import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "../src/db";
import { bookmarks } from "../src/db/schema";
import {
  extractYouTubeMetadata,
  isYouTubeUrl,
} from "../src/lib/extract-youtube";

const LIMIT = process.env.BACKFILL_LIMIT
  ? Number(process.env.BACKFILL_LIMIT)
  : Infinity;
const DELAY_MS = Number(process.env.BACKFILL_DELAY ?? 800);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const started = Date.now();
  console.log(`[yt-backfill] starting (limit=${LIMIT}, delay=${DELAY_MS}ms)`);

  // Pull all bookmarks that look like YouTube URLs and have no body content.
  // We filter the URL pattern in SQL (cheap) then re-validate with isYouTubeUrl
  // in JS to catch edge cases (m.youtube.com, music.youtube.com, etc.).
  const candidates = await db
    .select({ id: bookmarks.id, url: bookmarks.url, title: bookmarks.title })
    .from(bookmarks)
    .where(
      and(
        or(
          sql`${bookmarks.url} ILIKE 'https://www.youtube.com/%'`,
          sql`${bookmarks.url} ILIKE 'https://youtube.com/%'`,
          sql`${bookmarks.url} ILIKE 'https://m.youtube.com/%'`,
          sql`${bookmarks.url} ILIKE 'https://music.youtube.com/%'`,
          sql`${bookmarks.url} ILIKE 'https://youtu.be/%'`,
        ),
        or(isNull(bookmarks.content), sql`length(${bookmarks.content}) = 0`),
      ),
    );

  const targets = candidates.filter((b) => isYouTubeUrl(b.url));
  console.log(
    `[yt-backfill] found ${targets.length} youtube bookmarks without content`,
  );

  let processed = 0;
  let withTranscript = 0;
  let withoutTranscript = 0;
  let failed = 0;

  for (const b of targets) {
    if (processed >= LIMIT) {
      console.log(`[yt-backfill] reached limit=${LIMIT}, stopping`);
      break;
    }
    processed += 1;

    try {
      const meta = await extractYouTubeMetadata(b.url);
      if (!meta) {
        failed += 1;
        console.warn(`[yt-backfill] ${b.id} no metadata returned`);
        continue;
      }

      const updates: Record<string, unknown> = {};
      if (meta.content) {
        updates.content = meta.content;
        updates.wordCount = meta.wordCount;
        // Clear embedding-input hash so the embeddings backfill knows to
        // re-embed using the new transcript text.
        updates.embeddingInputHash = null;
        withTranscript += 1;
      } else {
        withoutTranscript += 1;
      }
      if (meta.title) updates.title = meta.title;
      if (meta.description) updates.description = meta.description;
      if (meta.ogImage) updates.ogImage = meta.ogImage;

      if (Object.keys(updates).length === 0) continue;

      await db.update(bookmarks).set(updates).where(eq(bookmarks.id, b.id));

      if (processed % 10 === 0) {
        console.log(
          `[yt-backfill] progress ${processed}/${targets.length} ` +
            `(transcript=${withTranscript} no-transcript=${withoutTranscript} failed=${failed})`,
        );
      }
    } catch (err) {
      failed += 1;
      console.error(
        `[yt-backfill] ${b.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[yt-backfill] done in ${seconds}s — processed=${processed} ` +
      `transcript=${withTranscript} no-transcript=${withoutTranscript} failed=${failed}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[yt-backfill] fatal", err);
  process.exit(1);
});
