"use client";

import { useEffect, useState } from "react";
import { addBookmark } from "@/lib/actions";
import { Button } from "@/components/ui/button";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddBookmarkDialogProps {
  fullWidth?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialUrl?: string;
  trigger?: React.ReactElement;
}

export function AddBookmarkDialog({
  fullWidth,
  open: controlledOpen,
  onOpenChange,
  initialUrl,
  trigger,
}: AddBookmarkDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [url, setUrl] = useState(initialUrl ?? "");
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      await addBookmark(url);
      toast.success("Bookmark saved!");
      setUrl("");
      setOpen(false);
    } catch {
      toast.error("Failed to save bookmark. Check the URL and try again.");
    } finally {
      setLoading(false);
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
      </DialogContent>
    </Dialog>
  );
}
