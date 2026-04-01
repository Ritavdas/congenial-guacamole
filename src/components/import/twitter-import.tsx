"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

export function TwitterImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".js") && !name.endsWith(".json")) {
      toast.error("Please upload a .js or .json file");
      return;
    }
    setFile(f);
    setResult(null);
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

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/twitter", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }

      setResult(data as ImportResult);
      toast.success(`Imported ${data.imported} tweets`);
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

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
        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="w-full"
        >
          {importing ? "Importing… (this may take a while)" : "Import"}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-2 rounded-md border p-4 text-sm">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
