"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import type { TwitterSyncStatus } from "@/db/schema";

export function TwitterSyncStatusBanner() {
  const [status, setStatus] = useState<TwitterSyncStatus | null | undefined>(
    undefined,
  );

  useEffect(() => {
    fetch("/api/twitter-sync-status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // Nothing to show until loaded, or if sync has never run
  if (status === undefined || status === null) return null;

  const ranAt = new Date(status.ranAt).toLocaleString();

  if (status.status === "ok") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        <div className="text-green-800 dark:text-green-200">
          <span className="font-medium">Auto-sync OK</span> — last run {ranAt}:{" "}
          {status.imported} imported, {status.skipped} skipped.
        </div>
      </div>
    );
  }

  if (status.status === "auth_expired") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-amber-800 dark:text-amber-200">
          <span className="font-medium">X auto-sync paused</span> — cookies
          expired ({ranAt}). Re-copy your{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900">
            auth_token
          </code>{" "}
          and{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900">
            ct0
          </code>{" "}
          cookies from x.com into{" "}
          <span className="font-medium">
            Vercel → Settings → Environment Variables
          </span>{" "}
          and redeploy.
        </div>
      </div>
    );
  }

  // status === "error"
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      <div className="text-red-800 dark:text-red-200">
        <span className="font-medium">X auto-sync failed</span> ({ranAt})
        {status.errorMessage ? `: ${status.errorMessage}` : "."}
        <span className="ml-1">Check Vercel function logs.</span>
      </div>
    </div>
  );
}

export function TwitterSyncStatusBannerSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Checking sync status…
    </div>
  );
}
