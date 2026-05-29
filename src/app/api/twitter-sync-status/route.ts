import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTwitterSyncStatus } from "@/lib/twitter-sync-status";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getTwitterSyncStatus(userId);
  return NextResponse.json(status);
}
