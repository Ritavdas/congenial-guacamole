import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { parseTwitterArchiveBookmarks } from "@/lib/import-twitter";
import { extractTwitterMetadata } from "@/lib/extract-twitter";

export const maxDuration = 300;

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

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".js") && !fileName.endsWith(".json")) {
    return NextResponse.json(
      { error: "File must be a .js or .json file" },
      { status: 400 },
    );
  }

  const content = await file.text();
  const tweets = parseTwitterArchiveBookmarks(content);

  if (tweets.length === 0) {
    return NextResponse.json(
      {
        error:
          "No bookmarks found in the file. Make sure this is the bookmarks.js file from your X data archive.",
      },
      { status: 400 },
    );
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const tweet of tweets) {
    try {
      // Check for duplicate
      const existing = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, tweet.url)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Try to enrich via syndication API
      let metadata: Awaited<ReturnType<typeof extractTwitterMetadata>> = null;
      try {
        metadata = await extractTwitterMetadata(tweet.url);
      } catch {
        // Enrichment failed — will use fallback
      }

      await db.insert(bookmarks).values({
        userId,
        url: tweet.url,
        title: metadata?.title ?? `Tweet ${tweet.tweetId}`,
        description: metadata?.description ?? null,
        ogImage: metadata?.ogImage ?? null,
        content: metadata?.content ?? null,
        htmlContent: metadata?.htmlContent ?? null,
        wordCount: metadata?.wordCount ?? null,
        domain: metadata?.domain ?? "x.com",
        createdAt: tweet.timestamp,
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
