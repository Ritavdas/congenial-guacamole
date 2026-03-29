"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "pocketclone-reading-pos-";

export function useSaveReadingPosition(bookmarkId: string) {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight <= 0) return;
        const percent = window.scrollY / scrollHeight;
        try {
          localStorage.setItem(STORAGE_PREFIX + bookmarkId, String(percent));
        } catch {}
      }, 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [bookmarkId]);
}

export function useRestoreReadingPosition(bookmarkId: string) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_PREFIX + bookmarkId);
        if (saved) {
          const percent = parseFloat(saved);
          if (!isNaN(percent) && percent > 0.02) {
            const scrollTarget =
              percent *
              (document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo({ top: scrollTarget, behavior: "instant" });
          }
        }
      } catch {}
    }, 100);

    return () => clearTimeout(timeout);
  }, [bookmarkId]);
}
