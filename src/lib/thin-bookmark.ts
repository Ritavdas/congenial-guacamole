/**
 * "Thin" bookmark detection.
 *
 * Some saves are basically just a URL — Twitter/X links, Instagram posts,
 * Threads, plain link shares — with no scraped body content and at most a
 * one-line description. Recommending those is bad UX: the user clicks
 * expecting an article and gets a tweet. We treat them as third-class
 * citizens and exclude them from every recommendation surface (dashboard
 * picks, daily LLM recs, lottery). They still appear in Search and the
 * full Bookmarks list — they're not deleted, just deprioritized.
 *
 * Definition: word_count < 80 AND length(description) < 60.
 *   - word_count is set by the extractor from scraped body content; tweets
 *     and link-only saves come in at 0 or null.
 *   - description is the OG/meta description; tweets typically have a short
 *     blurb of just the tweet text.
 *
 * Both conditions must fail to qualify as thin — a bookmark with a real
 * 200-word description but no body content is still useful, and a 1k-word
 * article with no meta description is still useful.
 */

import { sql, type SQL } from "drizzle-orm";

import { bookmarks } from "@/db/schema";

const MIN_WORD_COUNT = 80;
const MIN_DESCRIPTION_CHARS = 60;

export function isThinBookmark(b: {
  wordCount: number | null;
  description: string | null;
}): boolean {
  const words = b.wordCount ?? 0;
  const descLen = (b.description ?? "").trim().length;
  return words < MIN_WORD_COUNT && descLen < MIN_DESCRIPTION_CHARS;
}

/**
 * Drizzle SQL fragment that evaluates true when a bookmark row is NOT thin.
 * Use as a `where` condition to exclude thin bookmarks at the database
 * level (cheaper than fetching everything and filtering in app code).
 */
export function notThinBookmarkSql(): SQL {
  return sql`(
    coalesce(${bookmarks.wordCount}, 0) >= ${MIN_WORD_COUNT}
    OR coalesce(length(${bookmarks.description}), 0) >= ${MIN_DESCRIPTION_CHARS}
  )`;
}
