"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookmarkCard } from "@/components/bookmarks/bookmark-card";
import { BookmarkListRow } from "@/components/bookmarks/bookmark-list-row";
import { BookmarkHeadlineRow } from "@/components/bookmarks/bookmark-headline-row";
import { ViewToggle, type ViewMode } from "@/components/bookmarks/view-toggle";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookmarkWithTags } from "@/db/schema";

type BookmarkLight = Omit<BookmarkWithTags, "content" | "htmlContent">;

type StatusFilter = "all" | "unread" | "archived" | "favorites";

const STATUS_CHIPS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "archived", label: "Archived" },
  { value: "favorites", label: "Favorites" },
];

// "all" in this UI means truly everything (unread + archived) — maps to the
// new backend filter value `everything`. The other chips map 1:1.
function statusToApiFilter(status: StatusFilter): string {
  return status === "all" ? "everything" : status;
}

async function fetchBrowseResults({
  status,
  cursor,
  limit = 20,
}: {
  status: StatusFilter;
  cursor?: string;
  limit?: number;
}): Promise<{ items: BookmarkLight[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  params.set("filter", statusToApiFilter(status));
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));

  const res = await fetch(`/api/bookmarks?${params}`);
  if (!res.ok) throw new Error("Failed to load bookmarks");
  return res.json();
}

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

function parseStatus(raw: string | null): StatusFilter {
  if (raw === "unread" || raw === "archived" || raw === "favorites") return raw;
  return "all";
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="h-6" />}>
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get("status"));

  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isSearching = debouncedQuery.length >= 1;

  const setStatus = useCallback(
    (next: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("status");
      else params.set("status", next);
      const qs = params.toString();
      router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    },
    [router, searchParams],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: isSearching
      ? ["library", "search", debouncedQuery]
      : ["library", "browse", status],
    queryFn: ({ pageParam }) =>
      isSearching
        ? fetchSearchResults({
            query: debouncedQuery,
            cursor: pageParam ?? undefined,
          })
        : fetchBrowseResults({
            status,
            cursor: pageParam ?? undefined,
          }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

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

  const results = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handleTagClick = useCallback(() => {
    // no-op in library context, but needed for BookmarkCard prop
  }, []);

  const countLabel = isSearching
    ? `${results.length} result${results.length !== 1 ? "s" : ""} for “${debouncedQuery}”${hasNextPage ? "+" : ""}`
    : `${results.length}${hasNextPage ? "+" : ""} bookmark${results.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Library</h2>
        <p className="text-muted-foreground">
          Browse and search everything you&apos;ve saved
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

      <div
        role="tablist"
        aria-label="Filter bookmarks by status"
        className={cn(
          "inline-flex rounded-full border bg-card p-0.5",
          isSearching && "opacity-50 pointer-events-none",
        )}
      >
        {STATUS_CHIPS.map((chip) => {
          const active = chip.value === status;
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(chip.value)}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isSearching ? "Searching..." : "Loading..."}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">
            {isSearching ? "Search failed." : "Failed to load bookmarks."}{" "}
            Please try again.
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{countLabel}</p>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      )}

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

      {!isLoading && results.length === 0 && !isError && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          {isSearching ? (
            <>
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm text-muted-foreground">
                Try different keywords or check your spelling
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">
                Nothing here{status !== "all" ? ` in ${status}` : " yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                Save a bookmark from the extension or paste a URL above.
              </p>
            </>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
          {!hasNextPage && results.length > 0 && (
            <p className="text-xs text-muted-foreground">All loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
