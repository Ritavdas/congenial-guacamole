import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks – vi.hoisted runs before vi.mock factories are evaluated
// ---------------------------------------------------------------------------

const { mockDb, mockExtract } = vi.hoisted(() => {
  const mockDb: Record<string, any> = {};
  const mockExtract = vi.fn().mockResolvedValue({
    title: "Mock Title",
    description: "Mock desc",
    ogImage: null,
    content: "",
    htmlContent: "",
    wordCount: 0,
  });
  return { mockDb, mockExtract };
});

vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: vi.fn((fn: () => void) => fn()) };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/db", () => ({ db: mockDb }));
vi.mock("@/lib/extract", () => ({ extractMetadata: mockExtract }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as savePost } from "@/app/api/extension/save/route";
import { PATCH } from "@/app/api/extension/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSaveRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/extension/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/extension", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const USER_ID = "user_abc123";
const BOOKMARK_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const TAG_ID_1 = "550e8400-e29b-41d4-a716-446655440001";
const TAG_ID_2 = "550e8400-e29b-41d4-a716-446655440002";

/**
 * Build a chainable Drizzle-style mock.
 *
 * Every Drizzle query-builder method returns `this` so calls can be chained
 * (e.g. `db.select().from().where().limit()`). The provided `terminalValue`
 * is returned as a resolved promise from the configured `terminalMethod`.
 */
function createChainMock(
  terminalValue: unknown,
  terminalMethod: "limit" | "returning" | "then" = "limit",
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "returning",
    "delete",
    "update",
    "set",
    "limit",
    "innerJoin",
    "leftJoin",
    "orderBy",
    "onConflictDoNothing",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // The terminal call resolves the final value
  chain[terminalMethod] = vi.fn().mockResolvedValue(terminalValue);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests – POST /api/extension/save
// ---------------------------------------------------------------------------

describe("POST /api/extension/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mockDb proxy for each test
    for (const key of Object.keys(mockDb)) delete mockDb[key];
  });

  // 1. New URL
  it("inserts a new bookmark and returns action:'created'", async () => {
    const insertedBookmark = {
      id: BOOKMARK_ID,
      url: "https://example.com",
      domain: "example.com",
      userId: USER_ID,
    };

    // First db call: select().from().where().limit() → no existing bookmark
    const selectChain = createChainMock([]);
    // Second db call: insert().values().returning() → inserted bookmark
    const insertChain = createChainMock([insertedBookmark], "returning");
    // Third db call (background enrichment): update().set().where() → void
    const updateChain = createChainMock(undefined, "returning");

    let callCount = 0;
    mockDb.select = vi.fn().mockImplementation(() => {
      callCount++;
      return selectChain;
    });
    mockDb.insert = vi.fn().mockImplementation(() => insertChain);
    mockDb.update = vi.fn().mockImplementation(() => updateChain);

    const res = await savePost(
      createSaveRequest({ url: "https://example.com", userId: USER_ID }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.action).toBe("created");
    expect(json.bookmark.id).toBe(BOOKMARK_ID);
    expect(json.bookmark.domain).toBe("example.com");
  });

  // 2. Existing URL
  it("returns action:'existing' with bookmark data and tags", async () => {
    const existingBookmark = {
      id: BOOKMARK_ID,
      title: "Example",
      domain: "example.com",
      ogImage: null,
      createdAt: new Date().toISOString(),
    };
    const associatedTags = [{ id: TAG_ID_1, name: "dev", color: "#ff0000" }];

    // select existing bookmark → found
    const selectChain = createChainMock([existingBookmark]);
    // select associated tags → list
    const tagsChain = createChainMock(associatedTags, "then");

    let selectCallNum = 0;
    mockDb.select = vi.fn().mockImplementation(() => {
      selectCallNum++;
      if (selectCallNum === 1) return selectChain;
      // Second select for tags – returns the chain that resolves via where()
      const tagChain: Record<string, ReturnType<typeof vi.fn>> = {};
      const methods = [
        "select",
        "from",
        "where",
        "innerJoin",
        "leftJoin",
        "limit",
      ];
      for (const m of methods) {
        tagChain[m] = vi.fn().mockReturnValue(tagChain);
      }
      tagChain.where = vi.fn().mockResolvedValue(associatedTags);
      return tagChain;
    });

    const res = await savePost(
      createSaveRequest({ url: "https://example.com", userId: USER_ID }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.action).toBe("existing");
    expect(json.bookmark.id).toBe(BOOKMARK_ID);
    expect(json.bookmark.tags).toEqual(associatedTags);
  });

  // 3. URL normalisation
  it("normalises URL before checking for duplicates", async () => {
    const existingBookmark = {
      id: BOOKMARK_ID,
      title: "Example",
      domain: "example.com",
      ogImage: null,
      createdAt: new Date().toISOString(),
    };

    const selectChain = createChainMock([existingBookmark]);

    let selectCallNum = 0;
    mockDb.select = vi.fn().mockImplementation(() => {
      selectCallNum++;
      if (selectCallNum === 1) return selectChain;
      const tagChain: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const m of [
        "select",
        "from",
        "where",
        "innerJoin",
        "leftJoin",
        "limit",
      ]) {
        tagChain[m] = vi.fn().mockReturnValue(tagChain);
      }
      tagChain.where = vi.fn().mockResolvedValue([]);
      return tagChain;
    });

    // Mixed-case URL with trailing slash should still match
    const res = await savePost(
      createSaveRequest({
        url: "https://Example.COM/",
        userId: USER_ID,
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.action).toBe("existing");
  });

  // 4. Invalid URL → 400
  it("returns 400 for an invalid URL", async () => {
    const res = await savePost(
      createSaveRequest({ url: "not-a-url", userId: USER_ID }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
  });

  // 5. Missing userId → 400
  it("returns 400 when userId is missing", async () => {
    const res = await savePost(
      createSaveRequest({ url: "https://example.com" }),
    );
    expect(res.status).toBe(400);
  });

  // 6. Empty body → 400
  it("returns 400 for an empty body", async () => {
    const res = await savePost(createSaveRequest({}));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests – PATCH /api/extension (tag update)
// ---------------------------------------------------------------------------

describe("PATCH /api/extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockDb)) delete mockDb[key];
  });

  // 7. Valid tag update
  it("deletes old tags, inserts new ones, returns success", async () => {
    // Verify bookmark exists
    const selectChain = createChainMock([{ id: BOOKMARK_ID }]);
    // Delete existing tags
    const deleteChain = createChainMock(undefined, "then");
    // Insert new tags
    const insertChain = createChainMock(undefined, "then");

    mockDb.select = vi.fn().mockReturnValue(selectChain);
    mockDb.delete = vi.fn().mockImplementation(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.where = vi.fn().mockResolvedValue(undefined);
      return chain;
    });
    mockDb.insert = vi.fn().mockImplementation(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.values = vi.fn().mockReturnValue(chain);
      chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
      return chain;
    });

    const res = await PATCH(
      createPatchRequest({
        bookmarkId: BOOKMARK_ID,
        userId: USER_ID,
        tagIds: [TAG_ID_1, TAG_ID_2],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  // 8. Bookmark not found → 404
  it("returns 404 when bookmark does not belong to user", async () => {
    const selectChain = createChainMock([]);
    mockDb.select = vi.fn().mockReturnValue(selectChain);

    const res = await PATCH(
      createPatchRequest({
        bookmarkId: BOOKMARK_ID,
        userId: USER_ID,
        tagIds: [TAG_ID_1],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Bookmark not found");
  });

  // 9. Invalid bookmarkId → 400
  it("returns 400 for invalid bookmarkId", async () => {
    const res = await PATCH(
      createPatchRequest({
        bookmarkId: "not-a-uuid",
        userId: USER_ID,
        tagIds: [],
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
  });

  // 10. Empty tagIds → removes all tags
  it("removes all tags when tagIds is empty", async () => {
    const selectChain = createChainMock([{ id: BOOKMARK_ID }]);
    mockDb.select = vi.fn().mockReturnValue(selectChain);
    mockDb.delete = vi.fn().mockImplementation(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.where = vi.fn().mockResolvedValue(undefined);
      return chain;
    });

    const res = await PATCH(
      createPatchRequest({
        bookmarkId: BOOKMARK_ID,
        userId: USER_ID,
        tagIds: [],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
    // insert should NOT be called when tagIds is empty
    expect(mockDb.insert).toBeUndefined();
  });
});
