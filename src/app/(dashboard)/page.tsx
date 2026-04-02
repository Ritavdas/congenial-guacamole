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
import { DailyRecommendations } from "@/components/bookmarks/daily-recommendations";
import { EnrichmentBanner } from "@/components/bookmarks/enrichment-banner";

export default async function DashboardPage() {
  let items: Awaited<ReturnType<typeof getBookmarks>> = [];
  let tagsList: Awaited<ReturnType<typeof getTags>> = [];
  let stats: Awaited<ReturnType<typeof getBookmarkStats>> | null = null;
  let recentItems: Awaited<ReturnType<typeof getRecentBookmarks>> = [];
  let unreadItems: Awaited<ReturnType<typeof getUnreadBookmarks>> = [];
  let errorMessage = "";

  try {
    [items, tagsList, stats, recentItems, unreadItems] = await Promise.all([
      getBookmarks("all"),
      getTags(),
      getBookmarkStats(),
      getRecentBookmarks(5),
      getUnreadBookmarks(3),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DashboardPage] Failed to load data:", msg);

    if (msg === "Unauthorized") {
      errorMessage = "Your session has expired. Please sign in again.";
    } else if (
      msg.includes("connect") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("database")
    ) {
      errorMessage =
        "Unable to connect to the database. Please try again later.";
    } else {
      errorMessage =
        "Something went wrong loading your dashboard. Please try again.";
    }
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">Error</p>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
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

      {/* Enrichment Banner */}
      <EnrichmentBanner />

      {/* Stats Row */}
      {stats && <DashboardStats stats={stats} />}

      {/* AI Daily Recommendations */}
      <DailyRecommendations />

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
