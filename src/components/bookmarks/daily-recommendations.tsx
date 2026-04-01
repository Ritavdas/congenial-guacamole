"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface RecommendedBookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  domain: string | null;
  wordCount: number | null;
}

interface Recommendation {
  id: string;
  bookmarkId: string;
  reason: string;
  date: string;
  isClicked: boolean;
  bookmark: RecommendedBookmark;
}

function estimateReadingTime(wordCount: number | null): string {
  if (!wordCount) return "Unknown";
  const minutes = Math.max(1, Math.round(wordCount / 238));
  return `${minutes} min read`;
}

export function DailyRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/recommendations/generate");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRecommendations(data.recommendations ?? []);
    } catch {
      toast.error("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRecommendations = useCallback(async (force = false) => {
    try {
      setGenerating(true);
      const url = force
        ? "/api/recommendations/generate?force=true"
        : "/api/recommendations/generate";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      setRecommendations(data.recommendations ?? []);
      if (data.recommendations?.length) {
        toast.success("Recommendations ready!");
      } else {
        toast.info("Not enough unread articles to generate recommendations");
      }
    } catch {
      toast.error("Failed to generate recommendations");
    } finally {
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const markClicked = async (recId: string) => {
    try {
      await fetch("/api/recommendations/generate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recId }),
      });
    } catch {
      // Silent fail for click tracking
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Today&apos;s Picks</CardTitle>
          </div>
          <CardDescription>AI-powered reading recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Today&apos;s Picks</CardTitle>
          </div>
          <CardDescription>AI-powered reading recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            No recommendations yet. Generate personalized picks from your unread
            articles.
          </p>
          <Button
            onClick={() => generateRecommendations()}
            disabled={generating}
            size="sm"
          >
            {generating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Recommendations
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Today&apos;s Picks</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generateRecommendations(true)}
            disabled={generating}
          >
            <RefreshCw
              className={`h-4 w-4 ${generating ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <CardDescription>AI-powered reading recommendations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => (
          <Link
            key={rec.id}
            href={`/read/${rec.bookmarkId}`}
            onClick={() => markClicked(rec.id)}
            className="block group"
          >
            <div className="rounded-lg border p-3 transition-colors hover:bg-muted/50">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium leading-tight group-hover:underline">
                  {rec.bookmark.title ?? "Untitled"}
                </h4>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {rec.bookmark.domain && <span>{rec.bookmark.domain}</span>}
                {rec.bookmark.domain && rec.bookmark.wordCount && (
                  <span>·</span>
                )}
                {rec.bookmark.wordCount && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {estimateReadingTime(rec.bookmark.wordCount)}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs italic text-muted-foreground">
                {rec.reason}
              </p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
