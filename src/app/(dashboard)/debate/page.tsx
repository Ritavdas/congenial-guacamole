import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { listDebates } from "@/lib/debates";
import { startDebateAction } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  running: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  complete:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function DebatePage() {
  await headers();
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [picks, past] = await Promise.all([
    db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        domain: bookmarks.domain,
      })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.isArchived, false)))
      .orderBy(desc(bookmarks.createdAt))
      .limit(100),
    listDebates(userId),
  ]);

  const eligible = picks.filter((p) => p.title);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI debate room</h2>
        <p className="text-muted-foreground">
          Pit two articles against each other. The model takes each side and
          argues — then a moderator names the winner.
        </p>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Start a new debate</h3>
        {eligible.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            You need at least 2 saved bookmarks with titles to run a debate.
          </p>
        ) : (
          <form action={startDebateAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Side A</span>
                <select
                  name="bookmarkA"
                  required
                  defaultValue=""
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Pick a bookmark…
                  </option>
                  {eligible.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                      {b.domain ? ` — ${b.domain}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Side B</span>
                <select
                  name="bookmarkB"
                  required
                  defaultValue=""
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Pick a bookmark…
                  </option>
                  {eligible.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                      {b.domain ? ` — ${b.domain}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button type="submit">Start debate</Button>
          </form>
        )}
      </Card>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Past debates</h3>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No debates yet.</p>
        ) : (
          <ul className="space-y-2">
            {past.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/debate/${d.id}`}
                  className="block rounded-lg border p-4 transition hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {d.topic ?? "(generating topic…)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(d.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={STATUS_TONE[d.status] ?? ""}
                    >
                      {d.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
