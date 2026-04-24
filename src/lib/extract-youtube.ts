/**
 * YouTube extraction — title/description/thumbnail via oEmbed, body content
 * via the YouTube InnerTube API (the same internal API the YouTube app uses,
 * which works with a static Android-client signature where the public
 * timedtext endpoint now returns empty bodies for anonymous requests).
 *
 * No API key, no quota, no third-party dependency.
 *
 * Caveats:
 *   - Videos with captions disabled return null content (we still return
 *     metadata so the bookmark is searchable + the reader shows the embed).
 *   - Age-restricted / private videos may return null.
 *   - Transcript timestamps are stripped — we just want readable text.
 */

import type { ExtractedMetadata } from "./extract";

const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const FETCH_TIMEOUT_MS = 10_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// InnerTube Android-client signature. YouTube treats requests with this
// User-Agent + JSON body as coming from the official Android app and returns
// caption track URLs that actually serve content (unlike anonymous web).
const INNERTUBE_CLIENT_VERSION = "20.10.38";
const INNERTUBE_UA = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;
const INNERTUBE_PLAYER_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return YOUTUBE_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

/** Pull the 11-char video id from any YouTube URL shape. */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    // /shorts/ID, /embed/ID, /v/ID, /live/ID
    const m = u.pathname.match(/\/(?:shorts|embed|v|live)\/([\w-]{11})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
};

type InnerTubePlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

/** Pick the best English-ish track, falling back to the first available. */
function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const isEn = (t: CaptionTrack) =>
    t.languageCode?.toLowerCase().startsWith("en") ?? false;
  return (
    tracks.find((t) => isEn(t) && !t.kind) ?? // manual English
    tracks.find((t) => isEn(t)) ?? // auto-generated English
    tracks[0]
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

/** Parse the XML (or TTML) transcript payload returned by a caption baseUrl. */
function parseTranscriptXml(xml: string): string {
  const parts: string[] = [];
  // <p t="0" d="1234">…</p> wrapping <s>tokens</s>
  const pRe = /<p\s+[^>]*?>([\s\S]*?)<\/p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRe.exec(xml)) !== null) {
    const inner = pMatch[1];
    const sRe = /<s[^>]*>([^<]*)<\/s>/g;
    let collected = "";
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sRe.exec(inner)) !== null) collected += sMatch[1];
    if (!collected) collected = inner.replace(/<[^>]+>/g, "");
    const decoded = decodeEntities(collected).trim();
    if (decoded) parts.push(decoded);
  }
  if (parts.length > 0) return parts.join(" ").replace(/\s+/g, " ").trim();

  // Fallback: legacy <text start="…" dur="…">…</text> format
  const textRe = /<text\s+[^>]*>([^<]*)<\/text>/g;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = textRe.exec(xml)) !== null) {
    const decoded = decodeEntities(tMatch[1]).trim();
    if (decoded) parts.push(decoded);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Fetch the InnerTube player payload and pull the caption tracks out. */
async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  try {
    const res = await fetch(INNERTUBE_PLAYER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": INNERTUBE_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: INNERTUBE_CLIENT_VERSION,
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as InnerTubePlayerResponse;
    const tracks =
      data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    return Array.isArray(tracks) ? tracks : [];
  } catch {
    return [];
  }
}

async function fetchTranscriptForTrack(
  track: CaptionTrack,
): Promise<string | null> {
  try {
    // Defensive: only fetch from real youtube hosts
    const u = new URL(track.baseUrl);
    if (!u.hostname.endsWith(".youtube.com")) return null;
    const res = await fetch(track.baseUrl, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    if (!xml) return null;
    const text = parseTranscriptXml(xml);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function fetchTranscriptText(videoId: string): Promise<string | null> {
  const tracks = await fetchCaptionTracks(videoId);
  const best = pickBestTrack(tracks);
  if (!best?.baseUrl) return null;
  return fetchTranscriptForTrack(best);
}

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

async function fetchOEmbed(videoId: string): Promise<OEmbedResponse | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${videoId}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as OEmbedResponse;
  } catch {
    return null;
  }
}

/** Fetch the watch-page meta description (oEmbed doesn't include it). */
async function fetchDescription(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
    const raw = m?.[1];
    return raw ? decodeEntities(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Returns video metadata + transcript-as-content. Title/thumbnail via
 * oEmbed; description via watch-page meta scrape; transcript via InnerTube.
 * Best effort — content is null when captions are disabled.
 */
export async function extractYouTubeMetadata(
  url: string,
): Promise<ExtractedMetadata | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "youtube.com";
    }
  })();

  const [oembed, description, transcript] = await Promise.all([
    fetchOEmbed(videoId),
    fetchDescription(videoId),
    fetchTranscriptText(videoId),
  ]);

  const wordCount = transcript ? transcript.split(/\s+/).length : null;

  return {
    title: oembed?.title ?? null,
    description,
    ogImage:
      oembed?.thumbnail_url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    domain,
    content: transcript,
    htmlContent: null,
    wordCount,
  };
}
