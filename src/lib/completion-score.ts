/**
 * Completion-likelihood scoring (Wave 3, V1 heuristic).
 *
 * Predicts how likely a user is to actually finish a saved bookmark, based on:
 *   - word_count_factor (40%): short reads are more likely to finish
 *   - age_factor (15%): freshly saved items are more likely to be read
 *   - has_summary (5%): a summary lowers the activation cost
 *   - domain_track_record (20%): user's finished/saved ratio for this domain
 *   - centroid_similarity (20%): cosine similarity to the user's "finished" centroid
 *
 * All factors return values in [0, 1]. The weighted sum is the final score.
 *
 * `scoreBookmark` is pure and trivially testable. `computeCompletionContext`
 * and `recomputeAllScores` perform DB I/O.
 */

import { and, eq, isNull, sql, desc, inArray, lt, not, or } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks, bookmarkEvents } from "@/db/schema";

export type DomainStats = { saved: number; finished: number };

export type CompletionContext = {
  domainStats: Map<string, DomainStats>;
  centroid: number[] | null;
};

export type ScoreInput = {
  domain: string | null;
  wordCount: number | null;
  summary: string | null;
  createdAt: Date;
  embedding?: number[] | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const FINISHED_KINDS = [
  "finished_inferred",
  "marked_read",
  "scroll_100",
] as const;

const WEIGHTS = {
  wordCount: 0.4,
  age: 0.15,
  summary: 0.05,
  domain: 0.2,
  centroid: 0.2,
} as const;

/** Logistic-ish decay over word count. <500 → ~0.9, ~3000 → ~0.5, >10000 → ~0.2. */
export function wordCountFactor(wordCount: number | null): number {
  if (wordCount == null || wordCount <= 0) return 0.7;
  // Logistic centered at 3000 with scale ~2000.
  const x = (wordCount - 3000) / 2000;
  const sigmoid = 1 / (1 + Math.exp(x));
  // Map sigmoid in [0,1] to [0.2, 0.95] for sane bounds.
  return 0.2 + sigmoid * 0.75;
}

export function ageFactor(createdAt: Date, now: Date = new Date()): number {
  const days = Math.max(0, (now.getTime() - createdAt.getTime()) / MS_PER_DAY);
  if (days <= 7) return 1.0;
  if (days <= 30) return 0.7;
  if (days <= 90) return 0.5;
  return 0.3;
}

export function summaryFactor(summary: string | null): number {
  return summary && summary.trim().length > 0 ? 1.0 : 0.5;
}

/** Smoothed Beta-style ratio. With <3 saves, return neutral 0.5. */
export function domainTrackRecordFactor(
  stats: DomainStats | undefined,
): number {
  if (!stats || stats.saved < 3) return 0.5;
  return (stats.finished + 1) / (stats.saved + 2);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function centroidSimilarityFactor(
  embedding: number[] | null | undefined,
  centroid: number[] | null,
): number {
  if (!embedding || !centroid) return 0.5;
  // cosine in [-1, 1] → [0, 1]
  const sim = cosineSimilarity(embedding, centroid);
  return Math.max(0, Math.min(1, (sim + 1) / 2));
}

export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Pure scorer. */
export function scoreBookmark(
  b: ScoreInput,
  ctx: CompletionContext,
  now: Date = new Date(),
): number {
  const wf = wordCountFactor(b.wordCount);
  const af = ageFactor(b.createdAt, now);
  const sf = summaryFactor(b.summary);
  const df = domainTrackRecordFactor(
    b.domain ? ctx.domainStats.get(b.domain) : undefined,
  );
  const cf = centroidSimilarityFactor(b.embedding ?? null, ctx.centroid);

  const score =
    wf * WEIGHTS.wordCount +
    af * WEIGHTS.age +
    sf * WEIGHTS.summary +
    df * WEIGHTS.domain +
    cf * WEIGHTS.centroid;

  return clamp01(score);
}

/** Build per-domain saved/finished stats and the user's "finished" centroid. */
export async function computeCompletionContext(
  userId: string,
): Promise<CompletionContext> {
  // Per-domain saved counts.
  const savedRows = await db
    .select({
      domain: bookmarks.domain,
      saved: sql<number>`count(*)`.as("saved"),
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .groupBy(bookmarks.domain);

  // Per-domain "finished" counts: bookmarks with at least one finished event,
  // OR explicitly marked is_read = true.
  const finishedRows = await db.execute<{
    domain: string | null;
    finished: number;
  }>(sql`
    SELECT b.domain AS domain, COUNT(DISTINCT b.id)::int AS finished
    FROM bookmarks b
    WHERE b.user_id = ${userId}
      AND (
        b.is_read = true
        OR EXISTS (
          SELECT 1 FROM bookmark_events e
          WHERE e.bookmark_id = b.id
            AND e.kind = ANY(${sql`ARRAY['finished_inferred','marked_read','scroll_100']::text[]`})
        )
      )
    GROUP BY b.domain
  `);

  const domainStats = new Map<string, DomainStats>();
  for (const r of savedRows) {
    if (!r.domain) continue;
    domainStats.set(r.domain, {
      saved: Number(r.saved),
      finished: 0,
    });
  }
  for (const r of finishedRows) {
    if (!r.domain) continue;
    const cur = domainStats.get(r.domain) ?? { saved: 0, finished: 0 };
    cur.finished = Number(r.finished);
    domainStats.set(r.domain, cur);
  }

  // Centroid: mean embedding of last 50 distinct finished bookmarks.
  const finishedIdRows = await db
    .selectDistinct({
      id: bookmarkEvents.bookmarkId,
      createdAt: bookmarkEvents.createdAt,
    })
    .from(bookmarkEvents)
    .where(
      and(
        eq(bookmarkEvents.userId, userId),
        inArray(bookmarkEvents.kind, FINISHED_KINDS as unknown as string[]),
      ),
    )
    .orderBy(desc(bookmarkEvents.createdAt))
    .limit(50);

  let centroid: number[] | null = null;
  if (finishedIdRows.length > 0) {
    const ids = finishedIdRows.map((r) => r.id);
    const embRows = await db
      .select({ embedding: bookmarks.embedding })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          inArray(bookmarks.id, ids),
          not(isNull(bookmarks.embedding)),
        ),
      );
    const vectors = embRows
      .map((r) => r.embedding)
      .filter((v): v is number[] => Array.isArray(v) && v.length > 0);
    if (vectors.length > 0) {
      const dim = vectors[0].length;
      const sum = new Array<number>(dim).fill(0);
      for (const v of vectors) {
        for (let i = 0; i < dim; i++) sum[i] += v[i];
      }
      for (let i = 0; i < dim; i++) sum[i] /= vectors.length;
      centroid = sum;
    }
  }

  return { domainStats, centroid };
}

type ScoringRow = {
  id: string;
  domain: string | null;
  wordCount: number | null;
  summary: string | null;
  createdAt: Date;
  embedding: number[] | null;
};

/**
 * Recompute completion scores for the user's unread+unarchived bookmarks.
 * Idempotent. Cap with `opts.limit` for lazy/background invocations.
 *
 * When `onlyMissing` is true (default), bookmarks with a fresh score
 * (computationScoreAt within the last 7 days) are skipped — useful for the
 * cheap dashboard-render path.
 */
export async function recomputeAllScores(
  userId: string,
  opts: { limit?: number; onlyMissing?: boolean } = {},
): Promise<{ updated: number }> {
  const limit = opts.limit ?? 1000;
  const onlyMissing = opts.onlyMissing ?? true;

  const conditions = [
    eq(bookmarks.userId, userId),
    eq(bookmarks.isArchived, false),
    eq(bookmarks.isRead, false),
  ];
  if (onlyMissing) {
    const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);
    conditions.push(
      or(
        isNull(bookmarks.completionScore),
        isNull(bookmarks.completionScoreAt),
        lt(bookmarks.completionScoreAt, sevenDaysAgo),
      )!,
    );
  }

  const rows: ScoringRow[] = await db
    .select({
      id: bookmarks.id,
      domain: bookmarks.domain,
      wordCount: bookmarks.wordCount,
      summary: bookmarks.summary,
      createdAt: bookmarks.createdAt,
      embedding: bookmarks.embedding,
    })
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit);

  if (rows.length === 0) return { updated: 0 };

  const ctx = await computeCompletionContext(userId);
  const now = new Date();
  let updated = 0;

  for (const b of rows) {
    const score = scoreBookmark(b, ctx, now);
    await db
      .update(bookmarks)
      .set({ completionScore: score, completionScoreAt: now })
      .where(and(eq(bookmarks.id, b.id), eq(bookmarks.userId, userId)));
    updated += 1;
  }

  return { updated };
}
