import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { getUserClusters } from "@/lib/clustering";
import { triggerRebuildClustersAction } from "@/lib/actions";

async function rebuildFormAction() {
  "use server";
  await triggerRebuildClustersAction();
}

export default async function ClustersPage() {
  await headers();
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted-foreground">Sign in to view topics.</p>
      </div>
    );
  }

  const clusters = await getUserClusters(userId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Topics</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {clusters.length === 0
              ? "No topics yet"
              : `${clusters.length} ${clusters.length === 1 ? "topic" : "topics"}`}
          </p>
        </div>
        <form action={rebuildFormAction}>
          <button
            type="submit"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Rebuild
          </button>
        </form>
      </header>

      {clusters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Save and embed at least 20 bookmarks, then click Rebuild to discover
            topics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c) => (
            <Link
              key={c.id}
              href={`/clusters/${c.id}`}
              className="group rounded-xl border border-border/70 bg-card p-4 transition-colors hover:bg-accent/40 hover:border-border"
            >
              <h3 className="text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary">
                {c.label ?? "Untitled topic"}
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {c.memberCount} bookmark{c.memberCount === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
