import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        isNull(bookmarks.ogImage),
        isNull(bookmarks.description),
        isNull(bookmarks.content),
      ),
    );

  return NextResponse.json({ unenriched: Number(result.count) });
}
