import Link from "next/link";

import { getOrCreateDailyExcerpt } from "@/lib/excerpt";

export async function DailyExcerptCard({ userId }: { userId: string }) {
  const data = await getOrCreateDailyExcerpt(userId);
  if (!data) return null;

  const { excerpt, bookmarkId, bookmarkTitle, bookmarkDomain } = data;

  return (
    <article className="rounded-xl border border-amber-200/40 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-900/30 p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        From your archive
      </div>
      <blockquote className="mt-3 text-base leading-relaxed text-foreground/90">
        &ldquo;{excerpt}&rdquo;
      </blockquote>
      <Link
        href={`/read/${bookmarkId}`}
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        — {bookmarkTitle}{" "}
        {bookmarkDomain ? <span>· {bookmarkDomain}</span> : null} →
      </Link>
    </article>
  );
}
