import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { parseTwitterBookmarksExport } from "@/lib/import-twitter-bookmarks";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json(
      { error: "File must be a .json file" },
      { status: 400 },
    );
  }

  const content = await file.text();
  const tweets = parseTwitterBookmarksExport(content);

  if (tweets.length === 0) {
    return NextResponse.json(
      {
        error:
          "No bookmarks found. Make sure this is the JSON file exported by the bookmarks export script.",
      },
      { status: 400 },
    );
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const tweet of tweets) {
    try {
      const existing = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, tweet.url)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(bookmarks).values({
        userId,
        url: tweet.url,
        title: tweet.title,
        description: tweet.description,
        ogImage: tweet.ogImage,
        content: tweet.content,
        htmlContent: tweet.htmlContent,
        wordCount: tweet.wordCount,
        domain: tweet.domain,
        createdAt: tweet.createdAt,
        updatedAt: new Date(),
      });

      imported++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors,
    total: tweets.length,
  });
}
