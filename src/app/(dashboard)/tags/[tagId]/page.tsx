import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookmarksByTag } from "@/lib/actions";
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

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const { tagId } = await params;

  let data: Awaited<ReturnType<typeof getBookmarksByTag>>;
  try {
    data = await getBookmarksByTag(tagId);
  } catch {
    notFound();
  }

  const { tag, bookmarks } = data;

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

      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
        <h2 className="text-2xl font-bold tracking-tight">{tag.name}</h2>
        <span className="text-sm text-muted-foreground">
          {bookmarks.length} article{bookmarks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            No articles with this tag yet
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
              {bookmark.tags.length > 0 && (
                <div className="hidden gap-1 sm:flex">
                  {bookmark.tags.slice(0, 2).map((t) => (
                    <Badge
                      key={t.id}
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                      style={{ borderColor: t.color, borderWidth: 1 }}
                    >
                      <span
                        className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
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
      )}
    </div>
  );
}
