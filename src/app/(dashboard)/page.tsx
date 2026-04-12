import { getTagBuckets } from "@/lib/actions";
import { TagBucketGrid } from "@/components/bookmarks/tag-bucket-grid";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";

export default async function DashboardPage() {
  let tagBuckets: Awaited<ReturnType<typeof getTagBuckets>>["tagBuckets"] = [];
  let untaggedCount = 0;
  let latestUntagged: Awaited<
    ReturnType<typeof getTagBuckets>
  >["latestUntagged"] = null;
  let errorMessage = "";

  try {
    ({ tagBuckets, untaggedCount, latestUntagged } = await getTagBuckets());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DashboardPage] Failed to load data:", msg);

    if (msg === "Unauthorized") {
      errorMessage = "Your session has expired. Please sign in again.";
    } else if (
      msg.includes("connect") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("database")
    ) {
      errorMessage =
        "Unable to connect to the database. Please try again later.";
    } else {
      errorMessage =
        "Something went wrong loading your dashboard. Please try again.";
    }
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">Error</p>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Your Library</h2>
        <AddBookmarkDialog />
      </div>

      <TagBucketGrid
        tagBuckets={tagBuckets}
        untaggedCount={untaggedCount}
        latestUntagged={latestUntagged}
      />
    </div>
  );
}
