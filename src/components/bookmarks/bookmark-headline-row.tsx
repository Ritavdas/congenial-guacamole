"use client";

import { memo } from "react";
import Link from "next/link";
import { BookmarkWithTags } from "@/db/schema";

interface BookmarkHeadlineRowProps {
  bookmark: BookmarkWithTags;
}

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d";
  return `${days}d`;
}

export const BookmarkHeadlineRow = memo(
  function BookmarkHeadlineRow({ bookmark }: BookmarkHeadlineRowProps) {
    return (
      <Link
        href={`/read/${bookmark.id}`}
        className="group flex items-baseline gap-3 border-b border-border/50 py-2.5 transition-colors hover:bg-muted/50 hover:px-3 hover:-mx-3 hover:rounded-md"
      >
        <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
          {timeAgo(bookmark.createdAt)}
        </span>
        <span
          className={`flex-1 text-sm font-medium group-hover:text-primary ${bookmark.isRead ? "text-muted-foreground" : ""}`}
        >
          {bookmark.title ?? bookmark.url}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {bookmark.domain}
        </span>
      </Link>
    );
  },
  (prev, next) => {
    return (
      prev.bookmark.id === next.bookmark.id &&
      prev.bookmark.isRead === next.bookmark.isRead
    );
  },
);
