/**
 * AI outcome chip generation.
 *
 * Writes a one-sentence verdict for a finished bookmark ("Worth your time.",
 * "Skim the intro 30%.") which surfaces in the archive view as a chip.
 *
 * Designed to run inside `after()` from `next/server` — errors are logged and
 * swallowed; never throws to the caller.
 */

import { generateText } from "ai";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { getModel, getModelConfig } from "@/lib/ai";

const MAX_CHIP_CHARS = 80;
const REGENERATE_AFTER_MS = 24 * 60 * 60 * 1000;

function sanitizeChip(raw: string): string {
  let chip = raw.trim().replace(/\s+/g, " ");
  // Strip surrounding straight or smart quotes.
  chip = chip.replace(/^["“”'‘’`]+|["“”'‘’`]+$/g, "").trim();
  if (chip.length > MAX_CHIP_CHARS) {
    chip = chip.slice(0, MAX_CHIP_CHARS).trimEnd();
  }
  return chip;
}

export async function generateOutcomeChip(
  bookmarkId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  try {
    const [bookmark] = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        summary: bookmarks.summary,
        description: bookmarks.description,
        content: bookmarks.content,
        outcomeChipAt: bookmarks.outcomeChipAt,
      })
      .from(bookmarks)
      .where(eq(bookmarks.id, bookmarkId));

    if (!bookmark) {
      console.warn(`[outcome] bookmark not found: ${bookmarkId}`);
      return;
    }

    if (
      !options.force &&
      bookmark.outcomeChipAt &&
      Date.now() - bookmark.outcomeChipAt.getTime() < REGENERATE_AFTER_MS
    ) {
      return;
    }

    const body =
      bookmark.summary?.trim() ||
      bookmark.description?.trim() ||
      bookmark.content?.trim().slice(0, 2000);

    if (!body) {
      return;
    }

    const prompt = `You're rating one article a user finished reading. Write ONE concise verdict sentence (max 10 words) helping them remember whether it was worth their time and what to skip. Examples: "Worth your time.", "Skim the intro 30%.", "Code samples only — prose is fluff.", "Useful framework, weak examples."

Title: ${bookmark.title ?? "Untitled"}
Summary: ${body}`;

    const aiConfig = getModelConfig();
    const { text } = await generateText({
      model: getModel(),
      prompt,
      temperature: 0.5,
      maxOutputTokens: 40,
    });

    const chip = sanitizeChip(text);
    if (!chip) {
      console.warn(`[outcome] empty chip for ${bookmarkId}`);
      return;
    }

    await db
      .update(bookmarks)
      .set({
        outcomeChip: chip,
        outcomeChipModel: aiConfig.modelName,
        outcomeChipAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmarkId));
  } catch (err) {
    console.error(
      `[outcome] generateOutcomeChip failed for ${bookmarkId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
