"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseTwitterArchiveBookmarks } from "@/lib/import-twitter";

const CHUNK_SIZE = 100;

interface ImportTotals {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

type Phase = "idle" | "parsing" | "importing" | "done";

export function TwitterImport() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportTotals | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".js") && !name.endsWith(".json")) {
      toast.error("Please upload a .js or .json file");
      return;
    }
    setFile(f);
    setResult(null);
    setPhase("idle");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleImport = async () => {
    if (!file) return;

    cancelledRef.current = false;
    setPhase("parsing");
    setResult(null);

    const content = await file.text();
    const tweets = parseTwitterArchiveBookmarks(content);

    if (tweets.length === 0) {
      toast.error(
        "No bookmarks found. Make sure this is the bookmarks.js file from your X data archive.",
      );
      setPhase("idle");
      return;
    }

    // Split into chunks
    const chunks: (typeof tweets)[] = [];
    for (let i = 0; i < tweets.length; i += CHUNK_SIZE) {
      chunks.push(tweets.slice(i, i + CHUNK_SIZE));
    }

    setPhase("importing");
    setProgress({ current: 0, total: tweets.length });

    const totals: ImportTotals = {
      imported: 0,
      skipped: 0,
      errors: 0,
      total: tweets.length,
    };

    for (const chunk of chunks) {
      if (cancelledRef.current) break;

      try {
        const res = await fetch("/api/import/twitter/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookmarks: chunk.map((t) => ({
              url: t.url,
              tweetId: t.tweetId,
              timestamp: t.timestamp.toISOString(),
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          totals.imported += data.imported;
          totals.skipped += data.skipped;
          totals.errors += data.errors;
        } else {
          totals.errors += chunk.length;
        }
      } catch {
        totals.errors += chunk.length;
      }

      setProgress((prev) => ({
        ...prev,
        current: Math.min(prev.current + chunk.length, prev.total),
      }));
    }

    setResult(totals);
    setPhase("done");

    if (cancelledRef.current) {
      toast("Import cancelled — already-imported tweets are saved.");
    } else {
      toast.success(`Imported ${totals.imported} tweets`);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
  };

  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />X (Twitter) Bookmarks
        </CardTitle>
        <CardDescription>
          Import your bookmarked tweets from an X data archive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <p>
            Download your X data archive from{" "}
            <strong>
              Settings → Your Account → Download an archive of your data
            </strong>
            . Upload the{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              bookmarks.js
            </code>{" "}
            file from the{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              data/
            </code>{" "}
            folder.
          </p>
        </div>

        {/* Drop zone */}
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
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          {file ? (
            <p className="text-sm font-medium">{file.name}</p>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Drop your bookmarks.js file here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".js,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {/* Import button */}
        {phase !== "importing" && phase !== "parsing" && (
          <Button onClick={handleImport} disabled={!file} className="w-full">
            Import
          </Button>
        )}

        {/* Progress */}
        {(phase === "parsing" || phase === "importing") && (
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === "parsing"
                  ? "Parsing file…"
                  : `Importing: ${progress.current}/${progress.total}…`}
              </p>
              {phase === "importing" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-6 px-2"
                >
                  Cancel
                </Button>
              )}
            </div>
            {phase === "importing" && <Progress value={pct} className="h-2" />}
          </div>
        )}

        {/* Results */}
        {phase === "done" && result && (
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Import complete
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                ✅ {result.imported} tweet{result.imported !== 1 && "s"}{" "}
                imported
              </li>
              {result.skipped > 0 && (
                <li>⏭️ {result.skipped} skipped (duplicates)</li>
              )}
              {result.errors > 0 && (
                <li className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {result.errors} error{result.errors !== 1 && "s"}
                </li>
              )}
            </ul>
            {result.imported > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                <Sparkles className="h-4 w-4 shrink-0" />
                <p className="text-xs">
                  Imported tweets have placeholder titles. Head to your
                  bookmarks and click <strong>Fetch Previews</strong> to enrich
                  them with full metadata.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
