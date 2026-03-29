import Link from "next/link";
import { BookmarkWithTags } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

interface RecentBookmarksProps {
  bookmarks: BookmarkWithTags[];
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
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

export function RecentBookmarks({ bookmarks }: RecentBookmarksProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">
          🕐 Recently Saved
        </h3>
      </div>
      <div className="space-y-2">
        {bookmarks.map((bookmark, i) => (
          <Link
            key={bookmark.id}
            href={`/read/${bookmark.id}`}
            className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${bgColors[i % bgColors.length]}`}
            >
              {domainInitials(bookmark.domain)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold group-hover:text-primary">
                {bookmark.title ?? bookmark.url}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{bookmark.domain}</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{estimateReadingTime(bookmark.wordCount)} min</span>
              </div>
            </div>
            {bookmark.tags.length > 0 && (
              <div className="hidden gap-1 sm:flex">
                {bookmark.tags.slice(0, 2).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px]"
                    style={{ borderColor: tag.color, borderWidth: 1 }}
                  >
                    <span
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(bookmark.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
