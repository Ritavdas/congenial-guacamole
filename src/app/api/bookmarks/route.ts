import { NextRequest, NextResponse } from "next/server";
import { getBookmarksPaginated } from "@/lib/actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const filter = (searchParams.get("filter") ?? undefined) as
      | "all"
      | "favorites"
      | "archived"
      | "unread"
      | undefined;
    const tagId = searchParams.get("tagId") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 20), 1),
      100,
    );

    const { items, nextCursor } = await getBookmarksPaginated(
      filter,
      tagId,
      cursor,
      limit,
    );

    const lightItems = items.map(({ content, htmlContent, ...rest }) => rest);

    return NextResponse.json({ items: lightItems, nextCursor });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
