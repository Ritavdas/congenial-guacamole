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
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

export function PocketImport() {
  const [file, setFile] = useState<File | null>(null);
  const [alreadyReadFile, setAlreadyReadFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const arInputRef = useRef<HTMLInputElement>(null);

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
    setResult(null);
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

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);
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

      setResult(data as ImportResult);
      toast.success(`Imported ${data.imported} articles`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

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
          disabled={!file || importing}
          className="w-full"
        >
          {importing ? "Importing…" : "Import"}
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
                ✅ {result.imported} article{result.imported !== 1 && "s"}{" "}
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
