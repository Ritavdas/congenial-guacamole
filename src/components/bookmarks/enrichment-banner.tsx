"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Phase = "idle" | "enriching" | "done";

export function EnrichmentBanner() {
  const [unenriched, setUnenriched] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/enrich/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.unenriched > 0) setUnenriched(data.unenriched);
      })
      .catch(() => {});
  }, []);

  const startEnrichment = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("enriching");
    setProgress({ current: 0, total: unenriched });

    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        toast.error("Failed to start enrichment");
        setPhase("idle");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;

          try {
            const event = JSON.parse(match[1]);
            if (event.type === "start") {
              setProgress({ current: 0, total: event.total });
            } else if (event.type === "progress") {
              setProgress({ current: event.index, total: event.total });
            } else if (event.type === "complete") {
              toast.success(
                `Enriched ${event.enriched} bookmark${event.enriched !== 1 ? "s" : ""}` +
                  (event.failed > 0 ? ` (${event.failed} failed)` : ""),
              );
              setPhase("done");
            }
          } catch {
            // skip malformed events
          }
        }
      }

      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        toast("Enrichment cancelled");
      } else {
        toast.error("Enrichment failed");
      }
      setPhase("idle");
    } finally {
      abortRef.current = null;
    }
  }, [unenriched]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (unenriched === 0 || dismissed || phase === "done") return null;

  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="relative rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-md p-1 text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      {phase === "idle" && (
        <div className="flex items-center gap-3 pr-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            🔗 {unenriched} bookmark{unenriched !== 1 ? "s are" : " is"} missing
            previews
          </p>
          <Button size="sm" variant="outline" onClick={startEnrichment}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Fetch Previews
          </Button>
        </div>
      )}

      {phase === "enriching" && (
        <div className="space-y-2 pr-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enriching: {progress.current}/{progress.total}…
            </p>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
