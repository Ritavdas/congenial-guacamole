import { PocketImport } from "@/components/import/pocket-import";
import { TwitterImport } from "@/components/import/twitter-import";
import { TwitterBookmarksImport } from "@/components/import/twitter-bookmarks-import";
import { TwitterSyncStatusBanner } from "@/components/import/twitter-sync-status-banner";

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Import</h2>
        <p className="text-muted-foreground">
          Bring your saved articles from other services into Pockaa.
        </p>
      </div>

      <TwitterSyncStatusBanner />

      <div className="grid gap-6 md:grid-cols-2">
        <PocketImport />
        <TwitterImport />
        <TwitterBookmarksImport />
      </div>
    </div>
  );
}
