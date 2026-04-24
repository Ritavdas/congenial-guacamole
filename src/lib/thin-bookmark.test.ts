import { describe, expect, it } from "vitest";

import { isThinBookmark } from "@/lib/thin-bookmark";

describe("isThinBookmark", () => {
  it("flags twitter-style link saves with no body and short blurb", () => {
    expect(isThinBookmark({ wordCount: 0, description: "just a tweet" })).toBe(
      true,
    );
    expect(isThinBookmark({ wordCount: null, description: null })).toBe(true);
    expect(isThinBookmark({ wordCount: 12, description: "" })).toBe(true);
  });

  it("keeps articles with substantial body content", () => {
    expect(isThinBookmark({ wordCount: 500, description: null })).toBe(false);
    expect(isThinBookmark({ wordCount: 80, description: null })).toBe(false);
  });

  it("keeps link saves that have a substantial description even with zero body", () => {
    const longDesc = "A".repeat(60);
    expect(isThinBookmark({ wordCount: 0, description: longDesc })).toBe(false);
  });

  it("trims description before measuring length", () => {
    const padded = "  short  ";
    expect(isThinBookmark({ wordCount: 0, description: padded })).toBe(true);
  });
});
