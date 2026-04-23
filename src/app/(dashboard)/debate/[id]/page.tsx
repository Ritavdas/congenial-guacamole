import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks, type DebateTurn } from "@/db/schema";
import { getDebate } from "@/lib/debates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  running: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  complete:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export default async function DebateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await headers();
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const debate = await getDebate(id, userId);
  if (!debate) notFound();

  const ids = debate.bookmarkIds;
  const sources =
    ids.length > 0
      ? await db
          .select({
            id: bookmarks.id,
            title: bookmarks.title,
            domain: bookmarks.domain,
          })
          .from(bookmarks)
          .where(inArray(bookmarks.id, ids))
      : [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const aSrc = sourceById.get(ids[0]);
  const bSrc = sourceById.get(ids[1]);

  const inProgress = debate.status === "pending" || debate.status === "running";
  const transcript: DebateTurn[] = debate.transcript ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {inProgress && <meta httpEquiv="refresh" content="3" />}

      <div>
        <Link
          href="/debate"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All debates
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            {debate.topic ?? (inProgress ? "Generating topic…" : "Debate")}
          </h2>
          <Badge
            variant="secondary"
            className={STATUS_TONE[debate.status] ?? ""}
          >
            {debate.status}
          </Badge>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="font-semibold">A:</span>{" "}
            {aSrc?.title ?? "(unknown)"}{" "}
            {aSrc?.domain && (
              <span className="opacity-70">— {aSrc.domain}</span>
            )}
          </div>
          <div>
            <span className="font-semibold">B:</span>{" "}
            {bSrc?.title ?? "(unknown)"}{" "}
            {bSrc?.domain && (
              <span className="opacity-70">— {bSrc.domain}</span>
            )}
          </div>
        </div>
      </header>

      {inProgress && (
        <Card className="p-4 text-sm text-muted-foreground">
          Generating debate… this page refreshes every 3 seconds.
        </Card>
      )}

      {transcript.length === 0 && !inProgress && (
        <Card className="p-4 text-sm text-muted-foreground">
          No turns recorded.
        </Card>
      )}

      <ol className="space-y-3">
        {transcript.map((turn, i) => {
          const isModerator = turn.speaker === "moderator";
          const isA = turn.speaker === "A";
          return (
            <li
              key={i}
              className={cn(
                "flex",
                isModerator
                  ? "justify-center"
                  : isA
                    ? "justify-start"
                    : "justify-end",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl border px-4 py-3 text-sm",
                  isModerator
                    ? "bg-muted text-muted-foreground italic"
                    : isA
                      ? "bg-blue-50 dark:bg-blue-950/40"
                      : "bg-emerald-50 dark:bg-emerald-950/40",
                )}
              >
                <div className="mb-1 text-xs font-semibold opacity-70">
                  {isModerator
                    ? "Moderator"
                    : isA
                      ? `A — ${aSrc?.title ?? "Article A"}`
                      : `B — ${bSrc?.title ?? "Article B"}`}
                </div>
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
