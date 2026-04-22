import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getEnrichStatusCached } from "@/lib/cached";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getEnrichStatusCached(userId);
  return NextResponse.json(result);
}
