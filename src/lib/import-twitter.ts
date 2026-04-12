// @no-test-required — Twitter import, similar pattern to pocket import
export interface ParsedTweet {
  url: string;
  tweetId: string;
  timestamp: Date;
}

/**
 * Parse X/Twitter data archive bookmarks.js content.
 * Handles both `window.YTD.bookmarks.part0 = [...]` format and raw JSON arrays.
 */
export function parseTwitterArchiveBookmarks(content: string): ParsedTweet[] {
  const trimmed = content.trim();

  let rawData: unknown;

  // Try stripping the `window.YTD.bookmarks.part0 = ` prefix
  const prefixMatch = trimmed.match(/^window\.YTD\.bookmarks\.part\d+\s*=\s*/);

  if (prefixMatch) {
    const jsonPart = trimmed.slice(prefixMatch[0].length).replace(/;\s*$/, "");
    try {
      rawData = JSON.parse(jsonPart);
    } catch {
      return [];
    }
  } else {
    // Try parsing as raw JSON
    try {
      rawData = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(rawData)) return [];

  const results: ParsedTweet[] = [];

  for (const entry of rawData) {
    try {
      // Handle nested { bookmarks: { tweetId, timestamp } } or flat { tweetId, timestamp }
      const bookmark =
        typeof entry === "object" && entry !== null && "bookmarks" in entry
          ? (entry as { bookmarks: Record<string, unknown> }).bookmarks
          : (entry as Record<string, unknown>);

      const tweetId = String(bookmark.tweetId ?? bookmark.tweet_id ?? "");
      if (!tweetId) continue;

      const ts = bookmark.timestamp ?? bookmark.created_at;
      const timestamp = ts ? new Date(String(ts)) : new Date();

      if (isNaN(timestamp.getTime())) continue;

      results.push({
        url: `https://x.com/i/web/status/${tweetId}`,
        tweetId,
        timestamp,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return results;
}
