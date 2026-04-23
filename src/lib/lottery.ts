import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, lotteryPicks, type LotteryPickStatus } from "@/db/schema";

const LOTTERY_DURATION_MS = 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type ActiveLottery = {
  id: string;
  bookmarkId: string;
  expiresAt: Date;
  pickedAt: Date;
  bookmark: {
    id: string;
    title: string | null;
    domain: string | null;
    url: string;
  };
};

/**
 * Sweep any active lottery picks for this user that are past expires_at:
 *   - Archive the underlying bookmark.
 *   - Mark the lottery pick as 'expired'.
 * Runs in a transaction so the two updates stay consistent.
 */
export async function expireOverdue(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE bookmarks
      SET is_archived = true, updated_at = now()
      WHERE user_id = ${userId}
        AND id IN (
          SELECT bookmark_id
          FROM lottery_picks
          WHERE user_id = ${userId}
            AND status = 'active'
            AND expires_at < now()
        )
    `);
    await tx.execute(sql`
      UPDATE lottery_picks
      SET status = 'expired', settled_at = now()
      WHERE user_id = ${userId}
        AND status = 'active'
        AND expires_at < now()
    `);
  });
}

/**
 * Return the user's currently-active lottery pick (if any) joined with the
 * bookmark fields the widget needs. Sweeps expired picks first so callers
 * never see a stale 'active' row.
 */
export async function getActiveLottery(
  userId: string,
): Promise<ActiveLottery | null> {
  await expireOverdue(userId);

  const [row] = await db
    .select({
      id: lotteryPicks.id,
      bookmarkId: lotteryPicks.bookmarkId,
      expiresAt: lotteryPicks.expiresAt,
      pickedAt: lotteryPicks.pickedAt,
      bookmark: {
        id: bookmarks.id,
        title: bookmarks.title,
        domain: bookmarks.domain,
        url: bookmarks.url,
      },
    })
    .from(lotteryPicks)
    .innerJoin(bookmarks, eq(bookmarks.id, lotteryPicks.bookmarkId))
    .where(
      and(eq(lotteryPicks.userId, userId), eq(lotteryPicks.status, "active")),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Pick a random eligible bookmark for the user and create an active lottery
 * row. Prefers "stale" bookmarks (saved >7 days ago); falls back to any
 * unread+unarchived bookmark if no stale ones remain.
 *
 * Returns the bookmark that was picked, or null if the user has nothing
 * eligible to draw from. If a draw race causes a unique-violation on the
 * partial index, returns the existing active lottery's bookmark instead.
 */
export async function drawLottery(
  userId: string,
): Promise<ActiveLottery["bookmark"] | null> {
  await expireOverdue(userId);

  // If there's already an active pick, return its bookmark — never double-spin.
  const existing = await getActiveLottery(userId);
  if (existing) return existing.bookmark;

  const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const pickEligible = async (preferStale: boolean) => {
    const conditions = [
      eq(bookmarks.userId, userId),
      eq(bookmarks.isRead, false),
      eq(bookmarks.isArchived, false),
    ];
    if (preferStale) {
      conditions.push(sql`${bookmarks.createdAt} < ${staleCutoff}`);
    }
    const [row] = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        domain: bookmarks.domain,
        url: bookmarks.url,
      })
      .from(bookmarks)
      .where(and(...conditions))
      .orderBy(sql`random()`)
      .limit(1);
    return row ?? null;
  };

  const candidate = (await pickEligible(true)) ?? (await pickEligible(false));
  if (!candidate) return null;

  const expiresAt = new Date(Date.now() + LOTTERY_DURATION_MS);

  try {
    await db.insert(lotteryPicks).values({
      userId,
      bookmarkId: candidate.id,
      status: "active",
      expiresAt,
    });
    return candidate;
  } catch (err) {
    // Unique violation on lottery_picks_one_active_per_user — another request
    // beat us to the draw. Return whatever's now active.
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      const active = await getActiveLottery(userId);
      return active?.bookmark ?? null;
    }
    throw err;
  }
}

/**
 * Mark the user's active lottery pick for `bookmarkId` (if any) with the given
 * settled status. No-op when no active row exists for the bookmark.
 */
export async function settleLottery(
  userId: string,
  bookmarkId: string,
  status: Exclude<LotteryPickStatus, "active" | "expired">,
): Promise<void> {
  await db
    .update(lotteryPicks)
    .set({ status, settledAt: new Date() })
    .where(
      and(
        eq(lotteryPicks.userId, userId),
        eq(lotteryPicks.bookmarkId, bookmarkId),
        eq(lotteryPicks.status, "active"),
      ),
    );
}
