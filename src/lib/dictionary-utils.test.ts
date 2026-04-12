import { describe, it, expect } from "vitest";
import {
  normalizeSelectedWord,
  extractSentenceAround,
  shouldIgnoreTarget,
  clampPopupPosition,
} from "./dictionary-utils";

// ---------------------------------------------------------------------------
// normalizeSelectedWord
// ---------------------------------------------------------------------------
describe("normalizeSelectedWord", () => {
  it("returns a plain word unchanged", () => {
    expect(normalizeSelectedWord("hello")).toBe("hello");
  });

  it("strips trailing punctuation", () => {
    expect(normalizeSelectedWord("word,")).toBe("word");
    expect(normalizeSelectedWord("word.")).toBe("word");
    expect(normalizeSelectedWord("word!")).toBe("word");
    expect(normalizeSelectedWord("word?")).toBe("word");
    expect(normalizeSelectedWord("word;")).toBe("word");
    expect(normalizeSelectedWord("word:")).toBe("word");
  });

  it("strips surrounding quotes", () => {
    expect(normalizeSelectedWord('"word"')).toBe("word");
    expect(normalizeSelectedWord("'word'")).toBe("word");
    expect(normalizeSelectedWord("\u201Cword\u201D")).toBe("word");
    expect(normalizeSelectedWord("\u2018word\u2019")).toBe("word");
  });

  it("strips surrounding parentheses and brackets", () => {
    expect(normalizeSelectedWord("(word)")).toBe("word");
    expect(normalizeSelectedWord("[word]")).toBe("word");
  });

  it("handles combined surrounding + trailing", () => {
    expect(normalizeSelectedWord('"word",')).toBe("word");
    expect(normalizeSelectedWord("(word)!")).toBe("word");
  });

  it("preserves hyphens inside words", () => {
    expect(normalizeSelectedWord("state-of-the-art")).toBe("state-of-the-art");
  });

  it("preserves apostrophes inside words", () => {
    expect(normalizeSelectedWord("it's")).toBe("it's");
    expect(normalizeSelectedWord("don't")).toBe("don't");
  });

  it("lowercases the result", () => {
    expect(normalizeSelectedWord("Hello")).toBe("hello");
    expect(normalizeSelectedWord("WORD")).toBe("word");
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(normalizeSelectedWord("")).toBeNull();
    expect(normalizeSelectedWord("   ")).toBeNull();
  });

  it("returns null for multi-word selections", () => {
    expect(normalizeSelectedWord("two words")).toBeNull();
    expect(normalizeSelectedWord("hello world")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractSentenceAround
// ---------------------------------------------------------------------------
describe("extractSentenceAround", () => {
  const text =
    "First sentence here. The word appears in this sentence. Last sentence here.";

  it("extracts the sentence containing the word", () => {
    const result = extractSentenceAround(text, "word", 25);
    expect(result).toBe("The word appears in this sentence.");
  });

  it("returns full text if no sentence boundaries found", () => {
    const noDelims = "just a single phrase with word inside";
    const result = extractSentenceAround(noDelims, "word", 28);
    expect(result).toBe(noDelims);
  });

  it("handles word at the very start", () => {
    const result = extractSentenceAround("Word is here. Another.", "word", 0);
    expect(result).toBe("Word is here.");
  });

  it("handles word at the very end", () => {
    const result = extractSentenceAround("Start here. End word.", "word", 16);
    expect(result).toBe("End word.");
  });

  it("returns a window around the position if sentence is too long", () => {
    const longSentence = "A ".repeat(200) + "target " + "B ".repeat(200);
    const result = extractSentenceAround(longSentence, "target", 400);
    expect(result.length).toBeLessThanOrEqual(600);
    expect(result).toContain("target");
  });
});

// ---------------------------------------------------------------------------
// shouldIgnoreTarget
// ---------------------------------------------------------------------------
describe("shouldIgnoreTarget", () => {
  function makeElement(
    tag: string,
    attrs: Record<string, string> = {},
  ): {
    tagName: string;
    hasAttribute: (a: string) => boolean;
    closest: (s: string) => unknown;
  } {
    return {
      tagName: tag.toUpperCase(),
      hasAttribute: (a: string) => a in attrs,
      closest: (selector: string) => {
        // Simulate: if this element matches, return itself
        const matchTags = ["a", "button", "code", "pre"];
        if (
          matchTags.some((t) => selector.includes(t) && tag.toLowerCase() === t)
        ) {
          return makeElement(tag, attrs);
        }
        if (selector.includes("data-highlight") && attrs["data-highlight"]) {
          return makeElement(tag, attrs);
        }
        return null;
      },
    };
  }

  it("ignores clicks inside anchor tags", () => {
    expect(shouldIgnoreTarget(makeElement("a") as unknown as Element)).toBe(
      true,
    );
  });

  it("ignores clicks inside button tags", () => {
    expect(
      shouldIgnoreTarget(makeElement("button") as unknown as Element),
    ).toBe(true);
  });

  it("ignores clicks inside code tags", () => {
    expect(shouldIgnoreTarget(makeElement("code") as unknown as Element)).toBe(
      true,
    );
  });

  it("ignores clicks inside pre tags", () => {
    expect(shouldIgnoreTarget(makeElement("pre") as unknown as Element)).toBe(
      true,
    );
  });

  it("ignores clicks inside highlight marks", () => {
    expect(
      shouldIgnoreTarget(
        makeElement("mark", { "data-highlight": "123" }) as unknown as Element,
      ),
    ).toBe(true);
  });

  it("allows clicks on normal text elements", () => {
    expect(shouldIgnoreTarget(makeElement("span") as unknown as Element)).toBe(
      false,
    );
    expect(shouldIgnoreTarget(makeElement("p") as unknown as Element)).toBe(
      false,
    );
    expect(shouldIgnoreTarget(makeElement("div") as unknown as Element)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// clampPopupPosition
// ---------------------------------------------------------------------------
describe("clampPopupPosition", () => {
  const popupW = 300;
  const popupH = 200;
  const viewportW = 1024;
  const viewportH = 768;

  it("positions popup centered above the word normally", () => {
    const wordRect = {
      top: 400,
      left: 400,
      width: 60,
      height: 20,
      bottom: 420,
      right: 460,
    };
    const pos = clampPopupPosition(
      wordRect,
      viewportW,
      viewportH,
      popupW,
      popupH,
    );
    // Should be above the word, centered
    expect(pos.top).toBeLessThan(wordRect.top);
    expect(pos.left).toBeGreaterThanOrEqual(0);
    expect(pos.left + popupW).toBeLessThanOrEqual(viewportW);
  });

  it("flips to below when word is near the top", () => {
    const wordRect = {
      top: 30,
      left: 400,
      width: 60,
      height: 20,
      bottom: 50,
      right: 460,
    };
    const pos = clampPopupPosition(
      wordRect,
      viewportW,
      viewportH,
      popupW,
      popupH,
    );
    // Should appear below the word
    expect(pos.top).toBeGreaterThanOrEqual(wordRect.bottom);
  });

  it("clamps to left edge when word is near left", () => {
    const wordRect = {
      top: 400,
      left: 10,
      width: 60,
      height: 20,
      bottom: 420,
      right: 70,
    };
    const pos = clampPopupPosition(
      wordRect,
      viewportW,
      viewportH,
      popupW,
      popupH,
    );
    expect(pos.left).toBeGreaterThanOrEqual(8); // small padding
  });

  it("clamps to right edge when word is near right", () => {
    const wordRect = {
      top: 400,
      left: 900,
      width: 60,
      height: 20,
      bottom: 420,
      right: 960,
    };
    const pos = clampPopupPosition(
      wordRect,
      viewportW,
      viewportH,
      popupW,
      popupH,
    );
    expect(pos.left + popupW).toBeLessThanOrEqual(viewportW);
  });
});
