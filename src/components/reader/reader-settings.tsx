"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ALargeSmall,
  Sun,
  Moon,
  Minus,
  Plus,
  Monitor,
} from "lucide-react";

export interface ReaderSettings {
  fontSize: number;
  fontFamily: "sans" | "serif" | "mono";
  lineHeight: number;
  theme: "auto" | "light" | "dark" | "sepia";
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontFamily: "sans",
  lineHeight: 1.7,
  theme: "auto",
};

const FONT_MAP: Record<string, string> = {
  sans: "'Inter', var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', 'Noto Serif', serif",
  mono: "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const THEME_MAP: Record<string, { bg: string; fg: string; muted: string }> = {
  light: { bg: "#ffffff", fg: "#1a1a1a", muted: "#6b7280" },
  dark: { bg: "#1a1a1a", fg: "#e5e5e5", muted: "#9ca3af" },
  sepia: { bg: "#f4ecd8", fg: "#5b4636", muted: "#8b7355" },
};

const STORAGE_KEY = "pockaa-reader-settings";

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as ReaderSettings;
    } catch {}
    return DEFAULT_SETTINGS;
  });
  const [loaded] = useState(() => typeof window !== "undefined");

  const updateSettings = useCallback(
    (partial: Partial<ReaderSettings>) => {
      const next = { ...settings, ...partial };
      setSettings(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    },
    [settings]
  );

  const cssVars: React.CSSProperties & Record<string, string> =
    settings.theme !== "auto" && THEME_MAP[settings.theme]
      ? {
          "--reader-font-size": `${settings.fontSize}px`,
          "--reader-font-family": FONT_MAP[settings.fontFamily],
          "--reader-line-height": String(settings.lineHeight),
          "--reader-bg": THEME_MAP[settings.theme].bg,
          "--reader-fg": THEME_MAP[settings.theme].fg,
          "--reader-muted": THEME_MAP[settings.theme].muted,
          backgroundColor: THEME_MAP[settings.theme].bg,
          color: THEME_MAP[settings.theme].fg,
        }
      : {
          "--reader-font-size": `${settings.fontSize}px`,
          "--reader-font-family": FONT_MAP[settings.fontFamily],
          "--reader-line-height": String(settings.lineHeight),
        };

  return { settings, updateSettings, cssVars, loaded };
}

interface ReaderToolbarProps {
  settings: ReaderSettings;
  onUpdate: (partial: Partial<ReaderSettings>) => void;
}

export function ReaderToolbar({ settings, onUpdate }: ReaderToolbarProps) {
  const [open, setOpen] = useState(false);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-reader-toolbar]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" data-reader-toolbar>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Reading settings"
      >
        <ALargeSmall className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border bg-popover p-4 shadow-lg">
          {/* Font size */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Font Size
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  onUpdate({ fontSize: Math.max(14, settings.fontSize - 1) })
                }
                className="flex h-7 w-7 items-center justify-center rounded border hover:bg-muted"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[3ch] text-center text-sm font-medium">
                {settings.fontSize}
              </span>
              <button
                onClick={() =>
                  onUpdate({ fontSize: Math.min(28, settings.fontSize + 1) })
                }
                className="flex h-7 w-7 items-center justify-center rounded border hover:bg-muted"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Font family */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Font
            </label>
            <div className="flex gap-1.5">
              {(["sans", "serif", "mono"] as const).map((f) => (
                <button
                  key={f}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    settings.fontFamily === f
                      ? "border-primary bg-primary/10 font-semibold"
                      : "hover:bg-muted"
                  }`}
                  style={{ fontFamily: FONT_MAP[f] }}
                  onClick={() => onUpdate({ fontFamily: f })}
                >
                  {f === "sans" ? "Sans" : f === "serif" ? "Serif" : "Mono"}
                </button>
              ))}
            </div>
          </div>

          {/* Line height */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Line Spacing
            </label>
            <div className="flex gap-1.5">
              {[1.4, 1.6, 1.8, 2.0].map((lh) => (
                <button
                  key={lh}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    settings.lineHeight === lh
                      ? "border-primary bg-primary/10 font-semibold"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => onUpdate({ lineHeight: lh })}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Theme
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  { key: "auto", label: "Auto", icon: Monitor },
                  { key: "light", label: "Light", icon: Sun },
                  { key: "sepia", label: "Sepia", icon: ALargeSmall },
                  { key: "dark", label: "Dark", icon: Moon },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    settings.theme === key
                      ? "border-primary bg-primary/10 font-semibold"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => onUpdate({ theme: key })}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
