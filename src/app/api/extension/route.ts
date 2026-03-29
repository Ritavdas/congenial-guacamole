import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { extractMetadata } from "@/lib/extract";
import { extensionSaveSchema } from "@/lib/validators";
import { timingSafeEqual } from "crypto";

function safeTokenCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const extensionApiKey = process.env.EXTENSION_API_KEY;
  if (!extensionApiKey || !safeTokenCompare(token, extensionApiKey)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = extensionSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { url, userId } = parsed.data;

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

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error("Extension save error:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 }
    );
  }
}
