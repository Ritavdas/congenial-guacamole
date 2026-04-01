export interface PocketArticle {
  url: string;
  title: string;
  timeAdded: Date;
  tags: string[];
}

export function parsePocketExport(html: string): PocketArticle[] {
  const articles: PocketArticle[] = [];

  // Match <dt> blocks containing <a> tags — Pocket export uses Netscape bookmark format
  const dtRegex = /<dt>\s*<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = dtRegex.exec(html)) !== null) {
    const attrs = match[1];
    const textContent = match[2].trim();

    const href = extractAttr(attrs, "href");
    if (!href) continue;

    const timeAddedStr = extractAttr(attrs, "time_added");
    const tagsStr = extractAttr(attrs, "tags");

    const timeAdded = timeAddedStr
      ? new Date(parseInt(timeAddedStr, 10) * 1000)
      : new Date();

    // Discard invalid dates
    if (isNaN(timeAdded.getTime())) {
      timeAdded.setTime(Date.now());
    }

    const tagsList = tagsStr
      ? tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    articles.push({
      url: href,
      title: textContent || new URL(href).hostname,
      timeAdded,
      tags: tagsList,
    });
  }

  return articles;
}

function extractAttr(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, "i");
  const match = regex.exec(attrs);
  return match ? match[1] : null;
}
