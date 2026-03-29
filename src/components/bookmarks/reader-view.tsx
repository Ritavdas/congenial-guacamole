"use client";

import { useState, useRef } from "react";
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
  Clock,
} from "lucide-react";
import Link from "next/link";
import {
  toggleBookmarkFavorite,
  toggleBookmarkArchive,
} from "@/lib/actions";
import { toast } from "sonner";

import { ArticleContent } from "@/components/reader/article-content";
import { ReadingProgressBar } from "@/components/reader/reading-progress";
import {
  useReaderSettings,
  ReaderToolbar,
} from "@/components/reader/reader-settings";
import {
  useSaveReadingPosition,
  useRestoreReadingPosition,
} from "@/components/reader/reading-position";
import {
  useHighlighting,
  HighlightToolbar,
} from "@/components/reader/highlighting";
import { TextToSpeech } from "@/components/reader/text-to-speech";

interface ReaderViewProps {
  bookmark: Bookmark;
  highlights: Highlight[];
}

function estimateReadingTime(wordCount: number | null, text: string | null): number {
  const words = wordCount ?? (text ? text.trim().split(/\s+/).length : 0);
  return Math.max(1, Math.ceil(words / 200));
}

export function ReaderView({ bookmark, highlights }: ReaderViewProps) {
  const [summary, setSummary] = useState(bookmark.summary);
  const [summarizing, setSummarizing] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);

  const { settings, updateSettings, cssVars, loaded } = useReaderSettings();
  useSaveReadingPosition(bookmark.id);
  useRestoreReadingPosition(bookmark.id);

  const {
    pending,
    highlights: currentHighlights,
    createHighlight,
    dismiss,
    handleMouseUp,
  } = useHighlighting(articleRef, bookmark.id, highlights);

  const readingTime = estimateReadingTime(bookmark.wordCount, bookmark.content);
  const hasHtmlContent = !!bookmark.htmlContent;

  async function handleSummarize() {
    if (!bookmark.content && !bookmark.htmlContent) {
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
          content: (bookmark.content ?? "").slice(0, 8000),
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

  const readerThemeClass =
    settings.theme === "dark"
      ? "dark"
      : settings.theme === "sepia"
        ? "sepia-theme"
        : "";

  if (!loaded) return null;

  return (
    <div
      className={`min-h-screen transition-colors ${readerThemeClass}`}
      style={cssVars}
    >
      <ReadingProgressBar />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Top navigation bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            <ReaderToolbar settings={settings} onUpdate={updateSettings} />
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

        <article>
          {/* Article header */}
          <header className="mb-8">
            <h1
              className="mb-4 font-bold leading-tight tracking-tight"
              style={{ fontSize: `${settings.fontSize * 1.75}px` }}
            >
              {bookmark.title ?? "Untitled"}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--reader-muted, var(--muted-foreground))" }}>
              <span className="font-medium">{bookmark.domain}</span>
              <span>·</span>
              <span>{new Date(bookmark.createdAt).toLocaleDateString()}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {readingTime} min read
              </span>
            </div>
          </header>

          {bookmark.ogImage && (
            <img
              src={bookmark.ogImage}
              alt={bookmark.title ?? ""}
              className="mb-8 w-full rounded-xl object-cover"
              style={{ maxHeight: "400px" }}
            />
          )}

          {/* TTS + AI Summary row */}
          <div className="mb-8 space-y-4">
            {/* Text-to-speech */}
            {(bookmark.content || bookmark.htmlContent) && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <TextToSpeech text={bookmark.content ?? ""} />
              </div>
            )}

            {/* AI Summary Section */}
            <div className="rounded-lg border bg-muted/30 p-4">
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
                <p className="text-sm" style={{ color: "var(--reader-muted, var(--muted-foreground))" }}>
                  Click &ldquo;Generate Summary&rdquo; to get an AI-powered summary of this article.
                </p>
              )}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Article Content */}
          <div
            ref={articleRef}
            onMouseUp={handleMouseUp}
            style={{
              fontSize: `${settings.fontSize}px`,
              fontFamily: `var(--reader-font-family)`,
              lineHeight: `var(--reader-line-height)`,
            }}
          >
            {hasHtmlContent ? (
              <ArticleContent htmlContent={bookmark.htmlContent!} />
            ) : bookmark.content ? (
              <div className="whitespace-pre-wrap leading-relaxed">
                {bookmark.content}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p style={{ color: "var(--reader-muted, var(--muted-foreground))" }}>
                  No readable content could be extracted from this page.
                </p>
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="link" className="mt-2">
                    View original page <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </a>
              </div>
            )}
          </div>
        </article>

        {/* Highlight toolbar (appears on text selection) */}
        {pending && (
          <HighlightToolbar
            pending={pending}
            onHighlight={createHighlight}
            onDismiss={dismiss}
          />
        )}

        {/* Highlights list */}
        {currentHighlights.length > 0 && (
          <div className="mt-12">
            <Separator />
            <h3 className="mb-4 mt-6 text-lg font-semibold">
              Highlights ({currentHighlights.length})
            </h3>
            <div className="space-y-3">
              {currentHighlights.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border-l-4 bg-muted/30 p-3"
                  style={{ borderColor: h.color }}
                >
                  <p className="text-sm italic">&ldquo;{h.text}&rdquo;</p>
                  {h.note && (
                    <p className="mt-1 text-xs" style={{ color: "var(--reader-muted, var(--muted-foreground))" }}>
                      {h.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
