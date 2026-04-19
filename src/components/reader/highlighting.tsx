"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Highlight } from "@/db/schema";
import { addHighlight } from "@/lib/actions";
import { toast } from "sonner";

interface PendingHighlight {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

const HIGHLIGHT_COLORS = [
  { color: "#fbbf24", label: "Yellow" },
  { color: "#34d399", label: "Green" },
  { color: "#60a5fa", label: "Blue" },
  { color: "#f87171", label: "Red" },
  { color: "#c084fc", label: "Purple" },
];

function getTextOffset(
  root: Node,
  targetNode: Node,
  targetOffset: number,
): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += node.textContent?.length ?? 0;
  }
  return offset;
}

function findNodeAtOffset(
  root: Node,
  targetOffset: number,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (currentOffset + len >= targetOffset) {
      return { node, offset: targetOffset - currentOffset };
    }
    currentOffset += len;
  }
  return null;
}

export function useHighlighting(
  articleRef: React.RefObject<HTMLDivElement | null>,
  bookmarkId: string,
  existingHighlights: Highlight[],
) {
  const [pending, setPending] = useState<PendingHighlight | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>(existingHighlights);

  const handleMouseUp = useCallback(
    (e?: React.MouseEvent) => {
      // Skip double-clicks — those are handled by dictionary lookup
      if (e && (e as unknown as MouseEvent).detail >= 2) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !articleRef.current) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!articleRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) return;

      const startOffset = getTextOffset(
        articleRef.current,
        range.startContainer,
        range.startOffset,
      );
      const endOffset = getTextOffset(
        articleRef.current,
        range.endContainer,
        range.endOffset,
      );

      const rect = range.getBoundingClientRect();

      setPending({ text, startOffset, endOffset, rect });
    },
    [articleRef],
  );

  const createHighlight = useCallback(
    async (color: string) => {
      if (!pending) return;

      try {
        const highlight = await addHighlight(
          bookmarkId,
          pending.text,
          pending.startOffset,
          pending.endOffset,
          undefined,
          color,
        );
        setHighlights((prev) => [...prev, highlight]);
        window.getSelection()?.removeAllRanges();
        setPending(null);
        toast.success("Highlight added");
      } catch {
        toast.error("Failed to add highlight");
      }
    },
    [pending, bookmarkId],
  );

  const dismiss = useCallback(() => {
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Apply highlights to the DOM
  useEffect(() => {
    if (!articleRef.current || highlights.length === 0) return;

    // Remove existing highlight marks
    articleRef.current
      .querySelectorAll("mark[data-highlight]")
      .forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
      });

    // Merge adjacent text nodes after unwrapping marks
    articleRef.current.normalize();

    // Sort by startOffset descending so we don't shift offsets
    const sorted = [...highlights].sort(
      (a, b) => b.startOffset - a.startOffset,
    );

    for (const h of sorted) {
      try {
        const startPos = findNodeAtOffset(articleRef.current, h.startOffset);
        const endPos = findNodeAtOffset(articleRef.current, h.endOffset);
        if (!startPos || !endPos) continue;

        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);

        const mark = document.createElement("mark");
        mark.setAttribute("data-highlight", h.id);
        mark.style.backgroundColor = h.color + "40";
        mark.style.borderBottom = `2px solid ${h.color}`;
        mark.style.padding = "1px 0";
        mark.style.borderRadius = "2px";
        mark.style.cursor = "pointer";

        range.surroundContents(mark);
      } catch {
        // surroundContents can fail if the range crosses element boundaries
      }
    }
  }, [highlights, articleRef]);

  return { pending, highlights, createHighlight, dismiss, handleMouseUp };
}

interface HighlightToolbarProps {
  pending: PendingHighlight;
  onHighlight: (color: string) => void;
  onDismiss: () => void;
}

export function HighlightToolbar({
  pending,
  onHighlight,
  onDismiss,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  const top = pending.rect.top;
  const left = pending.rect.left + pending.rect.width / 2;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1.5 rounded-lg border bg-popover px-2 py-1.5 shadow-lg"
      style={{
        top: `${top - 44}px`,
        left: `${left}px`,
        transform: "translateX(-50%)",
      }}
    >
      {HIGHLIGHT_COLORS.map(({ color, label }) => (
        <button
          key={color}
          title={label}
          className="h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ backgroundColor: color }}
          onClick={() => onHighlight(color)}
        />
      ))}
    </div>
  );
}
