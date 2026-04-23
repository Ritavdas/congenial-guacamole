/**
 * Cull list: rank unread bookmarks by likelihood of never being read.
 * Higher cull_score = stronger candidate to archive.
 */

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { estimateReadMinutes } from "@/lib/reading-time";

export type CullCandidate = {
  id: string;
  title: string;
  domain: string;
  url: string;
  readMinutes: number;
  savedDaysAgo: number;
  completionScore: number | null;
  score: number;
};

type CullRow = {
  id: string;
  title: string | null;
  domain: string | null;
  url: string;
  word_count: number | null;
  created_at: string;
  completion_score: number | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function deriveDomain(url: string, fallback: string | null): string {
  if (fallback) return fallback;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function hasCompletionScoreColumn(): Promise<boolean> {
  const rows = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'bookmarks' AND column_name = 'completion_score'
    ) AS exists
  `);
  return Boolean(rows[0]?.exists);
}

export async function getCullCandidates(
  userId: string,
  opts?: { limit?: number },
): Promise<CullCandidate[]> {
  const limit = opts?.limit ?? 50;

  const hasCompletion = await hasCompletionScoreColumn();
  const completionExpr = hasCompletion
    ? sql`b.completion_score`
    : sql`NULL::double precision`;

  // Single query: pull candidate columns + a flag for "ever opened".
  const rows = await db.execute<CullRow & { ever_opened: boolean }>(sql`
    SELECT
      b.id,
      b.title,
      b.domain,
      b.url,
      b.word_count,
      b.created_at,
      ${completionExpr} AS completion_score,
      EXISTS (
        SELECT 1 FROM bookmark_events e
        WHERE e.bookmark_id = b.id
          AND e.user_id = ${userId}
          AND e.kind = 'opened'
      ) AS ever_opened
    FROM bookmarks b
    WHERE b.user_id = ${userId}
      AND b.is_read = false
      AND b.is_archived = false
  `);

  const now = Date.now();

  const scored = rows.map((row) => {
    const createdAt = new Date(row.created_at).getTime();
    const daysSinceSaved = Math.max(0, (now - createdAt) / MS_PER_DAY);
    const wordCount = row.word_count ?? 0;
    const completionRaw =
      row.completion_score === null || row.completion_score === undefined
        ? null
        : Number(row.completion_score);
    const completionScore =
      completionRaw === null || Number.isNaN(completionRaw)
        ? null
        : completionRaw;

    const staleness = clamp01((daysSinceSaved - 14) / 90);
    const lengthBurden = clamp01((wordCount - 1500) / 8000);
    const notStarted = row.ever_opened ? 0.3 : 1.0;
    const lowCompletion = 1 - (completionScore ?? 0.5);

    const cullScore =
      0.35 * staleness +
      0.25 * lengthBurden +
      0.2 * notStarted +
      0.2 * lowCompletion;

    return {
      id: row.id,
      title: row.title ?? row.url,
      domain: deriveDomain(row.url, row.domain),
      url: row.url,
      readMinutes: estimateReadMinutes(row.word_count),
      savedDaysAgo: Math.round(daysSinceSaved),
      completionScore,
      score: cullScore,
    } satisfies CullCandidate;
  });

  return scored
    .filter((c) => c.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
