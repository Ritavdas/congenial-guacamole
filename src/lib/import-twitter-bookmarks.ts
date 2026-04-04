export interface ParsedTwitterBookmark {
  url: string;
  tweetId: string;
  title: string;
  description: string;
  ogImage: string | null;
  content: string;
  htmlContent: string;
  wordCount: number;
  domain: string;
  createdAt: Date;
}

interface ExportedBookmark {
  tweet_id: string;
  tweet_url: string;
  created_at: string;
  full_text: string;
  author_name: string;
  author_handle: string;
  media_urls?: string;
  urls?: string;
  [key: string]: unknown;
}

/**
 * Parse the JSON output from our GraphQL bookmarks export script.
 * Accepts the JSON array of tweets exported by scripts/export_bookmarks.py.
 */
export function parseTwitterBookmarksExport(
  content: string,
): ParsedTwitterBookmark[] {
  let rawData: unknown;
  try {
    rawData = JSON.parse(content.trim());
  } catch {
    return [];
  }

  if (!Array.isArray(rawData)) return [];

  const results: ParsedTwitterBookmark[] = [];

  for (const entry of rawData as ExportedBookmark[]) {
    try {
      const tweetId = String(entry.tweet_id ?? "");
      if (!tweetId) continue;

      const authorName = entry.author_name ?? "Unknown";
      const authorHandle = entry.author_handle ?? "";
      const fullText = entry.full_text ?? "";

      // Parse media URLs (semicolon-separated from our export)
      const mediaUrls = (entry.media_urls ?? "")
        .split(";")
        .map((u) => u.trim())
        .filter(Boolean);

      const ogImage = mediaUrls[0] || null;

      const timestamp = entry.created_at
        ? new Date(entry.created_at)
        : new Date();
      if (isNaN(timestamp.getTime())) continue;

      const url = entry.tweet_url || `https://x.com/i/web/status/${tweetId}`;

      results.push({
        url,
        tweetId,
        title: `${authorName} (${authorHandle}) on X`,
        description: fullText.slice(0, 280),
        ogImage,
        content: fullText,
        htmlContent: `<p>${escapeHtml(fullText)}</p>`,
        wordCount: fullText.trim().split(/\s+/).length,
        domain: "x.com",
        createdAt: timestamp,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return results;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
