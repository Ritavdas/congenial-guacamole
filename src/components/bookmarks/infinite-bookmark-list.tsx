"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { BookmarkCard } from "./bookmark-card";
import { BookmarkListRow } from "./bookmark-list-row";
import { BookmarkHeadlineRow } from "./bookmark-headline-row";
import { ViewToggle, type ViewMode } from "./view-toggle";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import type { BookmarkWithTags, Tag } from "@/db/schema";

interface InfiniteBookmarkListProps {
  filter?: "all" | "favorites" | "archived" | "unread";
  tags: Tag[];
  initialCount: number;
}

type BookmarkLight = Omit<BookmarkWithTags, "content" | "htmlContent">;

async function fetchBookmarks({
  filter,
  tagId,
  cursor,
  limit = 20,
}: {
  filter?: string;
  tagId?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: BookmarkLight[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (tagId) params.set("tagId", tagId);
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));

  const res = await fetch(`/api/bookmarks?${params}`);
  if (!res.ok) throw new Error("Failed to fetch bookmarks");
  return res.json();
}

export function InfiniteBookmarkList({
  filter = "all",
  tags,
  initialCount,
}: InfiniteBookmarkListProps) {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["bookmarks", filter, selectedTagId],
    queryFn: ({ pageParam }) =>
      fetchBookmarks({
        filter,
        tagId: selectedTagId ?? undefined,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0, rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allBookmarks = data?.pages.flatMap((page) => page.items) ?? [];
  const selectedTag = tags.find((t) => t.id === selectedTagId);

  const handleTagClick = useCallback((tagId: string) => {
    setSelectedTagId((prev) => (prev === tagId ? null : tagId));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">
          Failed to load bookmarks. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tag filters + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filter:
            </span>
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTagId === tag.id ? "default" : "outline"}
                className="cursor-pointer px-2 py-0.5 text-xs transition-colors"
                style={
                  selectedTagId === tag.id
                    ? { backgroundColor: tag.color, borderColor: tag.color }
                    : { borderColor: tag.color }
                }
                onClick={() => handleTagClick(tag.id)}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      selectedTagId === tag.id ? "white" : tag.color,
                  }}
                />
                {tag.name}
              </Badge>
            ))}
            {selectedTagId && (
              <button
                onClick={() => setSelectedTagId(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {selectedTag && (
        <p className="text-sm text-muted-foreground">
          Filtering by &ldquo;{selectedTag.name}&rdquo;
        </p>
      )}

      {/* Bookmark count */}
      <p className="text-xs text-muted-foreground">
        {initialCount} {initialCount === 1 ? "bookmark" : "bookmarks"} total
      </p>

      {/* Bookmark list */}
      {allBookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium">No bookmarks yet</p>
          <p className="text-sm text-muted-foreground">
            Save your first article to get started
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-1.5">
          {allBookmarks.map((bookmark) => (
            <BookmarkListRow
              key={bookmark.id}
              bookmark={bookmark as BookmarkWithTags}
            />
          ))}
        </div>
      ) : viewMode === "headlines" ? (
        <div className="flex flex-col">
          {allBookmarks.map((bookmark) => (
            <BookmarkHeadlineRow
              key={bookmark.id}
              bookmark={bookmark as BookmarkWithTags}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allBookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark as BookmarkWithTags}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="flex justify-center py-4">
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
        {!hasNextPage && allBookmarks.length > 0 && (
          <p className="text-xs text-muted-foreground">All bookmarks loaded</p>
        )}
      </div>
    </div>
  );
}
