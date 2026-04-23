"use client";

/**
 * Reader telemetry: fires bookmark events from the /read/[id] page.
 *
 * Events:
 *  - opened           — once per visit, on mount
 *  - scroll_25/50/75/100 — once per visit, when sentinel divs appear
 *  - finished_inferred — once per visit, when (scroll_100 fired AND dwell ≥ 30s)
 *
 * "Per visit" is enforced via a sessionStorage key — protects against
 * the reader's own scroll-position restoration triggering milestones on remount.
 *
 * Transport: navigator.sendBeacon so events survive tab close.
 * Falls back to fetch() with keepalive if sendBeacon is unavailable.
 *
 * The DB layer enforces dedup of finished_inferred via a partial unique index.
 */

import { useEffect, useRef } from "react";

type TelemetryKind =
  | "opened"
  | "scroll_25"
  | "scroll_50"
  | "scroll_75"
  | "scroll_100"
  | "finished_inferred";

const FINISHED_DWELL_MS = 30_000;
const ENDPOINT = "/api/bookmark-events";

function visitKey(bookmarkId: string, kind: TelemetryKind): string {
  return `bm-evt:${bookmarkId}:${kind}`;
}

function sendEvent(bookmarkId: string, kind: TelemetryKind): void {
  try {
    if (sessionStorage.getItem(visitKey(bookmarkId, kind)) === "1") return;
    sessionStorage.setItem(visitKey(bookmarkId, kind), "1");
  } catch {
    // sessionStorage may be unavailable in private browsing; still send.
  }

  const body = JSON.stringify({ bookmarkId, kind });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    const blob = new Blob([body], { type: "application/json" });
    const ok = navigator.sendBeacon(ENDPOINT, blob);
    if (ok) return;
  }

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function ReaderTelemetry({ bookmarkId }: { bookmarkId: string }) {
  const mountedAtRef = useRef<number>(0);
  const reachedBottomRef = useRef<boolean>(false);

  useEffect(() => {
    mountedAtRef.current = Date.now();
    sendEvent(bookmarkId, "opened");

    const sentinels: Array<{
      pct: number;
      el: HTMLDivElement;
      kind: TelemetryKind;
    }> = [
      { pct: 0.25, el: document.createElement("div"), kind: "scroll_25" },
      { pct: 0.5, el: document.createElement("div"), kind: "scroll_50" },
      { pct: 0.75, el: document.createElement("div"), kind: "scroll_75" },
      { pct: 1.0, el: document.createElement("div"), kind: "scroll_100" },
    ];

    const place = () => {
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      for (const s of sentinels) {
        s.el.style.position = "absolute";
        s.el.style.left = "0";
        s.el.style.width = "1px";
        s.el.style.height = "1px";
        s.el.style.pointerEvents = "none";
        s.el.style.top = `${Math.max(0, Math.floor(docHeight * s.pct) - 1)}px`;
        s.el.setAttribute("aria-hidden", "true");
        s.el.dataset.readerSentinel = s.kind;
        if (!s.el.isConnected) document.body.appendChild(s.el);
      }
    };

    place();

    const maybeFinished = () => {
      if (!reachedBottomRef.current) return;
      const dwell = Date.now() - mountedAtRef.current;
      if (dwell >= FINISHED_DWELL_MS) {
        sendEvent(bookmarkId, "finished_inferred");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const kind = (entry.target as HTMLElement).dataset.readerSentinel as
            | TelemetryKind
            | undefined;
          if (!kind) continue;
          sendEvent(bookmarkId, kind);
          if (kind === "scroll_100") {
            reachedBottomRef.current = true;
            maybeFinished();
          }
        }
      },
      { threshold: 0.01 },
    );

    for (const s of sentinels) observer.observe(s.el);

    // Reposition on resize / late content load.
    const onResize = () => place();
    window.addEventListener("resize", onResize);

    // If user dwells past the threshold after already reaching bottom, fire then.
    const dwellTimer = window.setTimeout(
      maybeFinished,
      FINISHED_DWELL_MS + 100,
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(dwellTimer);
      for (const s of sentinels) s.el.remove();
    };
  }, [bookmarkId]);

  return null;
}
