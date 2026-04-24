// @no-test-required — AI-dependent, needs real DB for meaningful tests
import { eq, and } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import {
  bookmarks,
  dailyRecommendations,
  tags,
  bookmarkTags,
} from "@/db/schema";
import { getModel } from "@/lib/ai";
import { notThinBookmarkSql } from "@/lib/thin-bookmark";

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export async function getDailyRecommendations(userId: string) {
  const today = getTodayDateString();

  const recs = await db
    .select({
      id: dailyRecommendations.id,
      bookmarkId: dailyRecommendations.bookmarkId,
      reason: dailyRecommendations.reason,
      date: dailyRecommendations.date,
      isClicked: dailyRecommendations.isClicked,
      bookmark: {
        id: bookmarks.id,
        url: bookmarks.url,
        title: bookmarks.title,
        description: bookmarks.description,
        ogImage: bookmarks.ogImage,
        domain: bookmarks.domain,
        wordCount: bookmarks.wordCount,
      },
    })
    .from(dailyRecommendations)
    .innerJoin(bookmarks, eq(dailyRecommendations.bookmarkId, bookmarks.id))
    .where(
      and(
        eq(dailyRecommendations.userId, userId),
        eq(dailyRecommendations.date, today),
      ),
    );

  return recs;
}

export async function generateDailyRecommendations(
  userId: string,
  force = false,
) {
  const today = getTodayDateString();

  // If not forcing, check for existing recommendations
  if (!force) {
    const existing = await getDailyRecommendations(userId);
    if (existing.length > 0) return existing;
  } else {
    // Delete today's existing recommendations when forcing a refresh
    await db
      .delete(dailyRecommendations)
      .where(
        and(
          eq(dailyRecommendations.userId, userId),
          eq(dailyRecommendations.date, today),
        ),
      );
  }

  // Fetch unread, non-archived, non-thin bookmarks. Thin = twitter links,
  // plain URL saves with no body content. See lib/thin-bookmark.ts.
  const unreadBookmarks = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      domain: bookmarks.domain,
      description: bookmarks.description,
    })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.isRead, false),
        eq(bookmarks.isArchived, false),
        notThinBookmarkSql(),
      ),
    );

  if (unreadBookmarks.length < 3) return [];

  // Fetch tags for these bookmarks
  const bookmarkIds = unreadBookmarks.map((b) => b.id);
  const allTags = await db
    .select({
      bookmarkId: bookmarkTags.bookmarkId,
      tagName: tags.name,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(eq(tags.userId, userId));

  const tagsByBookmark = new Map<string, string[]>();
  for (const t of allTags) {
    if (bookmarkIds.includes(t.bookmarkId)) {
      const existing = tagsByBookmark.get(t.bookmarkId) ?? [];
      existing.push(t.tagName);
      tagsByBookmark.set(t.bookmarkId, existing);
    }
  }

  // Build article list for the prompt
  const articleList = unreadBookmarks
    .map((b) => {
      const bTags = tagsByBookmark.get(b.id);
      const tagStr = bTags?.length ? ` | Tags: ${bTags.join(", ")}` : "";
      return `- ID: ${b.id} | Title: ${b.title ?? "Untitled"} | Domain: ${b.domain ?? "unknown"} | Description: ${b.description ?? "N/A"}${tagStr}`;
    })
    .join("\n");

  const { object: picks } = await generateObject({
    model: getModel(),
    schema: z.object({
      recommendations: z.array(
        z.object({
          bookmarkId: z.string(),
          reason: z.string(),
        }),
      ),
    }),
    prompt: `You are a reading recommendation assistant. Given the user's unread saved articles, pick the 3 most interesting and diverse articles they should read today. Consider topic variety, relevance, and engagement potential.

Return exactly 3 recommendations. Each should include the bookmarkId and a brief 1-sentence reason why the user should read it today.

Here are the user's unread articles:
${articleList}`,
  });

  // Filter to valid bookmark IDs and limit to 3
  const validBookmarkIds = new Set(bookmarkIds);
  const validPicks = picks.recommendations
    .filter((p) => validBookmarkIds.has(p.bookmarkId))
    .slice(0, 3);

  if (validPicks.length === 0) return [];

  // Insert recommendations
  const newRecs = validPicks.map((pick) => ({
    userId,
    bookmarkId: pick.bookmarkId,
    reason: pick.reason,
    date: today,
  }));

  await db.insert(dailyRecommendations).values(newRecs);

  return getDailyRecommendations(userId);
}

export async function markRecommendationClicked(id: string, userId: string) {
  await db
    .update(dailyRecommendations)
    .set({ isClicked: true })
    .where(
      and(
        eq(dailyRecommendations.id, id),
        eq(dailyRecommendations.userId, userId),
      ),
    );
}
