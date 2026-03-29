import Link from "next/link";
import { Bookmark } from "@/db/schema";
import { BookOpen } from "lucide-react";

interface ReadingQueueProps {
  bookmarks: Bookmark[];
}

function estimateReadingTime(wordCount: number | null): number {
  return Math.max(1, Math.ceil((wordCount ?? 0) / 200));
}

const gradients = [
  "from-indigo-500 to-violet-500",
  "from-amber-500 to-red-500",
  "from-emerald-500 to-cyan-500",
  "from-pink-500 to-rose-500",
  "from-blue-500 to-indigo-500",
  "from-teal-500 to-emerald-500",
];

export function ReadingQueue({ bookmarks }: ReadingQueueProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <BookOpen className="h-5 w-5" />
          Reading Queue
        </h3>
        <Link
          href="/search"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bookmarks.map((bookmark, i) => {
          const mins = estimateReadingTime(bookmark.wordCount);
          return (
            <Link
              key={bookmark.id}
              href={`/read/${bookmark.id}`}
              className="group overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className={`h-2 bg-gradient-to-r ${gradients[i % gradients.length]}`}
              />
              <div className="p-4">
                <h4 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                  {bookmark.title ?? bookmark.url}
                </h4>
                <p className="mb-3 text-xs text-muted-foreground">
                  {bookmark.domain} · {mins} min read
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-primary">Not started</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
