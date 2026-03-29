"use client";

import { useState, useEffect } from "react";
import { getCollections, createCollection } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { Collection } from "@/db/schema";

export default function CollectionsPage() {
  const [collectionsList, setCollectionsList] = useState<Collection[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCollections().then(setCollectionsList);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setLoading(true);
    try {
      const collection = await createCollection(newName.trim());
      setCollectionsList((prev) => [...prev, collection]);
      setNewName("");
      toast.success(`Collection "${collection.name}" created`);
    } catch {
      toast.error("Failed to create collection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Collections</h2>
        <p className="text-muted-foreground">Group bookmarks into collections</p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="New collection name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" disabled={loading || !newName.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collectionsList.map((collection) => (
          <Card key={collection.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                {collection.name}
              </CardTitle>
              {collection.description && (
                <CardDescription>{collection.description}</CardDescription>
              )}
            </CardHeader>
          </Card>
        ))}
        {collectionsList.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No collections yet. Create your first one!
          </p>
        )}
      </div>
    </div>
  );
}
