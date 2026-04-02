"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
  importedIds: string[];
}

interface EnrichResult {
  enriched: number;
  failed: number;
  total: number;
}

type Phase = "idle" | "importing" | "enriching" | "done";

export function PocketImport() {
  const [file, setFile] = useState<File | null>(null);
  const [alreadyReadFile, setAlreadyReadFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [enrichProgress, setEnrichProgress] = useState({
    current: 0,
    total: 0,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const arInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (
      !name.endsWith(".csv") &&
      !name.endsWith(".html") &&
      !name.endsWith(".htm")
    ) {
      toast.error("Please upload a CSV or HTML file");
      return;
    }
    setFile(f);
    setImportResult(null);
    setEnrichResult(null);
    setPhase("idle");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const startEnrichment = async (bookmarkIds: string[]) => {
    if (bookmarkIds.length === 0) {
      setPhase("done");
      return;
    }

    setPhase("enriching");
    setEnrichProgress({ current: 0, total: bookmarkIds.length });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Enrichment request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        // Keep the last (possibly incomplete) chunk in the buffer
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine.slice(6));

            if (data.type === "start") {
              setEnrichProgress({ current: 0, total: data.total });
            } else if (data.type === "progress") {
              setEnrichProgress((prev) => ({
                ...prev,
                current: prev.current + 1,
              }));
            } else if (data.type === "complete") {
              setEnrichResult({
                enriched: data.enriched,
                failed: data.failed,
                total: data.total,
              });
              setPhase("done");
            }
          } catch {
            // skip malformed events
          }
        }
      }

      // If stream ended without a complete event, mark done anyway
      if (phase !== "done") {
        setPhase("done");
      }
    } catch (err) {
      if (controller.signal.aborted) {
        toast.info("Enrichment cancelled");
      } else {
        toast.error(err instanceof Error ? err.message : "Enrichment failed");
      }
      setPhase("done");
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleImport = async () => {
    if (!file) return;

    setPhase("importing");
    setImportResult(null);
    setEnrichResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (alreadyReadFile) {
        formData.append("alreadyRead", alreadyReadFile);
      }

      const res = await fetch("/api/import/pocket", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      const result = data as ImportResult;
      setImportResult(result);
      toast.success(`Imported ${result.imported} articles`);

      // Auto-trigger enrichment for imported bookmarks
      await startEnrichment(result.importedIds);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setPhase("idle");
    }
  };

  const enrichPercent =
    enrichProgress.total > 0
      ? Math.round((enrichProgress.current / enrichProgress.total) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Pocket Import
        </CardTitle>
        <CardDescription>
          Upload your Pocket export file (CSV or HTML) to import all your saved
          articles with tags and timestamps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main file upload */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          {file ? (
            <p className="text-sm font-medium">{file.name}</p>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Drop your Pocket export file here
              </p>
              <p className="text-xs text-muted-foreground">
                Accepts .csv (part_000000.csv) or .html (rl_export.html)
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.html,.htm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {/* Optional already-read.json */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => arInputRef.current?.click()}
          >
            {alreadyReadFile
              ? alreadyReadFile.name
              : "Add already-read.json (optional)"}
          </Button>
          {alreadyReadFile && (
            <button
              onClick={() => setAlreadyReadFile(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
          <input
            ref={arInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAlreadyReadFile(f);
            }}
          />
        </div>

        <Button
          onClick={handleImport}
          disabled={!file || phase === "importing" || phase === "enriching"}
          className="w-full"
        >
          {phase === "importing" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            "Import"
          )}
        </Button>

        {/* Enrichment progress */}
        {phase === "enriching" && (
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching previews: {enrichProgress.current}/
                {enrichProgress.total}…
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-6 px-2"
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
            <Progress value={enrichPercent} className="h-2" />
          </div>
        )}

        {/* Results (shown once done) */}
        {phase === "done" && importResult && (
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Import complete
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                ✅ {importResult.imported} article
                {importResult.imported !== 1 && "s"} imported
              </li>
              {importResult.skipped > 0 && (
                <li>⏭️ {importResult.skipped} skipped (duplicates)</li>
              )}
              {importResult.errors > 0 && (
                <li className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {importResult.errors} error
                  {importResult.errors !== 1 && "s"}
                </li>
              )}
            </ul>

            {enrichResult && (
              <div className="mt-2 border-t pt-2">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Enrichment complete
                </div>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  <li>
                    ✅ Enriched {enrichResult.enriched} bookmark
                    {enrichResult.enriched !== 1 && "s"}
                  </li>
                  {enrichResult.failed > 0 && (
                    <li className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      {enrichResult.failed} failed
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
