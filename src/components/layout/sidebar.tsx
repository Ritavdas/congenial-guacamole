"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  Star,
  Archive,
  Search,
  Tag,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "All Bookmarks", icon: Bookmark },
  { href: "/favorites", label: "Favorites", icon: Star },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/search", label: "Search", icon: Search },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/collections", label: "Collections", icon: FolderOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/30 md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Bookmark className="h-5 w-5" />
          <span>PocketClone</span>
        </Link>
      </div>

      <div className="p-4">
        <Link href="/add">
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Bookmark
          </Button>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
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
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
