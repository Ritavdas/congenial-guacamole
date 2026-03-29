import {
  getBookmarks,
  getTags,
  getBookmarkStats,
  getRecentBookmarks,
  getUnreadBookmarks,
} from "@/lib/actions";
import { FilterableBookmarkList } from "@/components/bookmarks/filterable-bookmark-list";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";
import { DashboardStats } from "@/components/bookmarks/dashboard-stats";
import { ReadingQueue } from "@/components/bookmarks/reading-queue";
import { RecentBookmarks } from "@/components/bookmarks/recent-bookmarks";

export default async function DashboardPage() {
  let items: Awaited<ReturnType<typeof getBookmarks>> = [];
  let tagsList: Awaited<ReturnType<typeof getTags>> = [];
  let stats: Awaited<ReturnType<typeof getBookmarkStats>> | null = null;
  let recentItems: Awaited<ReturnType<typeof getRecentBookmarks>> = [];
  let unreadItems: Awaited<ReturnType<typeof getUnreadBookmarks>> = [];
  let error = false;

  try {
    [items, tagsList, stats, recentItems, unreadItems] = await Promise.all([
      getBookmarks("all"),
      getTags(),
      getBookmarkStats(),
      getRecentBookmarks(5),
      getUnreadBookmarks(3),
    ]);
  } catch {
    error = true;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">Database not connected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              npx drizzle-kit push
            </code>{" "}
            to create the database tables, then refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            {stats?.unread
              ? `You have ${stats.unread} unread article${stats.unread !== 1 ? "s" : ""}`
              : "Your reading hub"}
          </p>
        </div>
        <AddBookmarkDialog />
      </div>

      {/* Stats Row */}
      {stats && <DashboardStats stats={stats} />}

      {/* Reading Queue */}
      {unreadItems.length > 0 && <ReadingQueue bookmarks={unreadItems} />}

      {/* Recent Bookmarks */}
      {recentItems.length > 0 && <RecentBookmarks bookmarks={recentItems} />}

      {/* All Bookmarks with filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">
            All Bookmarks
          </h3>
          <span className="text-sm text-muted-foreground">
            {items.length} saved
          </span>
        </div>
        <FilterableBookmarkList bookmarks={items} tags={tagsList} />
      </div>
    </div>
  );
}
