import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockAuth = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("ai", () => ({
  generateText: (opts: unknown) => mockGenerateText(opts),
}));

vi.mock("@/lib/ai", () => ({
  getModel: () => "mock-model",
}));

// ---------------------------------------------------------------------------
// Import the handler after mocks are set up
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/define-context/route";

beforeEach(() => {
  mockAuth.mockReset();
  mockGenerateText.mockReset();
});

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/define-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/define-context", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await POST(
      makeRequest({ word: "hello", sentence: "Hello world" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });

    const res = await POST(makeRequest({ word: "hello" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid input");
  });

  it("returns 400 when word is empty", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });

    const res = await POST(
      makeRequest({ word: "", sentence: "Some sentence" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when sentence exceeds max length", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });

    const res = await POST(
      makeRequest({ word: "hello", sentence: "a".repeat(2001) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns AI-generated context explanation on success", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    mockGenerateText.mockResolvedValue({
      text: "In this context, 'paradigm' refers to a mental framework.",
    });

    const res = await POST(
      makeRequest({
        word: "paradigm",
        sentence: "This represents a paradigm shift in technology.",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.explanation).toBe(
      "In this context, 'paradigm' refers to a mental framework.",
    );
  });

  it("passes word and sentence to AI prompt", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    mockGenerateText.mockResolvedValue({ text: "explanation" });

    await POST(
      makeRequest({
        word: "synergy",
        sentence: "We need more synergy between teams.",
      }),
    );

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain("synergy");
    expect(callArgs.prompt).toContain("We need more synergy between teams.");
  });

  it("returns 500 when AI call fails", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    mockGenerateText.mockRejectedValue(new Error("AI provider down"));

    const res = await POST(
      makeRequest({
        word: "hello",
        sentence: "Hello there.",
      }),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to generate context");
  });
});
