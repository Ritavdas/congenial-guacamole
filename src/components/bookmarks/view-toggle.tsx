"use client";

import { LayoutGrid, List, AlignJustify } from "lucide-react";

export type ViewMode = "grid" | "list" | "headlines";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const views: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: "grid", icon: LayoutGrid, label: "Grid" },
  { mode: "list", icon: List, label: "List" },
  { mode: "headlines", icon: AlignJustify, label: "Headlines" },
];

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
      {views.map(({ mode: m, icon: Icon, label }) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
