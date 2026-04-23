/**
 * Telemetry endpoint for reader events. Designed to be hit by `navigator.sendBeacon`
 * from the reader page; stays alive across tab close.
 *
 * Body: { bookmarkId: string, kind: BookmarkEventKind }
 *
 * Returns 204 No Content on success (sendBeacon ignores response body).
 * Dedup of `finished_inferred` events is enforced at the DB level via a
 * partial unique index — we ON CONFLICT DO NOTHING.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  BOOKMARK_EVENT_KINDS,
  bookmarks,
  type BookmarkEventKind,
} from "@/db/schema";
import { generateOutcomeChip } from "@/lib/outcome";

const ALLOWED = new Set<string>(BOOKMARK_EVENT_KINDS);

function isKind(value: unknown): value is BookmarkEventKind {
  return typeof value === "string" && ALLOWED.has(value);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { bookmarkId, kind } = body as Record<string, unknown>;

  if (typeof bookmarkId !== "string" || !bookmarkId) {
    return NextResponse.json({ error: "Missing bookmarkId" }, { status: 400 });
  }
  if (!isKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  try {
    const [owned] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));

    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await db.execute(sql`
      INSERT INTO bookmark_events (user_id, bookmark_id, kind)
      VALUES (${userId}, ${bookmarkId}, ${kind})
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    // Only schedule the chip on a fresh insert (not an ON CONFLICT no-op)
    // and only for the "finished_inferred" telemetry signal.
    if (kind === "finished_inferred" && result.length > 0) {
      after(() => generateOutcomeChip(bookmarkId));
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[bookmark-events] insert failed:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
