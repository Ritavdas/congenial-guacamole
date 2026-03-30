"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="font-medium text-destructive">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message === "Unauthorized"
            ? "Please sign in to access your bookmarks."
            : "An error occurred while loading the dashboard. Please try again."}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
