import { getBookmarks } from "@/lib/actions";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";

export default async function ArchivePage() {
  const items = await getBookmarks("archived");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Archive</h2>
        <p className="text-muted-foreground">
          {items.length} archived {items.length === 1 ? "article" : "articles"}
        </p>
      </div>
      <BookmarkList bookmarks={items} />
    </div>
  );
}
