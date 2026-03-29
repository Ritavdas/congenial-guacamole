import { getBookmarks } from "@/lib/actions";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";

export default async function DashboardPage() {
  const items = await getBookmarks("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All Bookmarks</h2>
          <p className="text-muted-foreground">
            {items.length} saved {items.length === 1 ? "article" : "articles"}
          </p>
        </div>
        <AddBookmarkDialog />
      </div>
      <BookmarkList bookmarks={items} />
    </div>
  );
}
