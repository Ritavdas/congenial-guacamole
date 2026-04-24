import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { drawLotteryAction, skipLotteryAction } from "@/lib/actions";
import { getActiveLottery } from "@/lib/lottery";
import { LotteryCountdown } from "./lottery-countdown";

export async function LotteryWidget({
  searchParams,
}: {
  searchParams?: { lottery?: string };
}) {
  const { userId } = await auth();
  if (!userId) return null;

  // Never let a lottery DB error take down the entire dashboard. The widget
  // is a soft enhancement — render the empty state on failure and log so we
  // can investigate without breaking the page.
  let active: Awaited<ReturnType<typeof getActiveLottery>> = null;
  try {
    active = await getActiveLottery(userId);
  } catch (err) {
    console.error(
      "[LotteryWidget] getActiveLottery failed:",
      err instanceof Error ? err.message : err,
    );
    active = null;
  }

  const flash = searchParams?.lottery;

  if (!active) {
    return (
      <section
        aria-label="Read it or lose it lottery"
        className="rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-500/5 via-card to-amber-500/5 p-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">
              🎰 Read it or lose it
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One random bookmark. 24 hours to read it. Or it&apos;s gone.
            </p>
            {flash === "empty" ? (
              <p
                role="status"
                className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400"
              >
                No unread bookmarks to draw from. Save something first.
              </p>
            ) : null}
          </div>
          <form action={drawLotteryAction} className="shrink-0">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              Spin the wheel
            </button>
          </form>
        </div>
      </section>
    );
  }

  const expiresAtIso = active.expiresAt.toISOString();
  const title = active.bookmark.title?.trim() || active.bookmark.url;

  return (
    <section
      aria-label="Active lottery pick"
      className="rounded-xl border border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-card to-amber-500/10 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
          🎰 Lottery pick
        </span>
        <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
          expires in <LotteryCountdown expiresAt={expiresAtIso} />
        </span>
      </div>

      <Link
        href={`/read/${active.bookmark.id}`}
        className="mt-2 block text-base font-semibold leading-snug hover:text-primary line-clamp-2"
      >
        {title}
      </Link>
      {active.bookmark.domain ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {active.bookmark.domain}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/read/${active.bookmark.id}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
        >
          Read now
        </Link>
        <form action={skipLotteryAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        </form>
      </div>
    </section>
  );
}
