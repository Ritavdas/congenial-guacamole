import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Hoisted mock handles (available inside vi.mock factories) ---

const { mockAfter, mockExtractMetadata, mockDb, MOCK_ID, TEST_URL } =
  vi.hoisted(() => {
    const mockAfter = vi.fn();
    const mockExtractMetadata = vi.fn().mockResolvedValue({
      title: "Extracted Title",
      description: "A test article description",
      ogImage: "https://example.com/og.png",
      content: "Full article content here",
      htmlContent: "<p>Full article content here</p>",
      wordCount: 5,
    });
    const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      transaction: vi.fn(),
      update: vi.fn(),
    };
    return {
      mockAfter,
      mockExtractMetadata,
      mockDb,
      MOCK_ID: "00000000-0000-0000-0000-000000000001",
      TEST_URL: "https://example.com/article",
    };
  });

// --- Module mocks ---

vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mockAfter };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/extract", () => ({
  extractMetadata: mockExtractMetadata,
}));

vi.mock("@/db", () => ({ db: mockDb }));

// --- DB mock helpers ---

/**
 * Builds a chainable select mock whose terminal `.where()` is both
 * thenable (for `await …where()`) and has `.limit()` (for `…where().limit(1)`).
 */
function selectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() =>
        Object.assign(Promise.resolve(rows), {
          limit: vi.fn().mockResolvedValue(rows),
        }),
      ),
    }),
  };
}

function resetDbMocks() {
  // select → no duplicates
  mockDb.select.mockReturnValue(selectChain([]));

  // transaction → insert bookmark, handle tags
  mockDb.transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(() =>
            Object.assign(Promise.resolve(undefined), {
              returning: vi.fn().mockResolvedValue([{ id: MOCK_ID }]),
            }),
          ),
        }),
        select: vi.fn().mockReturnValue(selectChain([])),
      };
      return fn(tx);
    },
  );

  // update (used by enrichment callback)
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

// --- Helpers ---

const POCKET_CSV = [
  "title,url,time_added,tags,status",
  `"Test Article","${TEST_URL}","1700000000","tech","unread"`,
].join("\n");

function createImportRequest(csv: string): NextRequest {
  const formData = new FormData();
  formData.append("file", new Blob([csv], { type: "text/csv" }), "pocket.csv");
  return new NextRequest("http://localhost/api/import/pocket", {
    method: "POST",
    body: formData,
  });
}

// --- Tests ---

describe("Pocket import pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("imported articles should have content after enrichment is triggered", async () => {
    const { POST } = await import("@/app/api/import/pocket/route");
    const response = await POST(createImportRequest(POCKET_CSV));
    const data = await response.json();

    // Import succeeds
    expect(data.imported).toBe(1);
    expect(data.importedIds).toHaveLength(1);

    // BUG: after() should be called to trigger background enrichment,
    // but the current code never calls it — this FAILS before the fix.
    expect(mockAfter).toHaveBeenCalled();
  });

  it("enrichment callback calls extractMetadata for each imported article", async () => {
    const { POST } = await import("@/app/api/import/pocket/route");
    const response = await POST(createImportRequest(POCKET_CSV));
    expect((await response.json()).imported).toBe(1);

    // Grab the after() callback
    expect(mockAfter).toHaveBeenCalledTimes(1);
    const enrichCallback = mockAfter.mock.calls[0][0];
    expect(typeof enrichCallback).toBe("function");

    // Set up db.select to return the bookmark for the enrichment lookup
    mockDb.select.mockReturnValue(
      selectChain([{ id: MOCK_ID, url: TEST_URL }]),
    );

    await enrichCallback();

    expect(mockExtractMetadata).toHaveBeenCalledWith(TEST_URL);
  });
});
