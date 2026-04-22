import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

/** Returns a proxy where every property access returns another proxy (chainable),
 *  and awaiting the chain resolves to `result`. */
function createQueryChain(result: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      // Any chained method call returns a new chainable proxy
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const mockExecute = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "execute") return mockExecute;
        if (prop === "select") return mockSelect;
        // For any other property, return a no-op to avoid crashes
        return () => {};
      },
    },
  ),
}));

// ─── Imports (must come after vi.mock calls) ────────────────────────

import {
  getTagBuckets,
  getBookmarksByTag,
  getUntaggedBookmarks,
} from "@/lib/actions";

// ─── Helpers ────────────────────────────────────────────────────────

function makeBookmarkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bk-1",
    userId: "test-user",
    url: "https://example.com",
    title: "Example",
    description: null,
    ogImage: null,
    content: null,
    htmlContent: null,
    summary: null,
    wordCount: null,
    domain: "example.com",
    isRead: false,
    isArchived: false,
    isFavorite: false,
    createdAt: new Date("2024-06-01"),
    updatedAt: new Date("2024-06-01"),
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getTagBuckets ──────────────────────────────────────────────────

describe("getTagBuckets", () => {
  it("returns 2 buckets with correct counts, recent titles, and lastActivity", async () => {
    // Query 1: tags with counts
    mockExecute.mockResolvedValueOnce([
      {
        id: "tag-1",
        name: "tech",
        color: "#ff0000",
        created_at: "2024-01-01T00:00:00Z",
        bookmark_count: "3",
        last_activity: "2024-06-15T00:00:00Z",
      },
      {
        id: "tag-2",
        name: "design",
        color: "#00ff00",
        created_at: "2024-02-01T00:00:00Z",
        bookmark_count: "1",
        last_activity: "2024-05-10T00:00:00Z",
      },
    ]);

    // Query 2: recent bookmarks per tag
    mockExecute.mockResolvedValueOnce([
      { tag_id: "tag-1", title: "Article A", domain: "a.com", og_image: null },
      {
        tag_id: "tag-1",
        title: "Article B",
        domain: "b.com",
        og_image: "img.png",
      },
      { tag_id: "tag-1", title: "Article C", domain: "c.com", og_image: null },
      {
        tag_id: "tag-2",
        title: "Design Post",
        domain: "d.com",
        og_image: null,
      },
    ]);

    // Query 3: untagged row
    mockExecute.mockResolvedValueOnce([
      {
        count: "2",
        latest_title: "Untagged One",
        latest_domain: "u.com",
        latest_og_image: null,
      },
    ]);

    const result = await getTagBuckets();

    expect(result.tagBuckets).toHaveLength(2);

    const tech = result.tagBuckets[0];
    expect(tech.id).toBe("tag-1");
    expect(tech.name).toBe("tech");
    expect(tech.bookmarkCount).toBe(3);
    expect(tech.recentTitles).toHaveLength(3);
    expect(tech.recentTitles[0]).toEqual({
      title: "Article A",
      domain: "a.com",
      ogImage: null,
    });
    expect(tech.lastActivity).toEqual(new Date("2024-06-15T00:00:00Z"));

    const design = result.tagBuckets[1];
    expect(design.bookmarkCount).toBe(1);
    expect(design.recentTitles).toHaveLength(1);

    expect(result.untaggedCount).toBe(2);
    expect(result.latestUntagged).toEqual({
      title: "Untagged One",
      domain: "u.com",
      ogImage: null,
    });
  });

  it("returns empty buckets and untaggedCount 0 when user has no tags/bookmarks", async () => {
    mockExecute.mockResolvedValueOnce([]); // no tags
    mockExecute.mockResolvedValueOnce([]); // no recent
    mockExecute.mockResolvedValueOnce([
      {
        count: "0",
        latest_title: null,
        latest_domain: null,
        latest_og_image: null,
      },
    ]);

    const result = await getTagBuckets();

    expect(result.tagBuckets).toEqual([]);
    expect(result.untaggedCount).toBe(0);
    expect(result.latestUntagged).toBeNull();
  });

  it("excludes archived bookmarks from untagged count (returns 0 when all untagged are archived)", async () => {
    mockExecute.mockResolvedValueOnce([]); // no tags
    mockExecute.mockResolvedValueOnce([]); // no recent
    // The SQL itself filters is_archived = false, so DB returns count 0
    mockExecute.mockResolvedValueOnce([
      {
        count: "0",
        latest_title: null,
        latest_domain: null,
        latest_og_image: null,
      },
    ]);

    const result = await getTagBuckets();

    expect(result.untaggedCount).toBe(0);
    expect(result.latestUntagged).toBeNull();
  });

  it("returns buckets sorted by lastActivity descending (order from DB preserved)", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        id: "tag-a",
        name: "older",
        color: "#aaa",
        created_at: "2024-01-01T00:00:00Z",
        bookmark_count: "1",
        last_activity: "2024-08-01T00:00:00Z",
      },
      {
        id: "tag-b",
        name: "newest",
        color: "#bbb",
        created_at: "2024-01-01T00:00:00Z",
        bookmark_count: "2",
        last_activity: "2024-07-01T00:00:00Z",
      },
    ]);
    mockExecute.mockResolvedValueOnce([]); // no recent titles
    mockExecute.mockResolvedValueOnce([
      {
        count: "0",
        latest_title: null,
        latest_domain: null,
        latest_og_image: null,
      },
    ]);

    const result = await getTagBuckets();

    expect(result.tagBuckets[0].lastActivity.getTime()).toBeGreaterThan(
      result.tagBuckets[1].lastActivity.getTime(),
    );
  });

  it("handles a tag with 0 bookmarks — bookmarkCount 0, recentTitles empty, lastActivity falls back to createdAt", async () => {
    const createdAt = "2024-03-15T12:00:00Z";
    mockExecute.mockResolvedValueOnce([
      {
        id: "empty-tag",
        name: "empty",
        color: "#000",
        created_at: createdAt,
        bookmark_count: "0",
        last_activity: null,
      },
    ]);
    mockExecute.mockResolvedValueOnce([]); // no recent bookmarks
    mockExecute.mockResolvedValueOnce([
      {
        count: "0",
        latest_title: null,
        latest_domain: null,
        latest_og_image: null,
      },
    ]);

    const result = await getTagBuckets();

    const bucket = result.tagBuckets[0];
    expect(bucket.bookmarkCount).toBe(0);
    expect(bucket.recentTitles).toEqual([]);
    expect(bucket.lastActivity).toEqual(new Date(createdAt));
  });
});

// ─── getBookmarksByTag ──────────────────────────────────────────────

describe("getBookmarksByTag", () => {
  it("returns tag info and bookmarks for a valid tagId", async () => {
    const tagRecord = {
      id: "tag-1",
      user_id: "test-user",
      name: "tech",
      color: "#ff0000",
      created_at: "2024-01-01T00:00:00Z",
    };

    mockExecute.mockResolvedValueOnce([
      {
        tag: tagRecord,
        bookmarks: [
          {
            id: "bk-1",
            url: "https://example.com/a",
            title: "Post A",
            ogImage: null,
            domain: "example.com",
            wordCount: null,
            isFavorite: false,
            isRead: false,
            isArchived: false,
            createdAt: "2024-06-01T00:00:00Z",
            tags: [{ id: "tag-1", name: "tech", color: "#ff0000" }],
          },
          {
            id: "bk-2",
            url: "https://example.com/b",
            title: "Post B",
            ogImage: null,
            domain: "example.com",
            wordCount: null,
            isFavorite: false,
            isRead: false,
            isArchived: false,
            createdAt: "2024-05-30T00:00:00Z",
            tags: [{ id: "tag-1", name: "tech", color: "#ff0000" }],
          },
        ],
      },
    ]);

    const result = await getBookmarksByTag("tag-1");

    expect(result.tag).toEqual({
      id: "tag-1",
      userId: "test-user",
      name: "tech",
      color: "#ff0000",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    expect(result.bookmarks).toHaveLength(2);
    expect(result.bookmarks[0].tags).toEqual([
      { id: "tag-1", name: "tech", color: "#ff0000" },
    ]);
    expect(result.bookmarks[0].createdAt).toEqual(
      new Date("2024-06-01T00:00:00Z"),
    );
  });

  it("returns tag + empty bookmarks array when tag has no bookmarks", async () => {
    const tagRecord = {
      id: "tag-empty",
      user_id: "test-user",
      name: "empty",
      color: "#000",
      created_at: "2024-01-01T00:00:00Z",
    };

    mockExecute.mockResolvedValueOnce([{ tag: tagRecord, bookmarks: [] }]);

    const result = await getBookmarksByTag("tag-empty");

    expect(result.tag.id).toBe("tag-empty");
    expect(result.bookmarks).toEqual([]);
  });

  it('throws "Tag not found" for invalid tagId', async () => {
    mockExecute.mockResolvedValueOnce([{ tag: null, bookmarks: [] }]);

    await expect(getBookmarksByTag("nonexistent")).rejects.toThrow(
      "Tag not found",
    );
  });
});

// ─── getUntaggedBookmarks ───────────────────────────────────────────

describe("getUntaggedBookmarks", () => {
  it("returns bookmarks with no tags", async () => {
    const bk1 = makeBookmarkRow({ id: "bk-u1", title: "Untagged 1" });
    const bk2 = makeBookmarkRow({ id: "bk-u2", title: "Untagged 2" });

    mockSelect.mockReturnValueOnce(createQueryChain([bk1, bk2]));

    const result = await getUntaggedBookmarks();

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Untagged 1");
    expect(result[0].tags).toEqual([]);
    expect(result[1].tags).toEqual([]);
  });

  it("excludes archived bookmarks (relies on SQL filter, mocked at DB level)", async () => {
    // The SQL WHERE clause filters isArchived = false; we mock the DB returning
    // only non-archived rows as the DB would.
    const bk = makeBookmarkRow({ id: "bk-active", isArchived: false });
    mockSelect.mockReturnValueOnce(createQueryChain([bk]));

    const result = await getUntaggedBookmarks();

    expect(result).toHaveLength(1);
    expect(result[0].isArchived).toBe(false);
  });

  it("returns empty array when all bookmarks are tagged", async () => {
    mockSelect.mockReturnValueOnce(createQueryChain([]));

    const result = await getUntaggedBookmarks();

    expect(result).toEqual([]);
  });
});
