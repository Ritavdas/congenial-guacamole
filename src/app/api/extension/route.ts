import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { extractMetadata } from "@/lib/extract";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);

  // Verify Clerk session token
  // In production, validate this token with Clerk's API
  // For now, we accept a pre-shared API key set in env
  const extensionApiKey = process.env.EXTENSION_API_KEY;
  if (!extensionApiKey || token !== extensionApiKey) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { url, userId } = await request.json();

  if (!url || !userId) {
    return NextResponse.json(
      { error: "url and userId are required" },
      { status: 400 }
    );
  }

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
      })
      .returning();

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error("Extension save error:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 }
    );
  }
}
