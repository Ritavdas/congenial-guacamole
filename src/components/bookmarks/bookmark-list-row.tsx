"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { BookmarkWithTags } from "@/db/schema";
import { Star, Archive, BookOpen, ExternalLink, Check } from "lucide-react";
import {
  toggleBookmarkFavorite,
  toggleBookmarkArchive,
  toggleBookmarkRead,
} from "@/lib/actions";
import { toast } from "sonner";

interface BookmarkListRowProps {
  bookmark: BookmarkWithTags;
}

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
  return domain.replace("www.", "").split(".")[0].slice(0, 2).toUpperCase();
}

const bgColors = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
];

export const BookmarkListRow = memo(
  function BookmarkListRow({ bookmark }: BookmarkListRowProps) {
    const [isActing, setIsActing] = useState(false);
    const hash = bookmark.id.charCodeAt(0) % bgColors.length;

    async function handleAction(
      action: () => Promise<void>,
      successMsg: string,
    ) {
      if (isActing) return;
      setIsActing(true);
      try {
        await action();
        toast.success(successMsg);
      } catch {
        toast.error("Action failed");
      } finally {
        setIsActing(false);
      }
    }

    return (
      <div className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm">
        {/* Read status */}
        <button
          onClick={() =>
            handleAction(
              () => toggleBookmarkRead(bookmark.id),
              bookmark.isRead ? "Marked unread" : "Marked as read",
            )
          }
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            bookmark.isRead
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary"
          }`}
          title={bookmark.isRead ? "Mark unread" : "Mark as read"}
        >
          {bookmark.isRead && <Check className="h-2.5 w-2.5" />}
        </button>

        {/* Favicon */}
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold ${bgColors[hash]}`}
        >
          {domainInitials(bookmark.domain)}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm font-medium ${bookmark.isRead ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}
          >
            {bookmark.title ?? bookmark.url}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{bookmark.domain}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{estimateReadingTime(bookmark.wordCount)} min</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{timeAgo(bookmark.createdAt)}</span>
          </div>
        </div>

        {/* Tags */}
        {bookmark.tags.length > 0 && (
          <div className="hidden gap-1 md:flex">
            {bookmark.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border px-2 py-0 text-[10px] font-medium"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() =>
              handleAction(
                () => toggleBookmarkFavorite(bookmark.id),
                bookmark.isFavorite ? "Unfavorited" : "Favorited",
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
            title="Favorite"
          >
            <Star
              className={`h-3.5 w-3.5 ${bookmark.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
            />
          </button>
          <button
            onClick={() =>
              handleAction(
                () => toggleBookmarkArchive(bookmark.id),
                bookmark.isArchived ? "Unarchived" : "Archived",
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
            title="Archive"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <Link
            href={`/read/${bookmark.id}`}
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
            title="Read"
          >
            <BookOpen className="h-3.5 w-3.5" />
          </Link>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
            title="Open original"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.bookmark.id === next.bookmark.id &&
      prev.bookmark.isFavorite === next.bookmark.isFavorite &&
      prev.bookmark.isArchived === next.bookmark.isArchived &&
      prev.bookmark.isRead === next.bookmark.isRead
    );
  },
);
