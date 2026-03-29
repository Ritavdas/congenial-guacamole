"use client";

import { useState, useEffect } from "react";
import { getTagsWithCount, createTag, updateTag, deleteTag } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { TagWithCount } from "@/db/schema";

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export default function TagsPage() {
  const [tagsList, setTagsList] = useState<TagWithCount[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    getTagsWithCount().then(setTagsList);
  }, []);

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setLoading(true);
    try {
      const tag = await createTag(newTagName.trim(), newTagColor);
      setTagsList((prev) => [...prev, { ...tag, bookmarkCount: 0 }]);
      setNewTagName("");
      setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
      toast.success(`Tag "${tag.name}" created`);
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTag(tagId: string) {
    if (!editName.trim()) return;

    try {
      const updated = await updateTag(tagId, editName.trim(), editColor);
      setTagsList((prev) =>
        prev.map((t) =>
          t.id === tagId
            ? { ...t, name: updated.name, color: updated.color }
            : t
        )
      );
      setEditingId(null);
      toast.success("Tag updated");
    } catch {
      toast.error("Failed to update tag");
    }
  }

  async function handleDeleteTag(tagId: string, tagName: string) {
    try {
      await deleteTag(tagId);
      setTagsList((prev) => prev.filter((t) => t.id !== tagId));
      toast.success(`Tag "${tagName}" deleted`);
    } catch {
      toast.error("Failed to delete tag");
    }
  }

  function startEditing(tag: TagWithCount) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
        <p className="text-muted-foreground">Organize your bookmarks with tags</p>
      </div>

      <form onSubmit={handleCreateTag} className="flex items-center gap-2">
        <Input
          placeholder="New tag name..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {TAG_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: newTagColor === color ? "white" : "transparent",
                boxShadow: newTagColor === color ? `0 0 0 2px ${color}` : "none",
              }}
              onClick={() => setNewTagColor(color)}
            />
          ))}
        </div>
        <Button type="submit" disabled={loading || !newTagName.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="space-y-2">
        {tagsList.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            {editingId === tag.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 max-w-[200px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateTag(tag.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="flex gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: editColor === color ? "white" : "transparent",
                        boxShadow: editColor === color ? `0 0 0 2px ${color}` : "none",
                      }}
                      onClick={() => setEditColor(color)}
                    />
                  ))}
                </div>
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleUpdateTag(tag.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Badge
                  variant="secondary"
                  className="px-3 py-1 text-sm"
                  style={{ borderColor: tag.color, borderWidth: 1 }}
                >
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {tag.bookmarkCount} bookmark{tag.bookmarkCount !== 1 ? "s" : ""}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => startEditing(tag)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTag(tag.id, tag.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {tagsList.length === 0 && (
          <p className="text-sm text-muted-foreground">No tags yet. Create your first one!</p>
        )}
      </div>
    </div>
  );
}
