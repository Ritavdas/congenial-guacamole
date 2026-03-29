"use client";

import { useState } from "react";
import { Bookmark, Highlight } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Star,
  Archive,
  ExternalLink,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  toggleBookmarkFavorite,
  toggleBookmarkArchive,
  updateBookmarkSummary,
} from "@/lib/actions";
import { toast } from "sonner";

interface ReaderViewProps {
  bookmark: Bookmark;
  highlights: Highlight[];
}

export function ReaderView({ bookmark, highlights }: ReaderViewProps) {
  const [summary, setSummary] = useState(bookmark.summary);
  const [summarizing, setSummarizing] = useState(false);

  async function handleSummarize() {
    if (!bookmark.content) {
      toast.error("No article content available to summarize");
      return;
    }

    setSummarizing(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarkId: bookmark.id,
          content: bookmark.content.slice(0, 8000),
          title: bookmark.title,
        }),
      });

      if (!response.ok) throw new Error("Failed to summarize");

      const data = await response.json();
      setSummary(data.summary);
      toast.success("Summary generated!");
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleBookmarkFavorite(bookmark.id)}
          >
            <Star
              className={`h-4 w-4 ${bookmark.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleBookmarkArchive(bookmark.id)}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold leading-tight">
          {bookmark.title ?? "Untitled"}
        </h1>

        <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{bookmark.domain}</span>
          <span>·</span>
          <span>{new Date(bookmark.createdAt).toLocaleDateString()}</span>
        </div>

        {bookmark.ogImage && (
          <img
            src={bookmark.ogImage}
            alt={bookmark.title ?? ""}
            className="mb-6 w-full rounded-lg object-cover"
          />
        )}

        {/* AI Summary Section */}
        <div className="mb-8 rounded-lg border bg-muted/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-purple-500" />
              AI Summary
            </h3>
            {!summary && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSummarize}
                disabled={summarizing}
              >
                {summarizing ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  "Generate Summary"
                )}
              </Button>
            )}
          </div>
          {summary ? (
            <p className="text-sm leading-relaxed">{summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Generate Summary&rdquo; to get an AI-powered summary of this article.
            </p>
          )}
        </div>

        <Separator className="my-6" />

        {/* Article Content */}
        {bookmark.content ? (
          <div className="whitespace-pre-wrap leading-relaxed">
            {bookmark.content}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              No readable content could be extracted from this page.
            </p>
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              <Button variant="link" className="mt-2">
                View original page <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </a>
          </div>
        )}
      </article>

      {/* Highlights sidebar */}
      {highlights.length > 0 && (
        <div className="mt-8">
          <Separator />
          <h3 className="mb-4 mt-6 text-lg font-semibold">
            Highlights ({highlights.length})
          </h3>
          <div className="space-y-3">
            {highlights.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border-l-4 bg-muted/50 p-3"
                style={{ borderColor: h.color }}
              >
                <p className="text-sm italic">&ldquo;{h.text}&rdquo;</p>
                {h.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
