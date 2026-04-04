import { getBookmarkCount, getTags } from "@/lib/actions";
import { InfiniteBookmarkList } from "@/components/bookmarks/infinite-bookmark-list";

export default async function FavoritesPage() {
  const [count, tags] = await Promise.all([
    getBookmarkCount("favorites"),
    getTags(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Favorites</h2>
        <p className="text-muted-foreground">
          {count} favorite {count === 1 ? "article" : "articles"}
        </p>
      </div>
      <InfiniteBookmarkList
        filter="favorites"
        tags={tags}
        initialCount={count}
      />
    </div>
  );
}
