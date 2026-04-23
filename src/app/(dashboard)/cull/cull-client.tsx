"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import { archiveBulkAction } from "@/lib/actions";
import type { CullCandidate } from "@/lib/cull";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Props = {
  candidates: CullCandidate[];
};

function reasonChips(c: CullCandidate): string[] {
  const chips: string[] = [];
  if (c.savedDaysAgo >= 30) chips.push("stale");
  if (c.readMinutes >= 15) chips.push("long");
  if (
    c.completionScore !== null &&
    c.completionScore !== undefined &&
    c.completionScore < 0.25
  ) {
    chips.push("low completion");
  }
  return chips;
}

export function CullClient({ candidates: initial }: Props) {
  const [candidates, setCandidates] = React.useState(initial);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setCandidates(initial);
    setSelected(new Set());
  }, [initial]);

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(candidates.map((c) => c.id)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const selectedCandidates = React.useMemo(
    () => candidates.filter((c) => selected.has(c.id)),
    [candidates, selected],
  );
  const minutesSaved = selectedCandidates.reduce(
    (sum, c) => sum + c.readMinutes,
    0,
  );

  const handleArchive = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      try {
        const { count } = await archiveBulkAction(ids);
        setCandidates((prev) => prev.filter((c) => !selected.has(c.id)));
        setSelected(new Set());
        toast.success(`Archived ${count} bookmark${count === 1 ? "" : "s"}`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to archive. Try again.");
      }
    });
  };

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
        <p className="text-base font-medium">Nothing to cull.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your queue is clean.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {candidates.length}
          </span>{" "}
          bookmark{candidates.length === 1 ? "" : "s"} to cull ·{" "}
          <span className="font-semibold text-foreground">{minutesSaved}</span>{" "}
          minute{minutesSaved === 1 ? "" : "s"} saved
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={selected.size === candidates.length}
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={selectNone}
            disabled={selected.size === 0}
          >
            Select none
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {candidates.map((c) => {
          const favicon = `https://www.google.com/s2/favicons?domain=${c.domain}&sz=64`;
          const isChecked = selected.has(c.id);
          const chips = reasonChips(c);
          return (
            <li key={c.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border bg-card/60 px-3 py-2.5 transition-colors hover:bg-accent/40",
                  isChecked
                    ? "border-primary/60 bg-accent/30"
                    : "border-border/60",
                )}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    toggleOne(c.id, Boolean(checked))
                  }
                />
                <Image
                  src={favicon}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  className="h-5 w-5 shrink-0 rounded-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/read/${c.id}`}
                      className="truncate text-sm font-medium leading-snug hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.title}
                    </Link>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="truncate">{c.domain}</span>
                    <span>·</span>
                    <span>{c.readMinutes} min</span>
                    <span>·</span>
                    <span>
                      saved {c.savedDaysAgo} day
                      {c.savedDaysAgo === 1 ? "" : "s"} ago
                    </span>
                    {c.completionScore !== null &&
                      c.completionScore !== undefined && (
                        <>
                          <span>·</span>
                          <span>
                            {Math.round(c.completionScore * 100)}% read
                          </span>
                        </>
                      )}
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-6 py-3 backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{selected.size}</span> selected ·{" "}
              <span className="text-muted-foreground">
                {minutesSaved} min saved
              </span>
            </p>
            <Button
              onClick={handleArchive}
              disabled={pending}
              variant="destructive"
            >
              {pending ? "Archiving…" : `Archive ${selected.size} selected`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
