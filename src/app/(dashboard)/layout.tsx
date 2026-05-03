import { UserButton } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <h1 className="text-lg font-semibold">Pockaa</h1>
          <div className="flex items-center gap-2">
            <AddBookmarkDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add bookmark"
                  className="h-9 w-9 md:hidden"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
            <UserButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
