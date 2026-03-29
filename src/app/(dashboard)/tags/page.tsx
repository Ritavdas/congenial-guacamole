"use client";

import { useState, useEffect } from "react";
import { getTags, createTag } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tag } from "@/db/schema";

export default function TagsPage() {
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTags().then(setTagsList);
  }, []);

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setLoading(true);
    try {
      const tag = await createTag(newTagName.trim());
      setTagsList((prev) => [...prev, tag]);
      setNewTagName("");
      toast.success(`Tag "${tag.name}" created`);
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
        <p className="text-muted-foreground">Organize your bookmarks with tags</p>
      </div>

      <form onSubmit={handleCreateTag} className="flex gap-2">
        <Input
          placeholder="New tag name..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" disabled={loading || !newTagName.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tagsList.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="px-3 py-1 text-sm"
            style={{ borderColor: tag.color }}
          >
            {tag.name}
          </Badge>
        ))}
        {tagsList.length === 0 && (
          <p className="text-sm text-muted-foreground">No tags yet. Create your first one!</p>
        )}
      </div>
    </div>
  );
}
