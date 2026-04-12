import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractMetadata } from "./extract";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock Twitter helpers
vi.mock("./extract-twitter", () => ({
  isTwitterStatusUrl: vi.fn().mockReturnValue(false),
  extractTwitterMetadata: vi.fn().mockResolvedValue(null),
}));

function makeHtml({
  title,
  ogTitle,
  ogDesc,
  ogImage,
  twitterImage,
  metaTitle,
  metaDesc,
  body,
}: {
  title?: string;
  ogTitle?: string;
  ogDesc?: string;
  ogImage?: string;
  twitterImage?: string;
  metaTitle?: string;
  metaDesc?: string;
  body?: string;
} = {}) {
  return `<!DOCTYPE html><html><head>
    ${title ? `<title>${title}</title>` : ""}
    ${ogTitle ? `<meta property="og:title" content="${ogTitle}" />` : ""}
    ${ogDesc ? `<meta property="og:description" content="${ogDesc}" />` : ""}
    ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ""}
    ${twitterImage ? `<meta name="twitter:image" content="${twitterImage}" />` : ""}
    ${metaTitle ? `<meta name="title" content="${metaTitle}" />` : ""}
    ${metaDesc ? `<meta name="description" content="${metaDesc}" />` : ""}
  </head><body>${body ?? "<p>Hello world</p>"}</body></html>`;
}

function mockFetchHtml(html: string) {
  mockFetch.mockResolvedValue({
    text: () => Promise.resolve(html),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractMetadata", () => {
  // ── OG tags extraction ──────────────────────────────────────────────
  describe("OG tags extraction", () => {
    it("extracts og:title, og:description, og:image", async () => {
      mockFetchHtml(
        makeHtml({
          ogTitle: "OG Title",
          ogDesc: "OG Description",
          ogImage: "https://img.example.com/og.png",
        }),
      );

      const result = await extractMetadata("https://example.com/article");

      expect(result.title).toBe("OG Title");
      expect(result.description).toBe("OG Description");
      expect(result.ogImage).toBe("https://img.example.com/og.png");
    });

    it("falls back to <title> tag when no og:title", async () => {
      mockFetchHtml(makeHtml({ title: "Page Title" }));

      const result = await extractMetadata("https://example.com/page");

      expect(result.title).toBe("Page Title");
    });

    it("falls back to meta[name='title'] before <title>", async () => {
      mockFetchHtml(makeHtml({ title: "Title Tag", metaTitle: "Meta Title" }));

      const result = await extractMetadata("https://example.com/page");

      expect(result.title).toBe("Meta Title");
    });

    it("uses twitter:image when no og:image", async () => {
      mockFetchHtml(
        makeHtml({ twitterImage: "https://img.example.com/tw.png" }),
      );

      const result = await extractMetadata("https://example.com/page");

      expect(result.ogImage).toBe("https://img.example.com/tw.png");
    });

    it("prefers og:image over twitter:image", async () => {
      mockFetchHtml(
        makeHtml({
          ogImage: "https://img.example.com/og.png",
          twitterImage: "https://img.example.com/tw.png",
        }),
      );

      const result = await extractMetadata("https://example.com/page");

      expect(result.ogImage).toBe("https://img.example.com/og.png");
    });

    it("returns null for title/description/ogImage when no meta tags", async () => {
      mockFetchHtml("<!DOCTYPE html><html><head></head><body></body></html>");

      const result = await extractMetadata("https://example.com/empty");

      expect(result.title).toBeNull();
      expect(result.description).toBeNull();
      expect(result.ogImage).toBeNull();
    });
  });

  // ── Domain extraction ───────────────────────────────────────────────
  describe("domain extraction", () => {
    it("strips www. from domain", async () => {
      mockFetchHtml(makeHtml());

      const result = await extractMetadata("https://www.example.com/path");

      expect(result.domain).toBe("example.com");
    });

    it("preserves subdomains other than www", async () => {
      mockFetchHtml(makeHtml());

      const result = await extractMetadata("https://blog.example.com");

      expect(result.domain).toBe("blog.example.com");
    });
  });

  // ── Content extraction (Readability) ────────────────────────────────
  describe("content extraction", () => {
    it("extracts readable content and computes wordCount", async () => {
      const articleBody = `<article>${"<p>word </p>".repeat(50)}</article>`;
      mockFetchHtml(makeHtml({ title: "Article", body: articleBody }));

      const result = await extractMetadata("https://example.com/article");

      expect(result.content).toBeTruthy();
      expect(result.htmlContent).toBeTruthy();
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it("returns null content for minimal HTML", async () => {
      mockFetchHtml("<!DOCTYPE html><html><head></head><body></body></html>");

      const result = await extractMetadata("https://example.com/empty");

      expect(result.content).toBeNull();
      expect(result.htmlContent).toBeNull();
      expect(result.wordCount).toBeNull();
    });
  });

  // ── Word count ──────────────────────────────────────────────────────
  describe("word count", () => {
    it("counts words correctly for known content", async () => {
      const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
      const body = `<article><p>${words}</p></article>`;
      mockFetchHtml(makeHtml({ title: "Words", body }));

      const result = await extractMetadata("https://example.com/words");

      // Readability may include the title in its text output, so check ≥ 200
      expect(result.wordCount).toBeGreaterThanOrEqual(200);
    });

    it("returns null wordCount when no content", async () => {
      mockFetchHtml("<!DOCTYPE html><html><head></head><body></body></html>");

      const result = await extractMetadata("https://example.com/no-content");

      expect(result.wordCount).toBeNull();
    });
  });

  // ── Error handling ──────────────────────────────────────────────────
  describe("error handling", () => {
    it("returns all nulls (except domain) on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await extractMetadata("https://example.com/fail");

      expect(result.domain).toBe("example.com");
      expect(result.title).toBeNull();
      expect(result.description).toBeNull();
      expect(result.ogImage).toBeNull();
      expect(result.content).toBeNull();
      expect(result.htmlContent).toBeNull();
      expect(result.wordCount).toBeNull();
    });

    it("throws for blocked URLs (localhost)", async () => {
      await expect(
        extractMetadata("http://localhost:3000/admin"),
      ).rejects.toThrow("URL is not allowed");
    });

    it("throws for blocked URLs (private IP)", async () => {
      await expect(
        extractMetadata("http://192.168.1.1/secret"),
      ).rejects.toThrow("URL is not allowed");
    });

    it("handles non-HTML response gracefully", async () => {
      mockFetch.mockResolvedValue({
        text: () => Promise.resolve("not html at all, just plain text"),
      });

      const result = await extractMetadata("https://example.com/text");

      expect(result.domain).toBe("example.com");
      // Should not throw — returns best-effort extraction
      expect(result).toHaveProperty("title");
    });
  });

  // ── Twitter delegation ──────────────────────────────────────────────
  describe("Twitter URL handling", () => {
    it("delegates to extractTwitterMetadata for Twitter URLs", async () => {
      const { isTwitterStatusUrl, extractTwitterMetadata } =
        await import("./extract-twitter");

      const twitterResult = {
        title: "Author (@handle) on X",
        description: "Tweet text",
        ogImage: "https://pbs.twimg.com/img.jpg",
        domain: "x.com",
        content: "Tweet text",
        htmlContent: "<p>Tweet text</p>",
        wordCount: 2,
      };

      vi.mocked(isTwitterStatusUrl).mockReturnValue(true);
      vi.mocked(extractTwitterMetadata).mockResolvedValue(twitterResult);

      const result = await extractMetadata("https://x.com/user/status/123456");

      expect(result).toEqual(twitterResult);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
