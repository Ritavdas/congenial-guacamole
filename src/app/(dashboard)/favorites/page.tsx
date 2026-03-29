import { getBookmarks } from "@/lib/actions";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";

export default async function FavoritesPage() {
  const items = await getBookmarks("favorites");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Favorites</h2>
        <p className="text-muted-foreground">
          {items.length} favorite {items.length === 1 ? "article" : "articles"}
        </p>
      </div>
      <BookmarkList bookmarks={items} />
    </div>
  );
}
