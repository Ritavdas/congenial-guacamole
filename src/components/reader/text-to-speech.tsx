"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Pause, Square } from "lucide-react";

interface TextToSpeechProps {
  text: string;
}

export function TextToSpeech({ text }: TextToSpeechProps) {
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1.0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.slice(0, 32000));
    utterance.rate = rate;
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setStatus("playing");
  }, [text, rate, status]);

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setStatus("paused");
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setStatus("idle");
  }, []);

  if (typeof window !== "undefined" && !window.speechSynthesis) return null;

  return (
    <div className="flex items-center gap-2">
      {status === "playing" ? (
        <button
          onClick={pause}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
          title="Pause"
        >
          <Pause className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={speak}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
          title={status === "paused" ? "Resume" : "Listen to article"}
        >
          <Play className="h-4 w-4" />
        </button>
      )}

      {status !== "idle" && (
        <button
          onClick={stop}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
          title="Stop"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}

      <select
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value))}
        className="h-8 rounded-md border bg-transparent px-1.5 text-xs"
        title="Playback speed"
      >
        <option value="0.75">0.75×</option>
        <option value="1">1×</option>
        <option value="1.25">1.25×</option>
        <option value="1.5">1.5×</option>
        <option value="2">2×</option>
      </select>

      <span className="text-xs text-muted-foreground">
        {status === "idle"
          ? "Listen"
          : status === "playing"
            ? "Playing…"
            : "Paused"}
      </span>
    </div>
  );
}
