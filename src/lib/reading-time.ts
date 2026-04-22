const WORDS_PER_MINUTE = 225;

export function estimateReadMinutes(
  wordCount: number | null | undefined,
): number {
  if (!wordCount || wordCount <= 0) return 1;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

export type ReadBucket = "quick" | "medium" | "deep";

export function readBucket(wordCount: number | null | undefined): ReadBucket {
  const minutes = estimateReadMinutes(wordCount);
  if (minutes < 5) return "quick";
  if (minutes <= 15) return "medium";
  return "deep";
}
