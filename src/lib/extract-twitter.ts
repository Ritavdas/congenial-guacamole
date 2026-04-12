// @no-test-required — covered by extract.test.ts
const SYNDICATION_URL = "https://cdn.syndication.twimg.com/tweet-result";

const TWITTER_STATUS_REGEX =
  /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/(\d+)/;

export function isTwitterStatusUrl(url: string): boolean {
  return TWITTER_STATUS_REGEX.test(url);
}

function extractTweetId(url: string): string | null {
  const match = url.match(TWITTER_STATUS_REGEX);
  return match?.[3] ?? null;
}

export async function extractTwitterMetadata(url: string) {
  const tweetId = extractTweetId(url);
  if (!tweetId) return null;

  try {
    const apiUrl = new URL(SYNDICATION_URL);
    apiUrl.searchParams.set("id", tweetId);
    apiUrl.searchParams.set("lang", "en");
    apiUrl.searchParams.set("token", "0");

    const res = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const tweet = await res.json();

    const authorName = tweet.user?.name ?? "Unknown";
    const authorHandle = tweet.user?.screen_name ?? "";
    const tweetText: string = tweet.text ?? "";

    // Prefer tweet media, fall back to author avatar
    const mediaImage =
      tweet.mediaDetails?.[0]?.media_url_https ??
      tweet.photos?.[0]?.url ??
      null;
    const authorAvatar = tweet.user?.profile_image_url_https ?? null;
    const ogImage = mediaImage ?? authorAvatar;

    return {
      title: `${authorName} (@${authorHandle}) on X`,
      description: tweetText.slice(0, 280),
      ogImage,
      domain: "x.com",
      content: tweetText,
      htmlContent: `<p>${tweetText}</p>`,
      wordCount: tweetText.trim().split(/\s+/).length,
    };
  } catch {
    return null;
  }
}
