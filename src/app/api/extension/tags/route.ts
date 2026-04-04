import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tags, bookmarkTags } from "@/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

function getUserId(request: NextRequest): string | null {
  return request.headers.get("x-user-id") || null;
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Missing X-User-Id header" },
      { status: 400 },
    );
  }

  const search = request.nextUrl.searchParams.get("search");

  const userTags = await db
    .select()
    .from(tags)
    .where(
      search
        ? and(eq(tags.userId, userId), ilike(tags.name, `%${search}%`))
        : eq(tags.userId, userId),
    );

  if (userTags.length === 0) {
    return NextResponse.json({ tags: [] });
  }

  const tagIds = userTags.map((t) => t.id);
  const counts = await db
    .select({
      tagId: bookmarkTags.tagId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(bookmarkTags)
    .where(sql`${bookmarkTags.tagId} IN ${tagIds}`)
    .groupBy(bookmarkTags.tagId);

  const countMap = new Map(counts.map((c) => [c.tagId, Number(c.count)]));

  const result = userTags
    .map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      bookmarkCount: countMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.bookmarkCount - a.bookmarkCount);

  return NextResponse.json({ tags: result });
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Missing X-User-Id header" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { name, color } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Tag name is required" },
      { status: 400 },
    );
  }

  const [tag] = await db
    .insert(tags)
    .values({
      userId,
      name: name.trim(),
      color: color ?? "#6366f1",
    })
    .returning();

  return NextResponse.json({ tag });
}
