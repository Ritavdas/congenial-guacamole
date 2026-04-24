import { estimateReadMinutes } from "@/lib/reading-time";
import { isThinBookmark } from "@/lib/thin-bookmark";

export type PickReason = "short" | "recent" | "stale";

export type DashboardPick = {
  id: string;
  url: string;
  title: string;
  domain: string;
  excerpt: string;
  readMinutes: number;
  reason: PickReason;
  savedDaysAgo: number;
  completionScore: number | null;
};

type PickInput = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  domain: string | null;
  wordCount: number | null;
  isArchived: boolean;
  createdAt: Date;
  completionScore?: number | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function deriveDomain(url: string, fallback: string | null): string {
  if (fallback) return fallback;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toPick(b: PickInput, reason: PickReason, now: Date): DashboardPick {
  const domain = deriveDomain(b.url, b.domain);
  const savedDaysAgo = Math.max(
    0,
    Math.floor((now.getTime() - b.createdAt.getTime()) / MS_PER_DAY),
  );
  return {
    id: b.id,
    url: b.url,
    title: b.title?.trim() || domain,
    domain,
    excerpt: b.description?.trim() ?? "",
    readMinutes: estimateReadMinutes(b.wordCount),
    reason,
    savedDaysAgo,
    completionScore: b.completionScore ?? null,
  };
}

/**
 * Pick up to 5 unread bookmarks for the dashboard:
 *   3 short (lowest wordCount) + 1 most recent + 1 oldest.
 * Order: shorts first, then recent, then stale. Deduped by id.
 * Archived bookmarks are excluded.
 */
export function selectDashboardPicks(
  bookmarks: ReadonlyArray<PickInput>,
  now: Date = new Date(),
): DashboardPick[] {
  // Exclude archived AND "thin" bookmarks (twitter links, plain link
  // saves with no body content + short description). They're third-class
  // citizens for recommendations — see lib/thin-bookmark.ts.
  const candidates = bookmarks.filter(
    (b) => !b.isArchived && !isThinBookmark(b),
  );
  if (candidates.length === 0) return [];

  const byShortest = [...candidates].sort(
    (a, b) => (a.wordCount ?? 0) - (b.wordCount ?? 0),
  );
  const byNewest = [...candidates].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const byOldest = [...candidates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const used = new Set<string>();
  const picks: DashboardPick[] = [];

  for (const b of byShortest) {
    if (picks.length >= 3) break;
    if (used.has(b.id)) continue;
    used.add(b.id);
    picks.push(toPick(b, "short", now));
  }

  for (const b of byNewest) {
    if (used.has(b.id)) continue;
    used.add(b.id);
    picks.push(toPick(b, "recent", now));
    break;
  }

  for (const b of byOldest) {
    if (used.has(b.id)) continue;
    used.add(b.id);
    picks.push(toPick(b, "stale", now));
    break;
  }

  return picks;
}

export function reasonHint(p: DashboardPick): string {
  if (p.reason === "recent") {
    if (p.savedDaysAgo === 0) return "Saved today";
    if (p.savedDaysAgo === 1) return "Saved yesterday";
    return `Saved ${p.savedDaysAgo} days ago`;
  }
  if (p.reason === "stale") {
    if (p.savedDaysAgo < 30) return `Saved ${p.savedDaysAgo} days ago`;
    const months = Math.round(p.savedDaysAgo / 30);
    return months <= 1 ? "Saved a month ago" : `Saved ${months} months ago`;
  }
  return `${p.readMinutes} min read`;
}
