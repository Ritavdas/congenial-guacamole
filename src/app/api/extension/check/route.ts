import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookmarks, bookmarkTags, tags } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

function getUserId(request: NextRequest): string | null {
  return request.headers.get("x-user-id") || null;
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Missing X-User-Id header" },
      { status: 400 },
    );
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url || !isValidUrl(url)) {
    return NextResponse.json(
      { error: "Missing or invalid url parameter" },
      { status: 400 },
    );
  }

  const normalized = normalizeUrl(url);

  // Case-insensitive match with trailing slash normalization
  const [bookmark] = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      domain: bookmarks.domain,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        sql`lower(regexp_replace(${bookmarks.url}, '/+$', '')) = ${normalized}`,
      ),
    )
    .limit(1);

  if (!bookmark) {
    return NextResponse.json({ exists: false });
  }

  // Fetch associated tags
  const associatedTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(eq(bookmarkTags.bookmarkId, bookmark.id));

  return NextResponse.json({
    exists: true,
    bookmark: {
      ...bookmark,
      tags: associatedTags,
    },
  });
}
