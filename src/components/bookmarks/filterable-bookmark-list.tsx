"use client";

import { useState } from "react";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { BookmarkWithTags, Tag } from "@/db/schema";

interface FilterableBookmarkListProps {
  bookmarks: BookmarkWithTags[];
  tags: Tag[];
}

export function FilterableBookmarkList({
  bookmarks,
  tags,
}: FilterableBookmarkListProps) {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const filtered = selectedTagId
    ? bookmarks.filter((b) => b.tags.some((t) => t.id === selectedTagId))
    : bookmarks;

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  return (
    <div className="space-y-4">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filter by tag:
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
              onClick={() =>
                setSelectedTagId(selectedTagId === tag.id ? null : tag.id)
              }
            >
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedTagId === tag.id ? "white" : tag.color }}
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
      {selectedTag && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} bookmark{filtered.length !== 1 ? "s" : ""} tagged &ldquo;{selectedTag.name}&rdquo;
        </p>
      )}
      <BookmarkList
        bookmarks={filtered}
        onTagClick={(tagId) =>
          setSelectedTagId(selectedTagId === tagId ? null : tagId)
        }
      />
    </div>
  );
}
