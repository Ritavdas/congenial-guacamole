import { NextRequest, NextResponse } from "next/server";
import { getBookmarkByUrlCached } from "@/lib/cached";

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
  const bookmark = await getBookmarkByUrlCached(userId, normalized);

  if (!bookmark) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    bookmark,
  });
}
