import { getBookmarkById, getHighlights } from "@/lib/actions";
import { notFound } from "next/navigation";
import { ReaderView } from "@/components/bookmarks/reader-view";
import { ReaderTelemetry } from "@/components/bookmarks/reader-telemetry";

interface ReadPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { id } = await params;
  const bookmark = await getBookmarkById(id);

  if (!bookmark) {
    notFound();
  }

  const bookmarkHighlights = await getHighlights(id);

  return (
    <>
      <ReaderTelemetry bookmarkId={id} />
      <ReaderView bookmark={bookmark} highlights={bookmarkHighlights} />
    </>
  );
}
