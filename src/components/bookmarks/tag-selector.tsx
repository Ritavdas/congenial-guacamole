"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tag as TagIcon, Check, Plus, Loader2 } from "lucide-react";
import {
  getTags,
  addTagToBookmark,
  removeTagFromBookmark,
  createTag,
} from "@/lib/actions";
import { toast } from "sonner";
import type { Tag } from "@/db/schema";

interface TagSelectorProps {
  bookmarkId: string;
  currentTags: { id: string; name: string; color: string }[];
  onTagsChange?: (tags: { id: string; name: string; color: string }[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TagSelector({
  bookmarkId,
  currentTags,
  onTagsChange,
  open,
  onOpenChange,
}: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(currentTags.map((t) => t.id)),
  );
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set(currentTags.map((t) => t.id)));
  }, [currentTags]);

  async function loadTags() {
    try {
      const tags = await getTags();
      setAllTags(tags);
    } catch {
      toast.error("Failed to load tags");
    }
  }

  async function toggleTag(tag: Tag) {
    setLoading(true);
    const wasSelected = selectedIds.has(tag.id);

    try {
      if (wasSelected) {
        await removeTagFromBookmark(bookmarkId, tag.id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(tag.id);
          return next;
        });
        onTagsChange?.(currentTags.filter((t) => t.id !== tag.id));
      } else {
        await addTagToBookmark(bookmarkId, tag.id);
        setSelectedIds((prev) => new Set(prev).add(tag.id));
        onTagsChange?.([
          ...currentTags,
          { id: tag.id, name: tag.name, color: tag.color },
        ]);
      }
    } catch {
      toast.error("Failed to update tag");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setCreating(true);
    try {
      const tag = await createTag(newTagName.trim());
      setAllTags((prev) => [...prev, tag]);
      setNewTagName("");
      // Auto-assign the new tag
      await addTagToBookmark(bookmarkId, tag.id);
      setSelectedIds((prev) => new Set(prev).add(tag.id));
      onTagsChange?.([
        ...currentTags,
        { id: tag.id, name: tag.name, color: tag.color },
      ]);
      toast.success(`Tag "${tag.name}" created and added`);
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) loadTags();
        onOpenChange?.(nextOpen);
        void eventDetails;
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
          />
        }
      >
        <TagIcon className="h-3 w-3" />
        Tags
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">
            Assign tags
          </p>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag)}
                disabled={loading}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-left truncate">{tag.name}</span>
                {selectedIds.has(tag.id) && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            ))}
            {allTags.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">
                No tags yet
              </p>
            )}
          </div>
          <form
            onSubmit={handleCreateTag}
            className="flex items-center gap-1 border-t pt-2"
          >
            <Input
              placeholder="New tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="h-7 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0"
              disabled={creating || !newTagName.trim()}
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
