import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";

interface BatchBookmark {
  url: string;
  tweetId: string;
  timestamp: string;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { bookmarks: BatchBookmark[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = body.bookmarks;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "No bookmarks provided" },
      { status: 400 },
    );
  }

  // Bulk dedup: single query for all URLs in this chunk
  const urls = items.map((b) => b.url);
  const existing = await db
    .select({ url: bookmarks.url })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.url, urls)));

  const existingUrls = new Set(existing.map((e) => e.url));
  const toInsert = items.filter((b) => !existingUrls.has(b.url));
  const skipped = items.length - toInsert.length;

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors: 0 });
  }

  try {
    await db.insert(bookmarks).values(
      toInsert.map((b) => ({
        userId,
        url: b.url,
        title: `Tweet ${b.tweetId}`,
        domain: "x.com",
        createdAt: new Date(b.timestamp),
        updatedAt: new Date(),
      })),
    );

    return NextResponse.json({
      imported: toInsert.length,
      skipped,
      errors: 0,
    });
  } catch {
    return NextResponse.json({
      imported: 0,
      skipped,
      errors: toInsert.length,
    });
  }
}
