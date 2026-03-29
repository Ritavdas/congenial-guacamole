"use client";

import { useState, useEffect } from "react";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const scrolled = (window.scrollY / scrollHeight) * 100;
      setProgress(Math.min(100, Math.max(0, scrolled)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (progress <= 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-muted">
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
