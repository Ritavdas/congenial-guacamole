import Link from "next/link";

interface TagBucket {
  id: string;
  name: string;
  color: string;
  bookmarkCount: number;
  recentTitles: { title: string | null; domain: string | null }[];
  lastActivity: Date;
}

interface TagBucketGridProps {
  tagBuckets: TagBucket[];
  untaggedCount: number;
  latestUntagged: { title: string | null; domain: string | null } | null;
}

export function TagBucketGrid({
  tagBuckets,
  untaggedCount,
  latestUntagged,
}: TagBucketGridProps) {
  if (tagBuckets.length === 0 && untaggedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <p className="text-lg font-medium">No bookmarks yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Save your first article to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tagBuckets.map((bucket) => (
        <Link
          key={bucket.id}
          href={`/tags/${bucket.id}`}
          className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
          style={{ borderTopColor: bucket.color, borderTopWidth: 3 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: bucket.color }}
              />
              {bucket.name}
            </h3>
            <span className="text-xs text-muted-foreground">
              {bucket.bookmarkCount} article
              {bucket.bookmarkCount !== 1 ? "s" : ""}
            </span>
          </div>

          <ul className="mb-3 space-y-1">
            {bucket.recentTitles.map((item, i) => (
              <li
                key={i}
                className="truncate text-sm text-muted-foreground"
              >
                {item.title ?? item.domain ?? "Untitled"}
              </li>
            ))}
            {bucket.recentTitles.length === 0 && (
              <li className="text-sm text-muted-foreground italic">
                No articles yet
              </li>
            )}
          </ul>

          <span className="text-xs font-medium text-primary group-hover:underline">
            View all →
          </span>
        </Link>
      ))}

      {untaggedCount > 0 && (
        <Link
          href="/unsorted"
          className="group rounded-xl border border-dashed bg-muted/30 p-5 transition-shadow hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">📥 Unsorted</h3>
            <span className="text-xs text-muted-foreground">
              {untaggedCount} article{untaggedCount !== 1 ? "s" : ""} need tags
            </span>
          </div>

          {latestUntagged && (
            <p className="mb-3 truncate text-sm text-muted-foreground">
              Latest: &quot;{latestUntagged.title ?? latestUntagged.domain ?? "Untitled"}&quot;
            </p>
          )}

          <span className="text-xs font-medium text-primary group-hover:underline">
            Sort these →
          </span>
        </Link>
      )}
    </div>
  );
}
