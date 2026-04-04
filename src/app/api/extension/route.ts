import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookmarks, bookmarkTags } from "@/db/schema";
import { extractMetadata } from "@/lib/extract";
import { extensionSaveSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = extensionSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { url, userId, tagIds } = parsed.data;

  try {
    const metadata = await extractMetadata(url);

    const [bookmark] = await db
      .insert(bookmarks)
      .values({
        userId,
        url,
        title: metadata.title,
        description: metadata.description,
        ogImage: metadata.ogImage,
        domain: metadata.domain,
        content: metadata.content,
        htmlContent: metadata.htmlContent,
        wordCount: metadata.wordCount,
      })
      .returning();

    if (tagIds && tagIds.length > 0) {
      await db
        .insert(bookmarkTags)
        .values(tagIds.map((tagId) => ({ bookmarkId: bookmark.id, tagId })))
        .onConflictDoNothing();
    }

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error("Extension save error:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 },
    );
  }
}
