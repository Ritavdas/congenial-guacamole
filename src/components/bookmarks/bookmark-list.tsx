"use client";

import { Bookmark } from "@/db/schema";
import { BookmarkCard } from "./bookmark-card";

interface BookmarkListProps {
  bookmarks: Bookmark[];
}

export function BookmarkList({ bookmarks }: BookmarkListProps) {
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bookmarks.map((bookmark) => (
        <BookmarkCard key={bookmark.id} bookmark={bookmark} />
      ))}
    </div>
  );
}
