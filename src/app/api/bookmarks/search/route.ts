import { NextRequest, NextResponse } from "next/server";
import { searchBookmarksPaginated } from "@/lib/actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q") ?? "";
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 20), 1),
      100,
    );

    const result = await searchBookmarksPaginated(query, cursor, limit);
    return NextResponse.json(result);
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
