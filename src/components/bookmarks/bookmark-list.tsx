"use client";

import { BookmarkWithTags } from "@/db/schema";
import { BookmarkCard } from "./bookmark-card";
import { BookmarkListRow } from "./bookmark-list-row";
import { BookmarkHeadlineRow } from "./bookmark-headline-row";
import type { ViewMode } from "./view-toggle";

interface BookmarkListProps {
  bookmarks: BookmarkWithTags[];
  onTagClick?: (tagId: string) => void;
  viewMode?: ViewMode;
}

export function BookmarkList({
  bookmarks,
  onTagClick,
  viewMode = "grid",
}: BookmarkListProps) {
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-lg font-medium">No bookmarks yet</p>
        <p className="text-sm text-muted-foreground">
          Save your first article to get started
        </p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-1.5">
        {bookmarks.map((bookmark) => (
          <BookmarkListRow key={bookmark.id} bookmark={bookmark} />
        ))}
      </div>
    );
  }

  if (viewMode === "headlines") {
    return (
      <div className="flex flex-col">
        {bookmarks.map((bookmark) => (
          <BookmarkHeadlineRow key={bookmark.id} bookmark={bookmark} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}
