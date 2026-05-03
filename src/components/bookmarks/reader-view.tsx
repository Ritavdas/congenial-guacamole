"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Bookmark, Highlight } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Star,
  Archive,
  ExternalLink,
  Sparkles,
  Loader2,
  Clock,
  Share2,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import Link from "next/link";
import { toggleBookmarkFavorite, toggleBookmarkArchive } from "@/lib/actions";
import { toast } from "sonner";

import { ArticleContent } from "@/components/reader/article-content";
import { ReadingProgressBar } from "@/components/reader/reading-progress";
import { YouTubeTranscript } from "@/components/reader/youtube-transcript";
import { extractYouTubeId, isYouTubeUrl } from "@/lib/extract-youtube";
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
import {
  useDictionaryLookup,
  DictionaryPopup,
} from "@/components/reader/dictionary-popup";
import { TextToSpeech } from "@/components/reader/text-to-speech";
import { TagSelector } from "@/components/bookmarks/tag-selector";

interface ReaderViewProps {
  bookmark: Bookmark;
  highlights: Highlight[];
  tags: { id: string; name: string; color: string }[];
}

function estimateReadingTime(
  wordCount: number | null,
  text: string | null,
): number {
  const words = wordCount ?? (text ? text.trim().split(/\s+/).length : 0);
  return Math.max(1, Math.ceil(words / 200));
}

export function ReaderView({ bookmark, highlights, tags }: ReaderViewProps) {
  const [summary, setSummary] = useState(bookmark.summary);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
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

  const {
    lookup,
    dismiss: dismissLookup,
    fetchContext,
  } = useDictionaryLookup(articleRef);

  const readingTime = estimateReadingTime(bookmark.wordCount, bookmark.content);
  const hasHtmlContent = !!bookmark.htmlContent;
  const wordCount =
    bookmark.wordCount ??
    (bookmark.content ? bookmark.content.trim().split(/\s+/).length : 0);

  // YouTube embed: render the player above the content (which may be the
  // transcript) — or as the entire body when transcript extraction failed.
  const youtubeId = isYouTubeUrl(bookmark.url)
    ? extractYouTubeId(bookmark.url)
    : null;

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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy");
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

      {/* ─── ENHANCED TOP BAR ─── */}
      <div
        className="sticky top-[3px] z-40 border-b backdrop-blur-xl"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--reader-bg, var(--background)) 85%, transparent)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <div className="hidden min-w-0 flex-1 text-center md:block">
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--reader-muted, var(--muted-foreground))" }}
            >
              {bookmark.title ?? "Untitled"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <ReaderToolbar settings={settings} onUpdate={updateSettings} />
            <TagSelector bookmarkId={bookmark.id} currentTags={tags} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleBookmarkFavorite(bookmark.id)}
              title="Favorite"
            >
              <Star
                className={`h-4 w-4 ${bookmark.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleBookmarkArchive(bookmark.id)}
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              title="Copy link"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" title="Open original">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
            {currentHighlights.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanelOpen(!panelOpen)}
                title={panelOpen ? "Close panel" : "Open highlights"}
              >
                {panelOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* ─── ARTICLE CONTENT ─── */}
        <div className={`flex-1 transition-all ${panelOpen ? "mr-80" : ""}`}>
          <div className="mx-auto max-w-3xl px-4 py-8">
            <article>
              {/* Article header */}
              <header className="mb-8">
                <div className="mb-4">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor:
                        "var(--reader-bg, hsl(var(--primary) / 0.08))",
                      color: "var(--reader-fg, hsl(var(--primary)))",
                      border:
                        "1px solid color-mix(in srgb, var(--reader-fg, hsl(var(--primary))) 20%, transparent)",
                    }}
                  >
                    🔗 {bookmark.domain}
                  </span>
                </div>

                <h1
                  className="mb-4 font-bold leading-tight tracking-tight"
                  style={{ fontSize: `${settings.fontSize * 1.75}px` }}
                >
                  {bookmark.title ?? "Untitled"}
                </h1>

                <div
                  className="flex flex-wrap items-center gap-3 text-sm"
                  style={{
                    color: "var(--reader-muted, var(--muted-foreground))",
                  }}
                >
                  <span className="font-medium">{bookmark.domain}</span>
                  <span>·</span>
                  <span>
                    {new Date(bookmark.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {readingTime} min read
                  </span>
                  {wordCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{wordCount.toLocaleString()} words</span>
                    </>
                  )}
                </div>
              </header>

              {youtubeId ? (
                <div className="relative mb-8 w-full overflow-hidden rounded-xl bg-black">
                  <div style={{ paddingTop: "56.25%" }} />
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                    title={bookmark.title ?? "YouTube video"}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                bookmark.ogImage && (
                  <div
                    className="relative mb-8 w-full overflow-hidden rounded-xl"
                    style={{ maxHeight: "400px", minHeight: "200px" }}
                  >
                    <Image
                      src={bookmark.ogImage}
                      alt={bookmark.title ?? ""}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )
              )}

              {/* ─── AI SUMMARY CARD ─── */}
              <div className="mb-8">
                <div
                  className="overflow-hidden rounded-xl border"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.03))",
                    borderColor: "hsl(var(--primary) / 0.15)",
                  }}
                >
                  <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        <Sparkles className="h-3 w-3" />
                        AI
                      </span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        Summary
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!summary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSummarize}
                          disabled={summarizing}
                          className="h-7 text-xs"
                        >
                          {summarizing ? (
                            <>
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                              Summarizing...
                            </>
                          ) : (
                            "Generate"
                          )}
                        </Button>
                      )}
                      {summary && (
                        <button
                          onClick={() => setSummaryCollapsed(!summaryCollapsed)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: "hsl(var(--primary))" }}
                        >
                          {summaryCollapsed ? "Expand ↓" : "Collapse ↑"}
                        </button>
                      )}
                    </div>
                  </div>
                  {!summaryCollapsed && (
                    <div className="px-5 pb-4">
                      {summary ? (
                        <p className="text-sm leading-relaxed">{summary}</p>
                      ) : (
                        <p
                          className="text-sm"
                          style={{
                            color:
                              "var(--reader-muted, var(--muted-foreground))",
                          }}
                        >
                          Click &ldquo;Generate&rdquo; to get an AI-powered
                          summary of this article.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── TTS (inline, compact) ─── */}
              {(bookmark.content || bookmark.htmlContent) && (
                <div className="mb-8 rounded-lg border bg-muted/30 px-4 py-3">
                  <TextToSpeech text={bookmark.content ?? ""} />
                </div>
              )}

              {/* ─── ARTICLE BODY ─── */}
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
                    <p
                      style={{
                        color: "var(--reader-muted, var(--muted-foreground))",
                      }}
                    >
                      {youtubeId
                        ? "No transcript was available for this video. Watch it above or open the original page."
                        : "No readable content could be extracted from this page."}
                    </p>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="link" className="mt-2">
                        View original page{" "}
                        <ExternalLink className="ml-2 h-3 w-3" />
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

            {/* Dictionary popup (appears on double-click) */}
            {lookup && (
              <DictionaryPopup
                lookup={lookup}
                onDismiss={dismissLookup}
                onFetchContext={fetchContext}
              />
            )}

            {/* Inline highlights list (shown when panel is closed) */}
            {currentHighlights.length > 0 && !panelOpen && (
              <div className="mt-12">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Highlights ({currentHighlights.length})
                  </h3>
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open panel →
                  </button>
                </div>
                <div className="space-y-3">
                  {currentHighlights.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border-l-4 bg-muted/30 p-3"
                      style={{ borderColor: h.color }}
                    >
                      <p className="text-sm italic">&ldquo;{h.text}&rdquo;</p>
                      {h.note && (
                        <p
                          className="mt-1 text-xs"
                          style={{
                            color:
                              "var(--reader-muted, var(--muted-foreground))",
                          }}
                        >
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

        {/* ─── HIGHLIGHTS SIDE PANEL ─── */}
        {panelOpen && (
          <aside className="fixed right-0 top-[60px] bottom-0 w-80 overflow-y-auto border-l bg-card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Highlights ({currentHighlights.length})
              </h3>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            {currentHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select text in the article to create highlights.
              </p>
            ) : (
              <div className="space-y-3">
                {currentHighlights.map((h) => (
                  <div
                    key={h.id}
                    className="cursor-pointer rounded-lg p-3 transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: h.color + "20" }}
                  >
                    <p className="text-sm leading-relaxed">
                      &ldquo;{h.text}&rdquo;
                    </p>
                    {h.note && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        📝 {h.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
