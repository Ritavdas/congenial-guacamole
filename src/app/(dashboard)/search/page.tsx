"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { BookmarkCard } from "@/components/bookmarks/bookmark-card";
import { BookmarkListRow } from "@/components/bookmarks/bookmark-list-row";
import { BookmarkHeadlineRow } from "@/components/bookmarks/bookmark-headline-row";
import { ViewToggle, type ViewMode } from "@/components/bookmarks/view-toggle";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import type { BookmarkWithTags } from "@/db/schema";

type BookmarkLight = Omit<BookmarkWithTags, "content" | "htmlContent">;

async function fetchSearchResults({
  query,
  cursor,
  limit = 20,
}: {
  query: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: BookmarkLight[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));

  const res = await fetch(`/api/bookmarks/search?${params}`);
  if (!res.ok) throw new Error("Failed to search bookmarks");
  return res.json();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const debouncedQuery = useDebounce(query, 300);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: ({ pageParam }) =>
      fetchSearchResults({
        query: debouncedQuery,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: debouncedQuery.length >= 2,
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

  const results = data?.pages.flatMap((page) => page.items) ?? [];

  const handleTagClick = useCallback((tagId: string) => {
    // no-op in search context, but needed for BookmarkCard prop
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Search</h2>
        <p className="text-muted-foreground">
          Search across all your saved articles
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search bookmarks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Status messages */}
      {debouncedQuery.length >= 2 && isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">
            Search failed. Please try again.
          </p>
        </div>
      )}

      {debouncedQuery.length >= 2 && !isLoading && !isError && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
            {debouncedQuery}&rdquo;
            {hasNextPage && "+"}
          </p>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {viewMode === "list" ? (
            <div className="space-y-1.5">
              {results.map((bookmark) => (
                <BookmarkListRow
                  key={bookmark.id}
                  bookmark={bookmark as BookmarkWithTags}
                />
              ))}
            </div>
          ) : viewMode === "headlines" ? (
            <div className="flex flex-col">
              {results.map((bookmark) => (
                <BookmarkHeadlineRow
                  key={bookmark.id}
                  bookmark={bookmark as BookmarkWithTags}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark as BookmarkWithTags}
                  onTagClick={handleTagClick}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {debouncedQuery.length >= 2 &&
        !isLoading &&
        results.length === 0 &&
        !isError && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm text-muted-foreground">
              Try different keywords or check your spelling
            </p>
          </div>
        )}

      {/* Infinite scroll trigger */}
      {results.length > 0 && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
          {!hasNextPage && results.length > 0 && (
            <p className="text-xs text-muted-foreground">All results loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
