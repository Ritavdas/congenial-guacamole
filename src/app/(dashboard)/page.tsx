import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { RereadSection } from "@/components/reread/reread-section";
import { getBookmarks } from "@/lib/actions";
import { recomputeAllScores } from "@/lib/completion-score";
import { LotteryWidget } from "@/components/lottery/lottery-widget";
import { DailyExcerptCard } from "@/components/excerpt/excerpt-card";
import {
  reasonHint,
  selectDashboardPicks,
  type DashboardPick,
  type PickReason,
} from "@/lib/picks";

type ReasonChip = {
  label: string;
  className: string;
};

const REASON_CHIPS: Record<PickReason, ReasonChip> = {
  short: {
    label: "QUICK WIN",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  recent: {
    label: "JUST SAVED",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  stale: {
    label: "BEEN WAITING",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

function chipColor(score: number): string {
  if (score >= 0.7)
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 0.4) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

const TABS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Picks", href: "/" },
  { label: "Library", href: "/search" },
  { label: "Archive", href: "/archive" },
];

function formatTotal(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TabBar() {
  return (
    <nav
      aria-label="Sections"
      className="inline-flex shrink-0 rounded-full border bg-card p-0.5"
    >
      {TABS.map((tab) => {
        const active = tab.href === "/";
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PickItem({ pick }: { pick: DashboardPick }) {
  const chip = REASON_CHIPS[pick.reason];
  const favicon = `https://www.google.com/s2/favicons?domain=${pick.domain}&sz=64`;

  return (
    <li>
      <Link href={`/read/${pick.id}`} className="group block">
        <div className="flex items-start gap-4 rounded-xl border border-border/70 bg-card p-4 hover:bg-accent/40 hover:border-border transition-colors">
          <div className="shrink-0 rounded-lg bg-muted p-2">
            <Image
              src={favicon}
              alt=""
              width={28}
              height={28}
              unoptimized
              className="h-7 w-7 rounded-sm"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[11px] flex-wrap">
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider ${chip.className}`}
              >
                {chip.label}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span className="text-muted-foreground font-medium normal-case tracking-normal">
                {pick.domain}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span className="text-muted-foreground">
                {pick.readMinutes} min read
              </span>
              {pick.completionScore != null ? (
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${chipColor(pick.completionScore)}`}
                >
                  {Math.round(pick.completionScore * 100)}% likely
                </span>
              ) : null}
            </div>

            <h3 className="text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary">
              {pick.title}
            </h3>

            {pick.excerpt ? (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {pick.excerpt}
              </p>
            ) : null}

            <p className="mt-1 text-[11px] text-muted-foreground">
              {reasonHint(pick)}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <p className="text-base font-medium">You&apos;re all caught up.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Save something new, or{" "}
        <Link
          href="/archive"
          className="underline underline-offset-2 hover:text-foreground"
        >
          browse the archive
        </Link>
        .
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="font-medium text-destructive">Error</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ lottery?: string }>;
}) {
  // Opt out of static prerender — we use new Date() for "saved X days ago".
  await headers();
  const sp = (await searchParams) ?? {};

  const { userId } = await auth();

  let picks: DashboardPick[] = [];
  let errorMessage = "";

  try {
    const unread = await getBookmarks("unread");
    picks = selectDashboardPicks(unread);
    if (userId) {
      after(() => recomputeAllScores(userId, { limit: 30, onlyMissing: true }));
    }
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

  if (errorMessage) return <ErrorState message={errorMessage} />;

  const totalMinutes = picks.reduce((sum, p) => sum + p.readMinutes, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <LotteryWidget searchParams={sp} />
      </div>
      {userId ? (
        <div className="mb-6">
          <DailyExcerptCard userId={userId} />
        </div>
      ) : null}
      <header className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">
            Today&apos;s picks
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {picks.length === 0
              ? "Nothing in the queue"
              : `${picks.length} ${picks.length === 1 ? "pick" : "picks"} · ${formatTotal(totalMinutes)} total`}
          </p>
        </div>
        <TabBar />
      </header>

      {picks.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-6 space-y-3">
          {picks.map((pick) => (
            <PickItem key={pick.id} pick={pick} />
          ))}
        </ul>
      )}

      {userId ? <RereadSection userId={userId} /> : null}

      {picks.length > 0 ? (
        <div className="mt-8 text-center">
          <Link
            href="/search"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all bookmarks →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
