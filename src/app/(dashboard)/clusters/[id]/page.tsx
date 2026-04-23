import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { getClusterMembers } from "@/lib/clustering";

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await headers();
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted-foreground">
          Sign in to view this topic.
        </p>
      </div>
    );
  }

  const { cluster, members } = await getClusterMembers(userId, id);
  if (!cluster) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link
          href="/clusters"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All topics
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {cluster.label ?? "Untitled topic"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {cluster.memberCount} bookmark{cluster.memberCount === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id}>
            <Link
              href={`/read/${m.id}`}
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3 hover:bg-accent/40 hover:border-border transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary">
                  {m.title ?? m.domain ?? "Untitled"}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {m.domain ? <span>{m.domain}</span> : null}
                  {m.isArchived ? (
                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wider">
                      Archived
                    </span>
                  ) : null}
                  {m.isRead ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Read
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
