"use client";

import { Bookmark } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Star,
  Archive,
  Trash2,
  ExternalLink,
  BookOpen,
  MoreVertical,
  Check,
} from "lucide-react";
import {
  toggleBookmarkFavorite,
  toggleBookmarkArchive,
  toggleBookmarkRead,
  deleteBookmark,
} from "@/lib/actions";
import Link from "next/link";
import { toast } from "sonner";

interface BookmarkCardProps {
  bookmark: Bookmark;
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  async function handleFavorite() {
    try {
      await toggleBookmarkFavorite(bookmark.id);
      toast.success(bookmark.isFavorite ? "Removed from favorites" : "Added to favorites");
    } catch {
      toast.error("Failed to update bookmark");
    }
  }

  async function handleArchive() {
    try {
      await toggleBookmarkArchive(bookmark.id);
      toast.success(bookmark.isArchived ? "Unarchived" : "Archived");
    } catch {
      toast.error("Failed to update bookmark");
    }
  }

  async function handleRead() {
    try {
      await toggleBookmarkRead(bookmark.id);
    } catch {
      toast.error("Failed to update bookmark");
    }
  }

  async function handleDelete() {
    try {
      await deleteBookmark(bookmark.id);
      toast.success("Bookmark deleted");
    } catch {
      toast.error("Failed to delete bookmark");
    }
  }

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {bookmark.ogImage && (
        <div className="relative h-40 overflow-hidden">
          <img
            src={bookmark.ogImage}
            alt={bookmark.title ?? ""}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      )}
      <CardHeader className="flex-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base leading-snug">
            {bookmark.title ?? bookmark.url}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleFavorite}>
                <Star className="mr-2 h-4 w-4" />
                {bookmark.isFavorite ? "Unfavorite" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRead}>
                <Check className="mr-2 h-4 w-4" />
                Mark as {bookmark.isRead ? "unread" : "read"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                {bookmark.isArchived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription className="line-clamp-2 text-xs">
          {bookmark.description ?? "No description"}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex items-center justify-between pt-0">
        <span className="text-xs text-muted-foreground">{bookmark.domain}</span>
        <div className="flex gap-1">
          <Link href={`/read/${bookmark.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <BookOpen className="h-4 w-4" />
            </Button>
          </Link>
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}
