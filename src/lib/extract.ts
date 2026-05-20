import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { isTwitterStatusUrl, extractTwitterMetadata } from "./extract-twitter";
import { isYouTubeUrl, extractYouTubeMetadata } from "./extract-youtube";
import {
  isMediumUrl,
  extractMediumMetadata,
  extractViaJinaReader,
} from "./extract-medium";
import { isAllowedUrl } from "./url-safety";

// Pages whose <title> is exactly this are Cloudflare Turnstile challenges,
// not real content. Saving "Just a moment..." as the bookmark title is a
// silent failure that looks like the save worked.
const CHALLENGE_TITLES = new Set([
  "Just a moment...",
  "Attention Required! | Cloudflare",
]);

function isCloudflareChallenge(
  response: Response,
  title: string | null,
): boolean {
  if (response.headers.get("cf-mitigated") === "challenge") return true;
  if (title && CHALLENGE_TITLES.has(title.trim())) return true;
  return false;
}

export interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  domain: string;
  content: string | null;
  htmlContent: string | null;
  wordCount: number | null;
}

export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
  if (!isAllowedUrl(url)) {
    throw new Error("URL is not allowed: blocked host or private network");
  }

  const domain = new URL(url).hostname.replace("www.", "");

  // Twitter/X pages render OG tags via JS — use the syndication API instead
  if (isTwitterStatusUrl(url)) {
    const twitterData = await extractTwitterMetadata(url);
    if (twitterData) return twitterData;
  }

  // YouTube — fetch oEmbed metadata + transcript-as-content so the reader
  // has something to render and the bookmark is searchable.
  if (isYouTubeUrl(url)) {
    const youtubeData = await extractYouTubeMetadata(url);
    if (youtubeData) return youtubeData;
  }

  // Medium — Cloudflare Turnstile blocks every server-side fetch regardless
  // of UA. Route through Jina Reader's browser engine instead.
  if (isMediumUrl(url)) {
    const mediumData = await extractMediumMetadata(url);
    if (mediumData) return mediumData;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Pockaa/1.0; +https://pockaa.app)",
      },
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();
    const { document: doc } = parseHTML(html);

    // Extract Open Graph / meta tags
    const title =
      getMetaContent(doc, 'meta[property="og:title"]') ??
      getMetaContent(doc, 'meta[name="title"]') ??
      doc.querySelector("title")?.textContent ??
      null;

    // If we got a Cloudflare challenge (HTTP error or "Just a moment..."
    // title), fall back to Jina Reader instead of poisoning the bookmark
    // with the challenge page's metadata.
    if (!response.ok || isCloudflareChallenge(response, title)) {
      const jinaData = await extractViaJinaReader(url);
      if (jinaData) return jinaData;
      return {
        title: null,
        description: null,
        ogImage: null,
        domain,
        content: null,
        htmlContent: null,
        wordCount: null,
      };
    }

    const description =
      getMetaContent(doc, 'meta[property="og:description"]') ??
      getMetaContent(doc, 'meta[name="description"]') ??
      null;

    const ogImage =
      getMetaContent(doc, 'meta[property="og:image"]') ??
      getMetaContent(doc, 'meta[name="twitter:image"]') ??
      null;

    // Extract readable content
    let content: string | null = null;
    let htmlContent: string | null = null;
    let wordCount: number | null = null;
    try {
      const reader = new Readability(doc);
      const article = reader.parse();
      content = article?.textContent ?? null;
      htmlContent = article?.content ?? null;
      if (content) {
        wordCount = content.trim().split(/\s+/).length;
      }
    } catch {
      // Readability can fail on some pages — that's fine
    }

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
    return {
      title: null,
      description: null,
      ogImage: null,
      domain,
      content: null,
      htmlContent: null,
      wordCount: null,
    };
  }
}

function getMetaContent(doc: Document, selector: string): string | null {
  return doc.querySelector(selector)?.getAttribute("content") ?? null;
}
