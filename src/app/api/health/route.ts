import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? "set" : "MISSING",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env
        .NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? "set"
        : "MISSING",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL:
        process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "MISSING",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL:
        process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "MISSING",
    },
  };

  // Test DB connection
  try {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`SELECT 1 as ok`);
    checks.database = { status: "connected", result: result.length };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Test Clerk auth import
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    checks.clerk = {
      status: "ok",
      userId: session.userId ?? "not authenticated",
    };
  } catch (error) {
    checks.clerk = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const hasErrors =
    checks.database &&
    typeof checks.database === "object" &&
    "status" in checks.database &&
    checks.database.status === "error";

  return NextResponse.json(checks, { status: hasErrors ? 500 : 200 });
}
