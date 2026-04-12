import Link from "next/link";
import { getUntaggedBookmarks } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { BookmarkThumbnail } from "@/components/bookmarks/bookmark-thumbnail";

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function estimateReadingTime(wordCount: number | null): number {
  return Math.max(1, Math.ceil((wordCount ?? 0) / 200));
}

function domainInitials(domain: string | null): string {
  if (!domain) return "?";
  const parts = domain.replace("www.", "").split(".");
  return parts[0].slice(0, 2).toUpperCase();
}

const bgColors = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
];

export default async function UnsortedPage() {
  const bookmarks = await getUntaggedBookmarks();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Library
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">📥 Unsorted</h2>
        <p className="text-muted-foreground">
          {bookmarks.length} article{bookmarks.length !== 1 ? "s" : ""} without
          tags
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-lg font-medium">🎉 Inbox zero!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            All your articles are tagged
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookmarks.map((bookmark, i) => (
            <Link
              key={bookmark.id}
              href={`/read/${bookmark.id}`}
              className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <BookmarkThumbnail
                ogImage={bookmark.ogImage}
                domain={bookmark.domain}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold group-hover:text-primary">
                  {bookmark.title ?? bookmark.url}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{bookmark.domain}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    {estimateReadingTime(bookmark.wordCount)} min
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                needs tags
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {timeAgo(bookmark.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
