/**
 * Backfill embeddings for bookmarks that don't have one yet.
 *
 * Run:
 *   npm run backfill:embeddings
 *
 * Idempotent — safe to re-run. enqueueEmbeddingsBatch() skips bookmarks whose
 * input hash hasn't changed.
 *
 * Batches up to BATCH_SIZE inputs into one /v1/embeddings call. With OpenRouter
 * (after $10 lifetime deposit) we get 1000 RPM on paid endpoints, so each batch
 * is ONE request regardless of values. Defaults are tuned to finish a 6k
 * backfill in ~2-3 minutes while staying well under the rate cap.
 *
 * On 429s we parse retry-after info from the error and sleep that long, then
 * resume from the same cursor (no progress lost — embedded rows are skipped
 * via input hash check).
 *
 * Env vars:
 *   BACKFILL_LIMIT     — stop after seeing this many rows (testing)
 *   BACKFILL_BATCH     — values per /v1/embeddings call (default 100)
 *   BACKFILL_RPM       — target steady-state requests/minute (default 300)
 */

import "dotenv/config";
import { and, asc, gt, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "../src/db";
import { bookmarks } from "../src/db/schema";
import { enqueueEmbeddingsBatch } from "../src/lib/embeddings";

const BATCH_SIZE = Number(process.env.BACKFILL_BATCH ?? 100);
const TARGET_RPM = Number(process.env.BACKFILL_RPM ?? 300);
const LIMIT = process.env.BACKFILL_LIMIT
  ? Number(process.env.BACKFILL_LIMIT)
  : Infinity;

// Per-batch delay to maintain TARGET_RPM requests/minute steady state.
// One batch = one /v1/embeddings request regardless of BATCH_SIZE.
const DELAY_MS_BETWEEN_BATCHES = Math.ceil(60_000 / TARGET_RPM);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract retry-after seconds from a rate-limit error message. */
function parseRetrySeconds(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m =
    msg.match(/retry in ([\d.]+)s/i) ??
    msg.match(/retry-after[:\s]+(\d+)/i) ??
    msg.match(/try again in ([\d.]+)\s*s/i);
  return m ? Math.ceil(Number(m[1])) : null;
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|rate.?limit|429/i.test(msg);
}

async function main() {
  console.log(
    `[backfill] starting (batch=${BATCH_SIZE}, target=${TARGET_RPM}/min, delay=${DELAY_MS_BETWEEN_BATCHES}ms, limit=${LIMIT})`,
  );

  let cursor: string | null = null;
  let total = 0;
  let embedded = 0;
  let skipped = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (;;) {
    const baseFilter: SQL = or(
      isNull(bookmarks.embedding),
      isNull(bookmarks.embeddingInputHash),
    )!;
    const where: SQL = cursor
      ? (and(baseFilter, gt(bookmarks.id, cursor)) as SQL)
      : baseFilter;

    const batch = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(where)
      .orderBy(asc(bookmarks.id))
      .limit(BATCH_SIZE);

    if (batch.length === 0) break;

    // Try this batch; on quota error, sleep retry-after and try again.
    let attempt = 0;
    let success = false;
    while (attempt < 5 && !success) {
      attempt += 1;
      try {
        const result = await enqueueEmbeddingsBatch(batch.map((b) => b.id));
        embedded += result.embedded;
        skipped += result.skipped;
        success = true;
      } catch (err) {
        if (isQuotaError(err)) {
          const retry = parseRetrySeconds(err) ?? 60;
          const sleepMs = (retry + 2) * 1000;
          console.warn(
            `[backfill] quota hit (attempt ${attempt}). sleeping ${retry + 2}s then retrying same batch…`,
          );
          await sleep(sleepMs);
        } else {
          failed += batch.length;
          console.error(
            `[backfill] batch failed (${batch.length} rows):`,
            err instanceof Error ? err.message : err,
          );
          break;
        }
      }
    }

    if (!success && attempt >= 5) {
      failed += batch.length;
      console.error(`[backfill] batch giving up after ${attempt} attempts`);
    }

    if (success) {
      total += batch.length;
      cursor = batch[batch.length - 1].id;
    } else {
      // Even on failure, advance cursor so we don't infinite-loop.
      total += batch.length;
      cursor = batch[batch.length - 1].id;
    }

    console.log(
      `[backfill] seen ${total} embedded ${embedded} skipped ${skipped} failed ${failed} — last id ${cursor}`,
    );

    if (total >= LIMIT) {
      console.log(`[backfill] reached limit=${LIMIT}, stopping`);
      break;
    }

    await sleep(DELAY_MS_BETWEEN_BATCHES);
  }

  const remainingRows = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count FROM bookmarks WHERE embedding IS NULL
  `);
  const remaining = remainingRows[0]?.count ?? "?";

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[backfill] done. seen ${total}, embedded ${embedded}, skipped ${skipped}, failed ${failed} in ${elapsed}s. remaining without embedding: ${remaining}`,
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
