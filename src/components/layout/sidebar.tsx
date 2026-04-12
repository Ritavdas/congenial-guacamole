"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Bookmark, Home, Archive, Search } from "lucide-react";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/archive", label: "Archive", icon: Archive },
];

interface TagWithCount {
  id: string;
  name: string;
  color: string;
  bookmarkCount: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [tags, setTags] = useState<TagWithCount[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    fetch("/api/extension/tags", {
      headers: { "X-User-Id": user.id },
    })
      .then((res) => res.json())
      .then((data) => setTags(data.tags ?? []))
      .catch(() => setTags([]));
  }, [user?.id]);

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/30 md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Bookmark className="h-5 w-5" />
          <span>Pockaa</span>
        </Link>
      </div>

      <div className="p-4">
        <AddBookmarkDialog fullWidth />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground/60 uppercase">
            Tags
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {tags.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground/60">
            No tags yet
          </p>
        ) : (
          tags.map((tag) => {
            const tagHref = `/tags/${tag.id}`;
            const isActive = pathname === tagHref;
            return (
              <Link
                key={tag.id}
                href={tagHref}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="truncate">{tag.name}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground/60">
                  {tag.bookmarkCount}
                </span>
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
