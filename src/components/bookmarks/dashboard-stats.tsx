import { BookOpen, CheckCircle2, Clock, Tag } from "lucide-react";

interface DashboardStatsProps {
  stats: {
    total: number;
    read: number;
    unread: number;
    favorites: number;
    savedThisWeek: number;
    readingHours: number;
    tagCount: number;
  };
}

const statCards = [
  {
    key: "total" as const,
    label: "Total Saved",
    icon: BookOpen,
    color: "text-blue-500 bg-blue-500/10",
    extra: (s: DashboardStatsProps["stats"]) =>
      s.savedThisWeek > 0 ? `+${s.savedThisWeek} this week` : null,
  },
  {
    key: "read" as const,
    label: "Articles Read",
    icon: CheckCircle2,
    color: "text-violet-500 bg-violet-500/10",
    extra: (s: DashboardStatsProps["stats"]) => {
      const pct = s.total > 0 ? Math.round((s.read / s.total) * 100) : 0;
      return `${pct}% completion`;
    },
  },
  {
    key: "readingHours" as const,
    label: "Est. Reading Time",
    icon: Clock,
    color: "text-emerald-500 bg-emerald-500/10",
    format: (v: number) => `${v}h`,
    extra: () => "based on word count",
  },
  {
    key: "tagCount" as const,
    label: "Tags Used",
    icon: Tag,
    color: "text-amber-500 bg-amber-500/10",
    extra: () => null,
  },
];

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map(({ key, label, icon: Icon, color, format, extra }) => {
        const value = stats[key];
        const extraText = extra(stats);
        return (
          <div
            key={key}
            className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {format ? format(value) : value}
            </div>
            <div className="text-sm text-muted-foreground">{label}</div>
            {extraText && (
              <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                {extraText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
