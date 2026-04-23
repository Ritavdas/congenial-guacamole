/**
 * Re-read radar: surface unread bookmarks semantically similar to articles
 * the user recently finished. Powered by `findNearestToCentroid` over the
 * mean of the most recent finished bookmarks' embeddings.
 */

import { and, desc, eq, gte, inArray, isNotNull, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookmarkEvents, bookmarks } from "@/db/schema";
import { findNearestToCentroid } from "@/lib/embeddings";
import { estimateReadMinutes } from "@/lib/reading-time";

const RECENT_FINISHED_LIMIT = 20;
const MIN_SEEDS = 3;
const RECENT_OPEN_DAYS = 7;

export type RereadCandidate = {
  id: string;
  title: string;
  domain: string;
  url: string;
  readMinutes: number;
};

function deriveDomain(url: string, fallback: string | null): string {
  if (fallback) return fallback;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function getRereadCandidates(
  userId: string,
  k = 5,
): Promise<RereadCandidate[]> {
  // 1. Most recent N finished bookmark IDs.
  const recentFinished = await db
    .select({
      bookmarkId: bookmarkEvents.bookmarkId,
      lastAt: max(bookmarkEvents.createdAt).as("last_at"),
    })
    .from(bookmarkEvents)
    .where(
      and(
        eq(bookmarkEvents.userId, userId),
        inArray(bookmarkEvents.kind, ["marked_read", "finished_inferred"]),
      ),
    )
    .groupBy(bookmarkEvents.bookmarkId)
    .orderBy(desc(sql`last_at`))
    .limit(RECENT_FINISHED_LIMIT);

  if (recentFinished.length < MIN_SEEDS) return [];

  const finishedIds = recentFinished.map((r) => r.bookmarkId);

  // 2. Filter to ones that have embeddings.
  const seeded = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        inArray(bookmarks.id, finishedIds),
        isNotNull(bookmarks.embedding),
      ),
    );

  if (seeded.length < MIN_SEEDS) return [];

  const seedIds = seeded.map((s) => s.id);

  // 3. Centroid search.
  const nearest = await findNearestToCentroid(userId, seedIds, k * 2);
  if (nearest.length === 0) return [];

  // 4. Exclude bookmarks opened in the last RECENT_OPEN_DAYS days.
  const cutoff = new Date(Date.now() - RECENT_OPEN_DAYS * 24 * 60 * 60 * 1000);
  const recentlyOpened = await db
    .selectDistinct({ bookmarkId: bookmarkEvents.bookmarkId })
    .from(bookmarkEvents)
    .where(
      and(
        eq(bookmarkEvents.userId, userId),
        eq(bookmarkEvents.kind, "opened"),
        gte(bookmarkEvents.createdAt, cutoff),
        inArray(
          bookmarkEvents.bookmarkId,
          nearest.map((n) => n.id),
        ),
      ),
    );
  const openedSet = new Set(recentlyOpened.map((r) => r.bookmarkId));

  const filteredIds = nearest
    .map((n) => n.id)
    .filter((id) => !openedSet.has(id));
  if (filteredIds.length === 0) return [];

  // 5. Hydrate bookmark fields.
  const rows = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      url: bookmarks.url,
      domain: bookmarks.domain,
      wordCount: bookmarks.wordCount,
    })
    .from(bookmarks)
    .where(
      and(eq(bookmarks.userId, userId), inArray(bookmarks.id, filteredIds)),
    );

  // Preserve nearest-distance ordering.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: RereadCandidate[] = [];
  for (const id of filteredIds) {
    const r = byId.get(id);
    if (!r) continue;
    const domain = deriveDomain(r.url, r.domain);
    ordered.push({
      id: r.id,
      title: r.title?.trim() || domain,
      domain,
      url: r.url,
      readMinutes: estimateReadMinutes(r.wordCount),
    });
    if (ordered.length >= k) break;
  }
  return ordered;
}
