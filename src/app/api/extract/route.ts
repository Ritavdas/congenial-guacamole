import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractMetadata } from "@/lib/extract";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const metadata = await extractMetadata(url);
    return NextResponse.json(metadata);
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract metadata" },
      { status: 500 }
    );
  }
}
