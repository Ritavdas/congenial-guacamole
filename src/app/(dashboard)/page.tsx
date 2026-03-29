import { getBookmarks } from "@/lib/actions";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";

export default async function DashboardPage() {
  let items: Awaited<ReturnType<typeof getBookmarks>> = [];
  let error = false;

  try {
    items = await getBookmarks("all");
  } catch {
    error = true;
  }

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
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">Database not connected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">npx drizzle-kit push</code> to create the database tables, then refresh.
          </p>
        </div>
      ) : (
        <BookmarkList bookmarks={items} />
      )}
    </div>
  );
}
