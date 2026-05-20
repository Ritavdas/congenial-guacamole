/**
 * Medium extraction — Medium articles sit behind Cloudflare Turnstile, so any
 * server-side fetch (regardless of User-Agent) returns a "Just a moment..."
 * challenge page instead of the article HTML. We route Medium URLs through
 * Jina Reader's browser-rendering endpoint (r.jina.ai), which executes JS,
 * solves the challenge, and returns clean structured JSON.
 *
 * Jina Reader's JSON endpoint works without authentication on the free tier
 * (~20 req/min). Set JINA_API_KEY to bump the limit (~200 req/min).
 *
 * This module is also used as a fallback for any non-Medium URL that returns
 * a Cloudflare challenge — see extract.ts.
 */
import type { ExtractedMetadata } from "./extract";
import { marked } from "marked";

const MEDIUM_HOSTNAMES = new Set(["medium.com"]);
const FETCH_TIMEOUT_MS = 30_000;

export function isMediumUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      MEDIUM_HOSTNAMES.has(u.hostname) || u.hostname.endsWith(".medium.com")
    );
  } catch {
    return false;
  }
}

interface JinaReaderResponse {
  code: number;
  data?: {
    title?: string;
    description?: string;
    url?: string;
    content?: string;
    publishedTime?: string;
    metadata?: Record<string, string>;
  };
}

/**
 * Fetch a URL via Jina Reader's browser engine and shape the response into
 * our standard ExtractedMetadata. Returns null on failure so callers can
 * fall back to plain fetch or surface an error.
 */
export async function extractViaJinaReader(
  url: string,
): Promise<ExtractedMetadata | null> {
  const domain = new URL(url).hostname.replace("www.", "");

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Engine": "browser",
    };
    if (process.env.JINA_API_KEY) {
      headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const payload = (await res.json()) as JinaReaderResponse;
    if (payload.code !== 200 || !payload.data) return null;
    const data = payload.data;

    const meta = data.metadata ?? {};
    const title = data.title ?? meta["og:title"] ?? meta.title ?? null;
    const description =
      meta["og:description"] ?? data.description ?? meta.description ?? null;
    const ogImage = meta["og:image"] ?? meta["twitter:image"] ?? null;

    // Convert Jina's markdown to HTML so the reader renders it properly
    // (links clickable, images visible, headings styled). DOMPurify in
    // ArticleContent will sanitize before it hits the DOM.
    const rawMarkdown = data.content?.trim() || null;
    const htmlContent = rawMarkdown
      ? (marked(rawMarkdown, { async: false }) as string)
      : null;
    const content = rawMarkdown;
    const wordCount = rawMarkdown
      ? rawMarkdown
          .replace(/[#*_`>\-\[\]()!]/g, "")
          .trim()
          .split(/\s+/).length
      : null;

    return {
      title,
      description,
      ogImage,
      domain,
      content,
      htmlContent,
      wordCount,
    };
  } catch {
    return null;
  }
}

/** Medium-specific entry point. Currently just delegates to Jina Reader. */
export async function extractMediumMetadata(
  url: string,
): Promise<ExtractedMetadata | null> {
  return extractViaJinaReader(url);
}
