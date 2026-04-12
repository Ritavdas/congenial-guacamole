"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { fetchDefinition, type DictionaryResult } from "@/lib/dictionary";
import {
  normalizeSelectedWord,
  extractSentenceAround,
  shouldIgnoreTarget,
  clampPopupPosition,
} from "@/lib/dictionary-utils";
import { Book, Volume2, Loader2, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface DictionaryState {
  word: string;
  position: { top: number; left: number };
  result: DictionaryResult | null;
  loading: boolean;
  error: string | null;
  contextExplanation: string | null;
  contextLoading: boolean;
  sentence: string;
}

export function useDictionaryLookup(
  articleRef: React.RefObject<HTMLDivElement | null>,
) {
  const [state, setState] = useState<DictionaryState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    abortRef.current?.abort();
    setState(null);
  }, []);

  const fetchContext = useCallback(async () => {
    if (!state) return;

    setState((prev) => (prev ? { ...prev, contextLoading: true } : prev));

    try {
      const res = await fetch("/api/define-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: state.word,
          sentence: state.sentence,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();
      setState((prev) =>
        prev
          ? {
              ...prev,
              contextExplanation: data.explanation,
              contextLoading: false,
            }
          : prev,
      );
    } catch {
      setState((prev) => (prev ? { ...prev, contextLoading: false } : prev));
    }
  }, [state]);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;

    function handleDblClick(e: MouseEvent) {
      const target = e.target as Element;
      if (shouldIgnoreTarget(target)) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const raw = selection.toString();
      const word = normalizeSelectedWord(raw);
      if (!word) return;

      const container = articleRef.current;
      if (!container) return;

      // Get position for popup
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const popupW = 320;
      const popupH = 250;
      const pos = clampPopupPosition(
        rect,
        window.innerWidth,
        window.innerHeight,
        popupW,
        popupH,
      );

      // Extract sentence for AI context
      const articleText = container.textContent ?? "";
      // Find approximate position of the word in text
      const textBefore =
        range.startContainer.textContent?.slice(0, range.startOffset) ?? "";
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
          offset += textBefore.length;
          break;
        }
        offset += node.textContent?.length ?? 0;
      }
      const sentence = extractSentenceAround(articleText, word, offset);

      // Cancel previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Set loading state immediately
      setState({
        word,
        position: pos,
        result: null,
        loading: true,
        error: null,
        contextExplanation: null,
        contextLoading: false,
        sentence,
      });

      // Fetch definition
      fetchDefinition(word, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setState((prev) =>
            prev?.word === word
              ? {
                  ...prev,
                  result,
                  loading: false,
                  error: result ? null : "No definition found",
                }
              : prev,
          );
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setState((prev) =>
            prev?.word === word
              ? { ...prev, loading: false, error: "Failed to look up word" }
              : prev,
          );
        });
    }

    el.addEventListener("dblclick", handleDblClick);
    return () => el.removeEventListener("dblclick", handleDblClick);
  }, [articleRef]);

  return { lookup: state, dismiss, fetchContext };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DictionaryPopupProps {
  lookup: DictionaryState;
  onDismiss: () => void;
  onFetchContext: () => void;
}

export function DictionaryPopup({
  lookup,
  onDismiss,
  onFetchContext,
}: DictionaryPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dismiss on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    // Delay to avoid the dblclick itself triggering dismiss
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onDismiss]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  function playAudio() {
    if (lookup.result?.audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(lookup.result.audioUrl);
      }
      audioRef.current.play().catch(() => {});
    }
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-[60] w-80 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl shadow-black/10 backdrop-blur-sm"
      style={{
        top: `${lookup.position.top}px`,
        left: `${lookup.position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-2.5">
        <Book className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          {lookup.word}
        </span>
        {lookup.result?.phonetic && (
          <span className="text-xs text-muted-foreground">
            {lookup.result.phonetic}
          </span>
        )}
        {lookup.result?.audioUrl && (
          <button
            onClick={playAudio}
            className="ml-auto rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Play pronunciation"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="max-h-60 overflow-y-auto px-4 py-3">
        {lookup.loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {lookup.error && !lookup.loading && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {lookup.error}
          </p>
        )}

        {lookup.result && !lookup.loading && (
          <div className="space-y-3">
            {lookup.result.meanings.slice(0, 3).map((meaning, i) => (
              <div key={i}>
                <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {meaning.partOfSpeech}
                </span>
                <ol className="mt-1 space-y-1.5">
                  {meaning.definitions.slice(0, 2).map((def, j) => (
                    <li
                      key={j}
                      className="text-sm leading-relaxed text-foreground"
                    >
                      <span className="mr-1.5 text-xs text-muted-foreground">
                        {j + 1}.
                      </span>
                      {def.definition}
                      {def.example && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">
                          &ldquo;{def.example}&rdquo;
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* AI Context Section */}
        {lookup.result && !lookup.loading && (
          <div className="mt-3 border-t border-border/40 pt-3">
            {lookup.contextExplanation ? (
              <div className="rounded-lg bg-primary/5 p-2.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    In this article
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {lookup.contextExplanation}
                </p>
              </div>
            ) : (
              <button
                onClick={onFetchContext}
                disabled={lookup.contextLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                {lookup.contextLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    How is it used here?
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
