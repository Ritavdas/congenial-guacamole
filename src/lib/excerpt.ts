/**
 * Daily excerpt-of-the-day generation.
 *
 * Picks a random previously-finished bookmark and uses an LLM to extract one
 * memorable quote. Result is cached per user per day.
 *
 * Tz caveat: V1 buckets days by UTC. Per-user timezones are V2.
 *
 * Soft enhancement — errors are logged and swallowed; never throws.
 */

import { generateText } from "ai";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks, dailyExcerpts } from "@/db/schema";
import { getModel } from "@/lib/ai";

const MAX_SOURCE_CHARS = 6000;
const MAX_EXCERPT_CHARS = 320;

export type DailyExcerptResult = {
  excerpt: string;
  bookmarkId: string;
  bookmarkTitle: string;
  bookmarkDomain: string | null;
};

function sanitizeExcerpt(raw: string): string {
  let text = raw.trim().replace(/\s+/g, " ");
  text = text.replace(/^["“”'‘’`]+|["“”'‘’`]+$/g, "").trim();
  if (text.length > MAX_EXCERPT_CHARS) {
    text = text.slice(0, MAX_EXCERPT_CHARS).trimEnd();
  }
  return text;
}

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateDailyExcerpt(
  userId: string,
): Promise<DailyExcerptResult | null> {
  try {
    const today = todayUtcDateString();

    const [existing] = await db
      .select({
        excerpt: dailyExcerpts.excerpt,
        bookmarkId: dailyExcerpts.bookmarkId,
        bookmarkTitle: bookmarks.title,
        bookmarkDomain: bookmarks.domain,
      })
      .from(dailyExcerpts)
      .innerJoin(bookmarks, eq(dailyExcerpts.bookmarkId, bookmarks.id))
      .where(
        and(eq(dailyExcerpts.userId, userId), eq(dailyExcerpts.date, today)),
      )
      .limit(1);

    if (existing) {
      return {
        excerpt: existing.excerpt,
        bookmarkId: existing.bookmarkId,
        bookmarkTitle: existing.bookmarkTitle ?? "Untitled",
        bookmarkDomain: existing.bookmarkDomain,
      };
    }

    const [candidate] = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        domain: bookmarks.domain,
        content: bookmarks.content,
        summary: bookmarks.summary,
      })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.isRead, true),
          sql`(${bookmarks.content} IS NOT NULL OR ${bookmarks.summary} IS NOT NULL)`,
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);

    if (!candidate) return null;

    const sourceText = candidate.content
      ? candidate.content.slice(0, MAX_SOURCE_CHARS)
      : (candidate.summary ?? "");

    if (!sourceText.trim()) return null;

    const title = candidate.title ?? "Untitled";

    const prompt = `Extract ONE punchy, memorable quote from this article — exactly as written, 1-3 sentences, max 280 characters. Return ONLY the quote text, no quotation marks, no commentary.

Article: ${title}
${sourceText}`;

    const { text } = await generateText({
      model: getModel(),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 120,
    });

    const excerpt = sanitizeExcerpt(text);
    if (!excerpt) {
      console.warn(`[excerpt] empty excerpt for user ${userId}`);
      return null;
    }

    await db
      .insert(dailyExcerpts)
      .values({
        userId,
        date: today,
        bookmarkId: candidate.id,
        excerpt,
      })
      .onConflictDoNothing({
        target: [dailyExcerpts.userId, dailyExcerpts.date],
      });

    // Re-read after insert (handles ON CONFLICT race where another request won).
    const [final] = await db
      .select({
        excerpt: dailyExcerpts.excerpt,
        bookmarkId: dailyExcerpts.bookmarkId,
        bookmarkTitle: bookmarks.title,
        bookmarkDomain: bookmarks.domain,
      })
      .from(dailyExcerpts)
      .innerJoin(bookmarks, eq(dailyExcerpts.bookmarkId, bookmarks.id))
      .where(
        and(eq(dailyExcerpts.userId, userId), eq(dailyExcerpts.date, today)),
      )
      .limit(1);

    if (!final) return null;

    return {
      excerpt: final.excerpt,
      bookmarkId: final.bookmarkId,
      bookmarkTitle: final.bookmarkTitle ?? "Untitled",
      bookmarkDomain: final.bookmarkDomain,
    };
  } catch (err) {
    console.error(
      `[excerpt] getOrCreateDailyExcerpt failed for ${userId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
