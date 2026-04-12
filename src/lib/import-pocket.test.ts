import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parsePocketCsv,
  parsePocketHtml,
  parsePocketExport,
  parseAlreadyReadJson,
} from "./import-pocket";

// Fixed timestamp for deterministic "fallback to now" assertions
const NOW = new Date("2024-01-15T00:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── parsePocketCsv ────────────────────────────────────────────────

describe("parsePocketCsv", () => {
  it("parses a valid CSV with all columns", () => {
    const csv = [
      "title,url,time_added,tags,status",
      "My Article,https://example.com,1700000000,tech,unread",
    ].join("\n");

    const result = parsePocketCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      url: "https://example.com",
      title: "My Article",
      timeAdded: new Date(1700000000 * 1000),
      tags: ["tech"],
      isRead: false,
    });
  });

  it("handles CSV with missing optional columns (no tags, no status)", () => {
    const csv = [
      "title,url,time_added",
      "Post,https://post.dev,1700000000",
    ].join("\n");

    const result = parsePocketCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual([]);
    expect(result[0].isRead).toBe(false);
  });

  it("returns empty array for empty CSV", () => {
    expect(parsePocketCsv("")).toEqual([]);
  });

  it("returns empty array for header-only CSV", () => {
    expect(parsePocketCsv("title,url,time_added,tags,status\n")).toEqual([]);
  });

  it("returns empty array when url column is missing", () => {
    const csv = ["title,time_added", "Hello,1700000000"].join("\n");
    expect(parsePocketCsv(csv)).toEqual([]);
  });

  it("handles quoted fields with commas inside", () => {
    const csv = [
      "title,url,time_added,tags,status",
      '"Hello, World",https://example.com,1700000000,"a,b,c",unread',
    ].join("\n");

    const result = parsePocketCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Hello, World");
    expect(result[0].tags).toEqual(["a", "b", "c"]);
  });

  it("parses multiple tags separated by commas", () => {
    const csv = [
      "title,url,time_added,tags,status",
      "Post,https://x.com,1700000000,js,python,rust,unread",
    ].join("\n");

    // Without quoting, commas split into columns, so only "js" ends up in tags column
    // The user likely means quoted tags; test the quoted variant instead
    const csvQuoted = [
      "title,url,time_added,tags,status",
      'Post,https://x.com,1700000000,"js,python,rust",unread',
    ].join("\n");

    const result = parsePocketCsv(csvQuoted);
    expect(result[0].tags).toEqual(["js", "python", "rust"]);
  });

  it('marks status "read" as isRead = true', () => {
    const csv = [
      "title,url,time_added,tags,status",
      "A,https://a.com,1700000000,,read",
    ].join("\n");

    expect(parsePocketCsv(csv)[0].isRead).toBe(true);
  });

  it('marks status "archived" as isRead = true', () => {
    const csv = [
      "title,url,time_added,tags,status",
      "A,https://a.com,1700000000,,archived",
    ].join("\n");

    expect(parsePocketCsv(csv)[0].isRead).toBe(true);
  });

  it("falls back to current time for invalid time_added", () => {
    const csv = [
      "title,url,time_added,tags,status",
      "A,https://a.com,not-a-number,,unread",
    ].join("\n");

    const result = parsePocketCsv(csv);
    expect(result[0].timeAdded.getTime()).toBe(NOW.getTime());
  });

  it("falls back to URL as title when title is empty", () => {
    const csv = [
      "title,url,time_added",
      ",https://example.com,1700000000",
    ].join("\n");

    expect(parsePocketCsv(csv)[0].title).toBe("https://example.com");
  });

  it("parses multiple rows", () => {
    const csv = [
      "title,url,time_added,tags,status",
      "A,https://a.com,1700000000,,unread",
      "B,https://b.com,1700000001,,read",
    ].join("\n");

    const result = parsePocketCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe("https://a.com");
    expect(result[1].url).toBe("https://b.com");
  });

  it("handles \\r\\n line endings", () => {
    const csv = "title,url,time_added\r\nA,https://a.com,1700000000\r\n";

    const result = parsePocketCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://a.com");
  });
});

// ─── parsePocketHtml ───────────────────────────────────────────────

describe("parsePocketHtml", () => {
  it("parses a valid Netscape bookmark HTML", () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL>
        <DT><A HREF="https://example.com" TIME_ADDED="1700000000" TAGS="tech,news">Example</A>
      </DL>
    `;

    const result = parsePocketHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      url: "https://example.com",
      title: "Example",
      timeAdded: new Date(1700000000 * 1000),
      tags: ["tech", "news"],
      isRead: false,
    });
  });

  it("handles missing tags attribute", () => {
    const html = `<DT><A HREF="https://a.com" TIME_ADDED="1700000000">Title</A>`;

    const result = parsePocketHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual([]);
  });

  it("parses multiple bookmarks", () => {
    const html = `
      <DT><A HREF="https://a.com" TIME_ADDED="1700000000">A</A>
      <DT><A HREF="https://b.com" TIME_ADDED="1700000001">B</A>
    `;

    const result = parsePocketHtml(html);
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe("https://a.com");
    expect(result[1].url).toBe("https://b.com");
  });

  it("skips entries with empty href", () => {
    const html = `
      <DT><A HREF="" TIME_ADDED="1700000000">No URL</A>
      <DT><A HREF="https://valid.com" TIME_ADDED="1700000000">Valid</A>
    `;

    const result = parsePocketHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://valid.com");
  });

  it("always sets isRead to false", () => {
    const html = `<DT><A HREF="https://a.com" TIME_ADDED="1700000000">A</A>`;
    expect(parsePocketHtml(html)[0].isRead).toBe(false);
  });

  it("falls back to hostname when text content is empty", () => {
    const html = `<DT><A HREF="https://example.com/path" TIME_ADDED="1700000000"></A>`;

    const result = parsePocketHtml(html);
    expect(result[0].title).toBe("example.com");
  });

  it("falls back to current time when time_added is missing", () => {
    const html = `<DT><A HREF="https://a.com">Title</A>`;

    const result = parsePocketHtml(html);
    expect(result[0].timeAdded.getTime()).toBe(NOW.getTime());
  });

  it("returns empty array for HTML with no bookmarks", () => {
    expect(parsePocketHtml("<html><body>Nothing</body></html>")).toEqual([]);
  });
});

// ─── parsePocketExport (auto-detection) ────────────────────────────

describe("parsePocketExport", () => {
  it('detects CSV when content starts with "title,"', () => {
    const csv = [
      "title,url,time_added,tags,status",
      "A,https://a.com,1700000000,,unread",
    ].join("\n");

    const result = parsePocketExport(csv);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://a.com");
  });

  it('detects CSV when content starts with quoted "title"', () => {
    const csv = [
      '"title","url","time_added","tags","status"',
      '"A","https://a.com","1700000000","","unread"',
    ].join("\n");

    const result = parsePocketExport(csv);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://a.com");
  });

  it("detects HTML when content contains <!DOCTYPE", () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DT><A HREF="https://a.com" TIME_ADDED="1700000000">A</A>`;

    const result = parsePocketExport(html);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://a.com");
  });

  it("detects HTML when content contains <DT>", () => {
    const html = `<DT><A HREF="https://a.com" TIME_ADDED="1700000000">A</A>`;

    const result = parsePocketExport(html);
    expect(result).toHaveLength(1);
  });

  it("detects HTML when content contains lowercase <dt>", () => {
    const html = `<dt><a href="https://a.com" time_added="1700000000">A</a>`;

    const result = parsePocketExport(html);
    expect(result).toHaveLength(1);
  });

  it("tries CSV first then falls back to HTML for ambiguous content", () => {
    // Content that doesn't match any explicit check but is valid CSV
    const csv = ["url,title", "https://a.com,Title A"].join("\n");

    const result = parsePocketExport(csv);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://a.com");
  });

  it("falls back to HTML when CSV returns no results", () => {
    // Content that fails CSV (no url column) but works as HTML
    const html = `<dl><dt><a href="https://a.com" time_added="1700000000">A</a></dl>`;

    const result = parsePocketExport(html);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://a.com");
  });

  it("returns empty array for completely unrecognized content", () => {
    expect(parsePocketExport("just random text")).toEqual([]);
  });
});

// ─── parseAlreadyReadJson ──────────────────────────────────────────

describe("parseAlreadyReadJson", () => {
  it("parses JSON with items array containing url objects", () => {
    const json = JSON.stringify({
      items: [{ url: "https://a.com" }, { url: "https://b.com" }],
    });

    expect(parseAlreadyReadJson(json)).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("parses direct array format", () => {
    const json = JSON.stringify([
      { url: "https://a.com" },
      { url: "https://b.com" },
    ]);

    expect(parseAlreadyReadJson(json)).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseAlreadyReadJson("{broken")).toEqual([]);
    expect(parseAlreadyReadJson("not json at all")).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(parseAlreadyReadJson("[]")).toEqual([]);
    expect(parseAlreadyReadJson('{"items":[]}')).toEqual([]);
  });

  it("filters out objects without url field", () => {
    const json = JSON.stringify([
      { url: "https://a.com" },
      { title: "no url here" },
      { url: "https://b.com" },
    ]);

    expect(parseAlreadyReadJson(json)).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("returns empty array for non-array data", () => {
    expect(parseAlreadyReadJson('{"url":"https://a.com"}')).toEqual([]);
  });
});
