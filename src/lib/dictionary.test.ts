import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDefinition } from "./dictionary";
import type { DictionaryResult } from "./dictionary";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Sample API response from dictionaryapi.dev
// ---------------------------------------------------------------------------
const MOCK_API_RESPONSE = [
  {
    word: "hello",
    phonetic: "/həˈloʊ/",
    phonetics: [{ text: "/həˈloʊ/", audio: "https://example.com/hello.mp3" }],
    meanings: [
      {
        partOfSpeech: "exclamation",
        definitions: [
          {
            definition: "Used as a greeting or to begin a phone conversation.",
            example: "Hello there, how are you?",
          },
        ],
      },
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "An utterance of 'hello'; a greeting.",
            example: "She gave a cheery hello.",
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("fetchDefinition", () => {
  it("returns a typed result on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    });

    const result = await fetchDefinition("hello");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/hello",
      expect.objectContaining({ signal: undefined }),
    );

    expect(result).toEqual<DictionaryResult>({
      word: "hello",
      phonetic: "/həˈloʊ/",
      audioUrl: "https://example.com/hello.mp3",
      meanings: [
        {
          partOfSpeech: "exclamation",
          definitions: [
            {
              definition:
                "Used as a greeting or to begin a phone conversation.",
              example: "Hello there, how are you?",
            },
          ],
        },
        {
          partOfSpeech: "noun",
          definitions: [
            {
              definition: "An utterance of 'hello'; a greeting.",
              example: "She gave a cheery hello.",
            },
          ],
        },
      ],
    });
  });

  it("returns null when word is not found (404)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await fetchDefinition("xyznotaword");
    expect(result).toBeNull();
  });

  it("throws on non-404 HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchDefinition("hello")).rejects.toThrow(
      "Dictionary API error: 500",
    );
  });

  it("throws on network errors", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));

    await expect(fetchDefinition("hello")).rejects.toThrow(
      "Network request failed",
    );
  });

  it("passes AbortSignal to fetch", async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    });

    await fetchDefinition("hello", controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("handles abort gracefully", async () => {
    const controller = new AbortController();
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );

    const result = await fetchDefinition("hello", controller.signal);
    expect(result).toBeNull();
  });

  it("handles missing phonetics gracefully", async () => {
    const noPhonetics = [
      {
        word: "test",
        phonetics: [],
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [{ definition: "A procedure." }],
          },
        ],
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(noPhonetics),
    });

    const result = await fetchDefinition("test");
    expect(result).not.toBeNull();
    expect(result!.phonetic).toBeNull();
    expect(result!.audioUrl).toBeNull();
  });

  it("handles empty meanings array", async () => {
    const emptyMeanings = [
      {
        word: "xyz",
        phonetics: [],
        meanings: [],
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(emptyMeanings),
    });

    const result = await fetchDefinition("xyz");
    expect(result).not.toBeNull();
    expect(result!.meanings).toEqual([]);
  });
});
