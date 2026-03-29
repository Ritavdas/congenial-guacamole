"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <WifiOff className="h-16 w-16 text-muted-foreground" />

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
        You&apos;re offline
      </h1>

      <p className="mt-2 max-w-sm text-muted-foreground">
        You&apos;re not connected to the internet. Previously read articles may
        still be available.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
