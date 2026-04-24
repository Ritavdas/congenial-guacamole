import { describe, expect, it } from "vitest";

import { extractYouTubeId, isYouTubeUrl } from "@/lib/extract-youtube";

describe("isYouTubeUrl", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/abcDEF12345",
  ])("returns true for %s", (url) => {
    expect(isYouTubeUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://twitter.com/x/status/1",
    "not a url",
    "",
  ])("returns false for %s", (url) => {
    expect(isYouTubeUrl(url)).toBe(false);
  });
});

describe("extractYouTubeId", () => {
  it("parses watch?v=", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be/", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("parses /shorts/", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/abcDEF12345")).toBe(
      "abcDEF12345",
    );
  });

  it("parses /embed/ and /v/ and /live/", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYouTubeId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("preserves extra query params", () => {
    expect(
      extractYouTubeId(
        // eslint-disable-next-line no-secrets/no-secrets
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-youtube urls", () => {
    expect(extractYouTubeId("https://example.com/v=foo")).toBeNull();
  });

  it("returns null for malformed video ids", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/watch?v=short"),
    ).toBeNull();
  });
});
