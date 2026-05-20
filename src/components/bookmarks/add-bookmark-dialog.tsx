"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  addBookmark,
  addTagToBookmark,
  createTag,
  getTagsWithCount,
  removeTagFromBookmark,
} from "@/lib/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface AddBookmarkDialogProps {
  fullWidth?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialUrl?: string;
  trigger?: React.ReactElement;
}

type TagWithCount = {
  id: string;
  name: string;
  color: string;
  bookmarkCount: number;
};

type SavedBookmark = {
  id: string;
  title: string | null;
  domain: string | null;
  url: string;
  ogImage?: string | null;
  createdAt?: Date | string | null;
  tags: { id: string; name: string; color: string }[];
};

type View = "input" | "saved";

const QUICK_TAG_LIMIT = 5;

export function AddBookmarkDialog({
  fullWidth,
  open: controlledOpen,
  onOpenChange,
  initialUrl,
  trigger,
}: AddBookmarkDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [view, setView] = useState<View>("input");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [loading, setLoading] = useState(false);

  const [savedBookmark, setSavedBookmark] = useState<SavedBookmark | null>(
    null,
  );
  const [wasExisting, setWasExisting] = useState(false);

  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagsLoading, setTagsLoading] = useState(false);
  const [pendingTagIds, setPendingTagIds] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [creatingTag, setCreatingTag] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Track previous open state and initialUrl so we only prefill on a fresh
  // closed -> open transition, or when initialUrl itself changes.
  const [wasOpen, setWasOpen] = useState(open);
  const [lastInitialUrl, setLastInitialUrl] = useState(initialUrl);

  useEffect(() => {
    if (initialUrl !== lastInitialUrl) {
      setLastInitialUrl(initialUrl);
      if (initialUrl !== undefined) setUrl(initialUrl);
    }
    if (open && !wasOpen && initialUrl) {
      setUrl(initialUrl);
    }
    if (open !== wasOpen) setWasOpen(open);
  }, [open, wasOpen, initialUrl, lastInitialUrl]);

  // Reset to the input view whenever the dialog closes so the next open
  // starts fresh.
  useEffect(() => {
    if (!open) {
      setView("input");
      setSavedBookmark(null);
      setWasExisting(false);
      setSelectedTagIds(new Set());
      setPendingTagIds(new Set());
      setQuery("");
      setDropdownOpen(false);
      setActiveIdx(-1);
    }
  }, [open]);

  // Close the dropdown when clicking outside the search wrapper.
  useEffect(() => {
    if (!dropdownOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [dropdownOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      const result = await addBookmark(url);
      // Invalidate the client-side React Query cache so InfiniteBookmarkList
      // (favorites/archive/etc.) refetches and shows the new bookmark, and
      // refresh the router so RSC pages (e.g. the dashboard /) pick up the
      // revalidated server cache before we switch views.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
        Promise.resolve(router.refresh()),
      ]);

      setSavedBookmark(result.bookmark);
      setSelectedTagIds(new Set(result.bookmark.tags.map((t) => t.id)));
      setWasExisting(result.action === "existing");
      toast.success(
        result.action === "existing"
          ? "Already saved \u2014 you can update tags"
          : "Bookmark saved!",
      );

      // Load tags in the background; render the saved view immediately so
      // the user sees the success state without waiting on the tag fetch.
      setView("saved");
      setTagsLoading(true);
      try {
        const tags = await getTagsWithCount();
        setAllTags(
          tags.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            bookmarkCount: t.bookmarkCount,
          })),
        );
      } catch {
        setAllTags([]);
      } finally {
        setTagsLoading(false);
      }
    } catch {
      toast.error("Failed to save bookmark. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    setUrl("");
    setOpen(false);
  }

  async function toggleTag(tag: TagWithCount) {
    if (!savedBookmark) return;
    const isSelected = selectedTagIds.has(tag.id);

    // Optimistic update so the pill flips immediately.
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(tag.id);
      else next.add(tag.id);
      return next;
    });
    setPendingTagIds((prev) => new Set(prev).add(tag.id));

    try {
      if (isSelected) {
        await removeTagFromBookmark(savedBookmark.id, tag.id);
      } else {
        await addTagToBookmark(savedBookmark.id, tag.id);
      }
      // Refresh server-rendered lists so the tag chip appears on the card.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
        Promise.resolve(router.refresh()),
      ]);
    } catch {
      // Rollback on failure.
      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        if (isSelected) next.add(tag.id);
        else next.delete(tag.id);
        return next;
      });
      toast.error("Failed to update tag");
    } finally {
      setPendingTagIds((prev) => {
        const next = new Set(prev);
        next.delete(tag.id);
        return next;
      });
    }
  }

  async function handleCreateTag(name: string) {
    if (!savedBookmark || !name.trim()) return;
    setCreatingTag(true);
    try {
      const tag = await createTag(name.trim());
      const withCount: TagWithCount = {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        bookmarkCount: 0,
      };
      setAllTags((prev) => [withCount, ...prev]);
      await addTagToBookmark(savedBookmark.id, tag.id);
      setSelectedTagIds((prev) => new Set(prev).add(tag.id));
      setQuery("");
      setDropdownOpen(false);
      setActiveIdx(-1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
        Promise.resolve(router.refresh()),
      ]);
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setCreatingTag(false);
    }
  }

  // Quick-tag pills: top 5 by usage, plus any selected tag not already in
  // the top 5 (so a tag stays visible right after the user picks it).
  const quickTags = useMemo(() => {
    const sorted = [...allTags].sort(
      (a, b) => b.bookmarkCount - a.bookmarkCount,
    );
    const top = sorted.slice(0, QUICK_TAG_LIMIT);
    const topIds = new Set(top.map((t) => t.id));
    const extras: TagWithCount[] = [];
    for (const id of selectedTagIds) {
      if (!topIds.has(id)) {
        const tag = allTags.find((t) => t.id === id);
        if (tag) extras.push(tag);
      }
    }
    return [...top, ...extras];
  }, [allTags, selectedTagIds]);

  const filteredDropdownTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return allTags.some((t) => t.name.toLowerCase() === q);
  }, [allTags, query]);

  const showCreateOption = query.trim().length > 0 && !exactMatch;
  // Indices: tag options first, then the optional "create" row.
  const dropdownOptionCount =
    filteredDropdownTags.length + (showCreateOption ? 1 : 0);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || dropdownOptionCount === 0) {
      if (e.key === "Escape") (e.target as HTMLInputElement).blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % dropdownOptionCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(
        (prev) => (prev - 1 + dropdownOptionCount) % dropdownOptionCount,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeIdx >= 0 ? activeIdx : 0;
      if (idx < filteredDropdownTags.length) {
        toggleTag(filteredDropdownTags[idx]);
      } else if (showCreateOption) {
        handleCreateTag(query);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDropdownOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button className={fullWidth ? "w-full gap-2" : "gap-2"}>
              <Plus className="h-4 w-4" />
              Add Bookmark
            </Button>
          )
        }
      />
      <DialogContent>
        {view === "input" ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add a Bookmark</DialogTitle>
              <DialogDescription>
                Paste a URL and we&apos;ll automatically extract the title,
                description, and image.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !url.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle>
                {wasExisting ? "Already saved" : "Bookmark saved"}
              </DialogTitle>
              <DialogDescription className="line-clamp-2">
                {savedBookmark?.title ||
                  savedBookmark?.url ||
                  "Untitled bookmark"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="text-xs text-muted-foreground">
                {savedBookmark?.domain ?? ""}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Quick tags
                </p>
                {tagsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading tags...
                  </div>
                ) : quickTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tags yet. Use the search below to create one.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {quickTags.map((tag) => {
                      const isSelected = selectedTagIds.has(tag.id);
                      const isPending = pendingTagIds.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60"
                          style={{
                            borderColor: tag.color,
                            background: isSelected ? tag.color : "transparent",
                            color: isSelected ? "white" : tag.color,
                          }}
                        >
                          {isPending && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative" ref={searchWrapRef}>
                <Input
                  placeholder="Search or create a tag..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIdx(-1);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setActiveIdx(-1);
                    setDropdownOpen(true);
                  }}
                  onKeyDown={onSearchKeyDown}
                  disabled={tagsLoading}
                />
                {dropdownOpen && (filteredDropdownTags.length > 0 || query) && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {filteredDropdownTags.length === 0 && !query && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No tags yet. Type to create one.
                      </div>
                    )}
                    {filteredDropdownTags.map((tag, idx) => {
                      const isSelected = selectedTagIds.has(tag.id);
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => toggleTag(tag)}
                          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                            isActive ? "bg-muted" : ""
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 truncate">{tag.name}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </button>
                      );
                    })}
                    {showCreateOption && (
                      <button
                        type="button"
                        onMouseEnter={() =>
                          setActiveIdx(filteredDropdownTags.length)
                        }
                        onClick={() => handleCreateTag(query)}
                        disabled={creatingTag}
                        className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                          activeIdx === filteredDropdownTags.length
                            ? "bg-muted"
                            : ""
                        }`}
                      >
                        {creatingTag ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        <span className="flex-1 truncate">
                          Create &ldquo;{query.trim()}&rdquo;
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              {savedBookmark?.id && (
                <a
                  href={`/read/${savedBookmark.id}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Open in reader
                </a>
              )}
              <Button type="button" onClick={handleDone}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
