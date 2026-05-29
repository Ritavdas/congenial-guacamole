import { eq } from "drizzle-orm";
import { db } from "@/db";
import { twitterSyncStatus, type TwitterSyncStatusKind } from "@/db/schema";

export interface SyncStatusPayload {
  status: TwitterSyncStatusKind;
  imported: number;
  skipped: number;
  pagesFetched: number;
  errorMessage?: string;
}

export async function upsertTwitterSyncStatus(
  userId: string,
  payload: SyncStatusPayload,
): Promise<void> {
  await db
    .insert(twitterSyncStatus)
    .values({
      userId,
      ranAt: new Date(),
      status: payload.status,
      imported: payload.imported,
      skipped: payload.skipped,
      pagesFetched: payload.pagesFetched,
      errorMessage: payload.errorMessage ?? null,
    })
    .onConflictDoUpdate({
      target: twitterSyncStatus.userId,
      set: {
        ranAt: new Date(),
        status: payload.status,
        imported: payload.imported,
        skipped: payload.skipped,
        pagesFetched: payload.pagesFetched,
        errorMessage: payload.errorMessage ?? null,
      },
    });
}

export async function getTwitterSyncStatus(userId: string) {
  const [row] = await db
    .select()
    .from(twitterSyncStatus)
    .where(eq(twitterSyncStatus.userId, userId))
    .limit(1);
  return row ?? null;
}
