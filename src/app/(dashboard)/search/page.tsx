"use client";

import { useState } from "react";
import { searchBookmarks } from "@/lib/actions";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import type { Bookmark } from "@/db/schema";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await searchBookmarks(value);
      setResults(data);
    } finally {
      setSearching(false);
    }
  }

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
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {searching && (
        <p className="text-sm text-muted-foreground">Searching...</p>
      )}

      {query.length >= 2 && !searching && (
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </p>
      )}

      <BookmarkList bookmarks={results} />
    </div>
  );
}
