/**
 * Pure helper utilities for dictionary lookup feature.
 * No React, no DOM side-effects — fully testable in Node.
 */

/**
 * Normalize a double-clicked text selection into a clean word
 * suitable for dictionary lookup. Returns null if the selection
 * is empty, multi-word, or otherwise unsuitable.
 */
export function normalizeSelectedWord(raw: string): string | null {
  let word = raw.trim();
  if (!word) return null;

  // Strip outer punctuation/brackets/quotes (possibly nested)
  word = word
    .replace(/^[\s"'""''\u201C\u201D\u2018\u2019(\[{]+/, "")
    .replace(/[\s"'""''\u201C\u201D\u2018\u2019)\]},.:;!?]+$/, "");

  if (!word) return null;

  // Reject multi-word selections (contain whitespace)
  if (/\s/.test(word)) return null;

  return word.toLowerCase();
}

/**
 * Extract the sentence (or a reasonable window) around a word
 * at a given character position in the article text.
 */
export function extractSentenceAround(
  text: string,
  _word: string,
  position: number,
): string {
  const MAX_LENGTH = 500;

  // Find sentence boundaries around the position
  const sentenceEnders = /[.!?]/g;
  let sentenceStart = 0;
  let sentenceEnd = text.length;

  // Find the end of the previous sentence (start of current)
  let match: RegExpExecArray | null;
  while ((match = sentenceEnders.exec(text)) !== null) {
    if (match.index < position) {
      sentenceStart = match.index + 1;
    } else {
      sentenceEnd = match.index + 1;
      break;
    }
  }

  let sentence = text.slice(sentenceStart, sentenceEnd).trim();

  // If the sentence is too long, window around the position
  if (sentence.length > MAX_LENGTH) {
    const relPos = position - sentenceStart;
    const windowStart = Math.max(0, relPos - MAX_LENGTH / 2);
    const windowEnd = Math.min(sentence.length, relPos + MAX_LENGTH / 2);
    sentence = sentence.slice(windowStart, windowEnd).trim();
  }

  return sentence;
}

/**
 * Check if a target element should be ignored for dictionary lookup.
 * We skip interactive elements, code blocks, and existing highlights.
 */
export function shouldIgnoreTarget(element: Element): boolean {
  const ignore = "a, button, code, pre, mark[data-highlight]";
  return element.closest(ignore) !== null;
}

/**
 * Calculate viewport-safe popup position for a floating card
 * anchored to a word rectangle. Prefers above; flips below if needed.
 */
export function clampPopupPosition(
  wordRect: {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  },
  viewportW: number,
  viewportH: number,
  popupW: number,
  popupH: number,
): { top: number; left: number } {
  const PADDING = 8;
  const GAP = 8;

  // Horizontal: center on the word, clamp to viewport
  let left = wordRect.left + wordRect.width / 2 - popupW / 2;
  left = Math.max(PADDING, Math.min(left, viewportW - popupW - PADDING));

  // Vertical: prefer above the word, flip below if not enough space
  let top: number;
  if (wordRect.top - popupH - GAP >= PADDING) {
    top = wordRect.top - popupH - GAP;
  } else {
    top = wordRect.bottom + GAP;
  }

  return { top, left };
}
