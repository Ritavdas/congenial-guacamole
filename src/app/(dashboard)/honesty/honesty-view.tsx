import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { refreshHonestyAction } from "@/lib/actions";
import type { HonestyStats } from "@/lib/honesty";

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function ratioBadgeClass(ratio: number): string {
  if (ratio > 0.5)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (ratio >= 0.2)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
}

function formatMonthLabel(month: string): string {
  const [, m] = month.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const idx = Number(m) - 1;
  return monthNames[idx] ?? month;
}

function MonthlyChart({
  data,
}: {
  data: Array<{ month: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        No bookmarks added in the last 12 months.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <TooltipProvider>
      <div className="flex items-end gap-2 px-2" style={{ height: 160 }}>
        {data.map((d) => {
          const height = Math.max(2, (d.count / max) * 120);
          return (
            <Tooltip key={d.month}>
              <TooltipTrigger
                render={
                  <div className="flex flex-1 min-w-0 flex-col items-center justify-end gap-1" />
                }
              >
                <div
                  className="w-full rounded-t bg-indigo-500/70 transition-colors hover:bg-indigo-500"
                  style={{ height: `${height}px` }}
                  aria-label={`${d.month}: ${d.count}`}
                />
                <span className="truncate text-[10px] text-muted-foreground">
                  {formatMonthLabel(d.month)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-xs">
                  {d.month}: {d.count} saved
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function BigStat({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
}) {
  const valueEl = (
    <div className="text-3xl font-bold tracking-tight">{value}</div>
  );
  return (
    <Card>
      <CardContent className="space-y-1 px-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="cursor-help underline-offset-2 decoration-dotted hover:underline" />
                }
              >
                {valueEl}
              </TooltipTrigger>
              <TooltipContent>
                <span className="max-w-xs text-xs">{tooltip}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          valueEl
        )}
        {hint ? (
          <div className="text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function HonestyView({
  stats,
  commentary,
}: {
  stats: HonestyStats;
  commentary: string;
}) {
  const saveOnlyPct =
    stats.totalSaved === 0 ? 0 : stats.saveOnlyCount / stats.totalSaved;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reading habits — the unflattering truth
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Numbers don&apos;t lie. Refresh after major changes.
          </p>
        </div>
        <form action={refreshHonestyAction}>
          <button
            type="submit"
            className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Regenerate
          </button>
        </form>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat
          label="Total saved"
          value={stats.totalSaved.toLocaleString()}
        />
        <BigStat label="Read" value={stats.totalRead.toLocaleString()} />
        <BigStat
          label="Completion"
          value={pct(stats.completionRatio)}
          hint={`${stats.totalRead} of ${stats.totalSaved}`}
        />
        <BigStat
          label="Reading days wasted"
          value={`${stats.estReadingTimeWastedDays}d`}
          tooltip={`Estimated full days of reading sitting in your library, never finished. Computed from unread word counts at 250 wpm, 24h/day.`}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Save-and-forget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">{pct(saveOnlyPct)}</div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {stats.saveOnlyCount.toLocaleString()}
              </span>{" "}
              of {stats.totalSaved.toLocaleString()} bookmarks you saved you
              never even opened.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Oldest unread</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.oldestUnread ? (
              <Link
                href={`/read/${stats.oldestUnread.id}`}
                className="group block space-y-1"
              >
                <div className="line-clamp-2 text-sm font-semibold group-hover:text-primary">
                  {stats.oldestUnread.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{stats.oldestUnread.domain || "unknown"}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    waiting {stats.oldestUnread.daysOld} days
                  </span>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing unread. Suspiciously clean.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top domains</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No domain data yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Domain</th>
                    <th className="py-2 text-right font-medium">Saved</th>
                    <th className="py-2 text-right font-medium">Finished</th>
                    <th className="py-2 text-right font-medium">Finish %</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topDomains.map((d) => (
                    <tr key={d.domain} className="border-b last:border-0">
                      <td className="py-2 font-medium">{d.domain}</td>
                      <td className="py-2 text-right tabular-nums">
                        {d.saved}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {d.finished}
                      </td>
                      <td className="py-2 text-right">
                        <Badge
                          variant="secondary"
                          className={ratioBadgeClass(d.finishRatio)}
                        >
                          {pct(d.finishRatio)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Saved per month — last 12 months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={stats.monthlyAdded} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="bg-amber-50/60 ring-amber-200/60 dark:bg-amber-950/20 dark:ring-amber-900/40">
          <CardHeader>
            <CardTitle className="text-base">The verdict</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {commentary.split(/\n{2,}/).map((para, i) => (
              <p
                key={i}
                className="text-sm italic leading-relaxed text-foreground/90"
              >
                {para}
              </p>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
