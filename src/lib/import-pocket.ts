export interface PocketArticle {
  url: string;
  title: string;
  timeAdded: Date;
  tags: string[];
  isRead: boolean;
}

/**
 * Parse Pocket CSV export (columns: title, url, time_added, tags, status).
 */
export function parsePocketCsv(csvContent: string): PocketArticle[] {
  const articles: PocketArticle[] = [];
  const lines = parseCsvLines(csvContent);

  if (lines.length === 0) return [];

  const header = lines[0].map((h) => h.trim().toLowerCase());
  const urlIdx = header.indexOf("url");
  const titleIdx = header.indexOf("title");
  const timeIdx = header.indexOf("time_added");
  const tagsIdx = header.indexOf("tags");
  const statusIdx = header.indexOf("status");

  if (urlIdx === -1) return [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    const url = cols[urlIdx]?.trim();
    if (!url) continue;

    const title = cols[titleIdx]?.trim() || url;
    const timeStr = cols[timeIdx]?.trim();
    const tagsStr = cols[tagsIdx]?.trim();
    const status = cols[statusIdx]?.trim().toLowerCase();

    const timeAdded = timeStr
      ? new Date(parseInt(timeStr, 10) * 1000)
      : new Date();
    if (isNaN(timeAdded.getTime())) timeAdded.setTime(Date.now());

    const tagsList = tagsStr
      ? tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    articles.push({
      url,
      title,
      timeAdded,
      tags: tagsList,
      isRead: status === "read" || status === "archived",
    });
  }

  return articles;
}

/**
 * Parse Pocket HTML export (Netscape bookmark format) as fallback.
 */
export function parsePocketHtml(html: string): PocketArticle[] {
  const articles: PocketArticle[] = [];
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
    if (isNaN(timeAdded.getTime())) timeAdded.setTime(Date.now());

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
      isRead: false,
    });
  }

  return articles;
}

/**
 * Auto-detect format and parse.
 */
export function parsePocketExport(content: string): PocketArticle[] {
  const trimmed = content.trim();
  if (trimmed.startsWith("title,") || trimmed.startsWith('"title"')) {
    return parsePocketCsv(trimmed);
  }
  if (
    trimmed.includes("<!DOCTYPE") ||
    trimmed.includes("<DT>") ||
    trimmed.includes("<dt>")
  ) {
    return parsePocketHtml(trimmed);
  }
  // Try CSV first, then HTML
  const csvResult = parsePocketCsv(trimmed);
  return csvResult.length > 0 ? csvResult : parsePocketHtml(trimmed);
}

/**
 * Parse already-read.json collection file.
 */
export function parseAlreadyReadJson(jsonContent: string): string[] {
  try {
    const data = JSON.parse(jsonContent);
    const items = data.items ?? data;
    if (!Array.isArray(items)) return [];
    return items
      .map((item: { url?: string }) => item.url)
      .filter((url): url is string => Boolean(url));
  } catch {
    return [];
  }
}

// --- CSV parser (handles quoted fields with commas) ---

function parseCsvLines(csv: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        current.push(field);
        field = "";
        if (current.some((c) => c.length > 0)) lines.push(current);
        current = [];
        if (ch === "\r") i++;
      } else {
        field += ch;
      }
    }
  }

  // Last field/line
  current.push(field);
  if (current.some((c) => c.length > 0)) lines.push(current);

  return lines;
}

function extractAttr(attrs: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // eslint-disable-next-line security/detect-non-literal-regexp
  const regex = new RegExp(`${escaped}="([^"]*)"`, "i");
  const match = regex.exec(attrs);
  return match ? match[1] : null;
}
