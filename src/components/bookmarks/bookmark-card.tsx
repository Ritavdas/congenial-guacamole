"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { BookmarkWithTags } from "@/db/schema";
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
import { Badge } from "@/components/ui/badge";
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
import { TagSelector } from "./tag-selector";
import Link from "next/link";
import { toast } from "sonner";

interface BookmarkCardProps {
  bookmark: BookmarkWithTags;
  onTagClick?: (tagId: string) => void;
}

export const BookmarkCard = memo(
  function BookmarkCard({ bookmark, onTagClick }: BookmarkCardProps) {
    const [cardTags, setCardTags] = useState(bookmark.tags);

    async function handleFavorite() {
      try {
        await toggleBookmarkFavorite(bookmark.id);
        toast.success(
          bookmark.isFavorite ? "Removed from favorites" : "Added to favorites",
        );
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
        {bookmark.ogImage ? (
          <div className="relative h-40 overflow-hidden">
            <Image
              src={bookmark.ogImage}
              alt={bookmark.title ?? ""}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
            />
          </div>
        ) : (
          <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-muted/50 to-muted">
            {bookmark.domain && (
              <img
                src={`https://www.google.com/s2/favicons?domain=${bookmark.domain}&sz=64`}
                alt=""
                width={64}
                height={64}
                className="opacity-60"
              />
            )}
          </div>
        )}
        <CardHeader className="flex-1 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-base leading-snug">
              {bookmark.title ?? bookmark.url}
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  />
                }
              >
                <MoreVertical className="h-4 w-4" />
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
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardDescription className="line-clamp-2 text-xs">
            {bookmark.description
              ? bookmark.description
              : bookmark.content
                ? bookmark.content.slice(0, 120) +
                  (bookmark.content.length > 120 ? "..." : "")
                : (bookmark.domain ?? "No description")}
          </CardDescription>
        </CardHeader>
        {cardTags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-6 pb-2">
            {cardTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="cursor-pointer px-1.5 py-0 text-[10px]"
                style={{ borderColor: tag.color, borderWidth: 1 }}
                onClick={() => onTagClick?.(tag.id)}
              >
                <span
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        <CardFooter className="flex items-center justify-between pt-0">
          <span className="text-xs text-muted-foreground">
            {bookmark.domain}
          </span>
          <div className="flex items-center gap-1">
            <TagSelector
              bookmarkId={bookmark.id}
              currentTags={cardTags}
              onTagsChange={setCardTags}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              nativeButton={false}
              render={<Link href={`/read/${bookmark.id}`} />}
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              nativeButton={false}
              render={
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  },
  (prev, next) => {
    return (
      prev.bookmark.id === next.bookmark.id &&
      prev.bookmark.isFavorite === next.bookmark.isFavorite &&
      prev.bookmark.isArchived === next.bookmark.isArchived &&
      prev.bookmark.isRead === next.bookmark.isRead &&
      prev.bookmark.tags.length === next.bookmark.tags.length &&
      prev.onTagClick === next.onTagClick
    );
  },
);
