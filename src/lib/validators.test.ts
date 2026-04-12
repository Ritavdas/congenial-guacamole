import { describe, it, expect } from "vitest";
import {
  urlSchema,
  userIdSchema,
  bookmarkIdSchema,
  extensionSaveSchema,
} from "./validators";

describe("urlSchema", () => {
  it("accepts a valid HTTPS URL", () => {
    expect(urlSchema.safeParse("https://example.com").success).toBe(true);
  });

  it("accepts a valid HTTP URL", () => {
    expect(urlSchema.safeParse("http://example.com").success).toBe(true);
  });

  it("rejects a URL without protocol", () => {
    expect(urlSchema.safeParse("example.com").success).toBe(false);
  });

  it("rejects an ftp URL", () => {
    expect(urlSchema.safeParse("ftp://example.com").success).toBe(false);
  });
});

describe("userIdSchema", () => {
  it("accepts a non-empty string", () => {
    expect(userIdSchema.safeParse("user-123").success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(userIdSchema.safeParse("").success).toBe(false);
  });
});

describe("bookmarkIdSchema", () => {
  it("accepts a valid UUID", () => {
    expect(
      bookmarkIdSchema.safeParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        .success,
    ).toBe(true);
  });

  it("rejects an invalid string", () => {
    expect(bookmarkIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("extensionSaveSchema", () => {
  const validPayload = {
    url: "https://example.com",
    userId: "user-123",
    tagIds: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
  };

  it("accepts a valid full object", () => {
    expect(extensionSaveSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts a valid object without tagIds", () => {
    const { tagIds: _, ...withoutTags } = validPayload;
    expect(extensionSaveSchema.safeParse(withoutTags).success).toBe(true);
  });

  it("rejects an invalid URL", () => {
    expect(
      extensionSaveSchema.safeParse({ ...validPayload, url: "not-a-url" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty userId", () => {
    expect(
      extensionSaveSchema.safeParse({ ...validPayload, userId: "" }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID tagId", () => {
    expect(
      extensionSaveSchema.safeParse({
        ...validPayload,
        tagIds: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });
});
