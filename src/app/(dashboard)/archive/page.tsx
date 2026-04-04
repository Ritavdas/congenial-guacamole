import { getBookmarkCount, getTags } from "@/lib/actions";
import { InfiniteBookmarkList } from "@/components/bookmarks/infinite-bookmark-list";

export default async function ArchivePage() {
  const [count, tags] = await Promise.all([
    getBookmarkCount("archived"),
    getTags(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Archive</h2>
        <p className="text-muted-foreground">
          {count} archived {count === 1 ? "article" : "articles"}
        </p>
      </div>
      <InfiniteBookmarkList
        filter="archived"
        tags={tags}
        initialCount={count}
      />
    </div>
  );
}
