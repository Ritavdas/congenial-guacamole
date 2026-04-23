import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getModel } from "@/lib/ai";

export type HonestyStats = {
  totalSaved: number;
  totalRead: number;
  totalArchivedUnread: number;
  completionRatio: number;
  topDomains: Array<{
    domain: string;
    saved: number;
    finished: number;
    finishRatio: number;
  }>;
  oldestUnread: {
    id: string;
    title: string;
    domain: string;
    createdAt: Date;
    daysOld: number;
  } | null;
  longestStaleDays: number;
  monthlyAdded: Array<{ month: string; count: number }>;
  totalWordsSaved: number;
  totalWordsFinished: number;
  estReadingTimeWastedDays: number;
  totalEverOpened: number;
  saveOnlyCount: number;
};

export async function getHonestyStats(userId: string): Promise<HonestyStats> {
  const [totalsRow] = await db.execute<{
    total_saved: string;
    total_read: string;
    total_archived_unread: string;
    total_words_saved: string;
    total_words_finished: string;
  }>(sql`
    SELECT
      COUNT(*)::text AS total_saved,
      SUM(CASE WHEN is_read THEN 1 ELSE 0 END)::text AS total_read,
      SUM(CASE WHEN is_archived AND NOT is_read THEN 1 ELSE 0 END)::text AS total_archived_unread,
      COALESCE(SUM(COALESCE(word_count, 0)), 0)::text AS total_words_saved,
      COALESCE(SUM(CASE WHEN is_read THEN COALESCE(word_count, 0) ELSE 0 END), 0)::text AS total_words_finished
    FROM bookmarks
    WHERE user_id = ${userId}
  `);

  const totalSaved = Number(totalsRow?.total_saved ?? 0);
  const totalRead = Number(totalsRow?.total_read ?? 0);
  const totalArchivedUnread = Number(totalsRow?.total_archived_unread ?? 0);
  const totalWordsSaved = Number(totalsRow?.total_words_saved ?? 0);
  let totalWordsFinished = Number(totalsRow?.total_words_finished ?? 0);

  const [inferredRow] = await db.execute<{ inferred_words: string }>(sql`
    SELECT COALESCE(SUM(COALESCE(b.word_count, 0)), 0)::text AS inferred_words
    FROM bookmarks b
    WHERE b.user_id = ${userId}
      AND NOT b.is_read
      AND EXISTS (
        SELECT 1 FROM bookmark_events e
        WHERE e.bookmark_id = b.id
          AND e.user_id = ${userId}
          AND e.kind = 'finished_inferred'
      )
  `);
  totalWordsFinished += Number(inferredRow?.inferred_words ?? 0);

  const completionRatio = totalRead / Math.max(totalSaved, 1);

  const domainRows = await db.execute<{
    domain: string;
    saved: string;
    finished: string;
  }>(sql`
    SELECT domain,
           COUNT(*)::text AS saved,
           SUM(CASE WHEN is_read THEN 1 ELSE 0 END)::text AS finished
    FROM bookmarks
    WHERE user_id = ${userId} AND domain IS NOT NULL
    GROUP BY domain
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `);

  const topDomains = domainRows.map((r) => {
    const saved = Number(r.saved);
    const finished = Number(r.finished);
    return {
      domain: r.domain,
      saved,
      finished,
      finishRatio: saved === 0 ? 0 : finished / saved,
    };
  });

  const [oldestRow] = await db.execute<{
    id: string;
    title: string | null;
    domain: string | null;
    created_at: string;
    days_old: string;
  }>(sql`
    SELECT id, title, domain, created_at,
           EXTRACT(EPOCH FROM (now() - created_at)) / 86400 AS days_old
    FROM bookmarks
    WHERE user_id = ${userId} AND NOT is_read AND NOT is_archived
    ORDER BY created_at ASC
    LIMIT 1
  `);

  const oldestUnread = oldestRow
    ? {
        id: oldestRow.id,
        title: oldestRow.title ?? "Untitled",
        domain: oldestRow.domain ?? "",
        createdAt: new Date(oldestRow.created_at),
        daysOld: Math.floor(Number(oldestRow.days_old)),
      }
    : null;

  const longestStaleDays = oldestUnread?.daysOld ?? 0;

  const monthlyRows = await db.execute<{ month: string; count: string }>(sql`
    SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*)::text AS count
    FROM bookmarks
    WHERE user_id = ${userId}
      AND created_at > now() - interval '12 months'
    GROUP BY 1
    ORDER BY 1
  `);
  const monthlyAdded = monthlyRows.map((r) => ({
    month: r.month,
    count: Number(r.count),
  }));

  const [openedRow] = await db.execute<{ ever_opened: string }>(sql`
    SELECT COUNT(DISTINCT bookmark_id)::text AS ever_opened
    FROM bookmark_events
    WHERE user_id = ${userId} AND kind = 'opened'
  `);
  const totalEverOpened = Number(openedRow?.ever_opened ?? 0);
  const saveOnlyCount = Math.max(0, totalSaved - totalEverOpened);

  const wordsWasted = Math.max(0, totalWordsSaved - totalWordsFinished);
  const estReadingTimeWastedDays =
    Math.round((wordsWasted / 250 / 60 / 24) * 10) / 10;

  return {
    totalSaved,
    totalRead,
    totalArchivedUnread,
    completionRatio,
    topDomains,
    oldestUnread,
    longestStaleDays,
    monthlyAdded,
    totalWordsSaved,
    totalWordsFinished,
    estReadingTimeWastedDays,
    totalEverOpened,
    saveOnlyCount,
  };
}

const FALLBACK_COMMENTARY = "We couldn't generate insights right now.";

async function buildCommentary(
  _userId: string,
  _dateKey: string,
  stats: HonestyStats,
): Promise<string> {
  try {
    const prompt = `You are a brutally honest but kind reading habits coach. Given these stats, write 2-3 short paragraphs (under 150 words total) calling out specific patterns. Use specific numbers. Tone: direct, witty, never cruel. End with one concrete suggestion. Stats:\n${JSON.stringify(stats, null, 2)}`;

    const { text } = await generateText({
      model: getModel(),
      prompt,
      temperature: 0.7,
      maxOutputTokens: 300,
    });

    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : FALLBACK_COMMENTARY;
  } catch (err) {
    console.error(
      "[honesty] commentary generation failed:",
      err instanceof Error ? err.message : err,
    );
    return FALLBACK_COMMENTARY;
  }
}

export async function getHonestyCommentary(
  userId: string,
  stats: HonestyStats,
): Promise<string> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const cached = unstable_cache(
    async () => buildCommentary(userId, dateKey, stats),
    ["honesty-commentary", userId, dateKey],
    {
      tags: [`honesty:${userId}`],
      revalidate: 60 * 60 * 24,
    },
  );
  return cached();
}
