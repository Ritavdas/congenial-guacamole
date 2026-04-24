"use client";

/**
 * Renders a YouTube auto-generated transcript as readable paragraphs.
 * The raw transcript is one long string with no real punctuation breaks
 * (auto-captions don't have paragraphs), so we group sentences into
 * paragraphs of ~60 words each, splitting on sentence enders when present
 * and falling back to word-count chunks otherwise.
 */

const WORDS_PER_PARAGRAPH = 60;

function splitIntoParagraphs(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  // Try sentence-aware splitting first.
  const sentences = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z[("'♪])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    const paragraphs: string[] = [];
    let buf: string[] = [];
    let bufWords = 0;
    for (const s of sentences) {
      buf.push(s);
      bufWords += s.split(/\s+/).length;
      if (bufWords >= WORDS_PER_PARAGRAPH) {
        paragraphs.push(buf.join(" "));
        buf = [];
        bufWords = 0;
      }
    }
    if (buf.length) paragraphs.push(buf.join(" "));
    return paragraphs;
  }

  // No usable sentence boundaries (typical for music / sung lyrics) —
  // fall back to fixed-size word chunks.
  const words = cleaned.split(/\s+/);
  const paragraphs: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_PARAGRAPH) {
    paragraphs.push(words.slice(i, i + WORDS_PER_PARAGRAPH).join(" "));
  }
  return paragraphs;
}

interface YouTubeTranscriptProps {
  text: string;
}

export function YouTubeTranscript({ text }: YouTubeTranscriptProps) {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--reader-fg, currentColor) 8%, transparent)",
            color: "var(--reader-muted, var(--muted-foreground))",
          }}
        >
          Transcript
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--reader-muted, var(--muted-foreground))" }}
        >
          Auto-generated, lightly formatted
        </span>
      </div>
      <div className="space-y-4 leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
