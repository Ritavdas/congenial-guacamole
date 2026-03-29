import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { isTwitterStatusUrl, extractTwitterMetadata } from "./extract-twitter";
import { isAllowedUrl } from "./url-safety";

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

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Pockaa/1.0; +https://pockaa.app)",
      },
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Extract Open Graph / meta tags
    const title =
      getMetaContent(doc, 'meta[property="og:title"]') ??
      getMetaContent(doc, 'meta[name="title"]') ??
      doc.querySelector("title")?.textContent ??
      null;

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

    return { title, description, ogImage, domain, content, htmlContent, wordCount };
  } catch {
    return { title: null, description: null, ogImage: null, domain, content: null, htmlContent: null, wordCount: null };
  }
}

function getMetaContent(doc: Document, selector: string): string | null {
  return doc.querySelector(selector)?.getAttribute("content") ?? null;
}
