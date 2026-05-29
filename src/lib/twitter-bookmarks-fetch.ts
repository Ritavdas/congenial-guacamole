// @no-test-required — server-side port of scripts/export_bookmarks.py (GraphQL fetch + pagination)

/**
 * Raw tweet shape produced by this fetcher — identical to the JSON written by
 * scripts/export_bookmarks.py, so it can be fed straight into
 * parseTwitterBookmarksExport().
 */
export interface ExportedBookmark {
  tweet_id: string;
  tweet_url: string;
  created_at: string;
  full_text: string;
  author_name: string;
  author_handle: string;
  author_followers: number;
  retweet_count: number;
  favorite_count: number;
  reply_count: number;
  bookmark_count: number;
  view_count: string;
  lang: string;
  media_urls: string;
  urls: string;
  is_quote: boolean;
  is_reply: boolean;
}

const GRAPHQL_URL =
  // eslint-disable-next-line no-secrets/no-secrets -- public GraphQL endpoint path, not a secret
  "https://x.com/i/api/graphql/YCrjINs3IPbkSl5FQf_tpA/Bookmarks";

// Public bearer token used by Twitter's web app (same for everyone).
const BEARER_TOKEN =
  // eslint-disable-next-line no-secrets/no-secrets -- public web-app bearer token, identical for all clients
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const PAGE_SIZE = 20;

const FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false,
} as const;

interface TimelineEntry {
  content?: {
    __typename?: string;
    cursorType?: string;
    value?: string;
    itemContent?: {
      tweet_results?: { result?: Record<string, unknown> };
    };
  };
}

export class TwitterAuthError extends Error {}
export class TwitterRateLimitError extends Error {}

function buildUrl(cursor: string | null): string {
  const variables: Record<string, unknown> = {
    count: PAGE_SIZE,
    includePromotedContent: true,
  };
  if (cursor) variables.cursor = cursor;

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(FEATURES),
  });
  return `${GRAPHQL_URL}?${params.toString()}`;
}

function buildHeaders(authToken: string, csrfToken: string): HeadersInit {
  return {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    authorization: `Bearer ${decodeURIComponent(BEARER_TOKEN)}`,
    "content-type": "application/json",
    "x-csrf-token": csrfToken,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
    cookie: `auth_token=${authToken}; ct0=${csrfToken}`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function extractTweet(entry: TimelineEntry): ExportedBookmark | null {
  try {
    const content = entry.content ?? {};
    if (content.__typename !== "TimelineTimelineItem") return null;

    let result = asRecord(content.itemContent?.tweet_results?.result);

    // Handle tweets wrapped in TweetWithVisibilityResults
    if (result.__typename === "TweetWithVisibilityResults") {
      result = asRecord(result.tweet);
    }
    if (result.__typename !== "Tweet") return null;

    const legacy = asRecord(result.legacy);
    const userResult = asRecord(
      asRecord(asRecord(result.core).user_results).result,
    );
    const userCore = asRecord(userResult.core);
    const userLegacy = asRecord(userResult.legacy);

    const tweetId = String(result.rest_id ?? "");
    const screenName = String(userCore.screen_name ?? "");

    const entities = asRecord(legacy.entities);
    const media = Array.isArray(entities.media)
      ? (entities.media as Record<string, unknown>[])
      : [];
    const mediaUrls = media.map((m) => String(m.media_url_https ?? ""));

    const urls = Array.isArray(entities.urls)
      ? (entities.urls as Record<string, unknown>[])
      : [];
    const expandedUrls = urls.map((u) => String(u.expanded_url ?? ""));

    return {
      tweet_id: tweetId,
      tweet_url: `https://x.com/${screenName}/status/${tweetId}`,
      created_at: String(legacy.created_at ?? ""),
      full_text: String(legacy.full_text ?? ""),
      author_name: String(userCore.name ?? ""),
      author_handle: `@${screenName}`,
      author_followers: Number(userLegacy.followers_count ?? 0),
      retweet_count: Number(legacy.retweet_count ?? 0),
      favorite_count: Number(legacy.favorite_count ?? 0),
      reply_count: Number(legacy.reply_count ?? 0),
      bookmark_count: Number(legacy.bookmark_count ?? 0),
      view_count: String(asRecord(result.views).count ?? "0"),
      lang: String(legacy.lang ?? ""),
      media_urls: mediaUrls.join("; "),
      urls: expandedUrls.join("; "),
      is_quote: Boolean(legacy.quoted_status_id_str),
      is_reply: Boolean(legacy.in_reply_to_status_id_str),
    };
  } catch {
    return null;
  }
}

function extractCursor(
  entries: TimelineEntry[],
  cursorType = "Bottom",
): string | null {
  for (const entry of entries) {
    const content = entry.content ?? {};
    if (
      content.__typename === "TimelineTimelineCursor" &&
      content.cursorType === cursorType
    ) {
      return content.value ?? null;
    }
  }
  return null;
}

async function fetchPage(
  cursor: string | null,
  authToken: string,
  csrfToken: string,
): Promise<TimelineEntry[]> {
  const res = await fetch(buildUrl(cursor), {
    headers: buildHeaders(authToken, csrfToken),
  });

  if (res.status === 401 || res.status === 403) {
    throw new TwitterAuthError(
      `X auth rejected (HTTP ${res.status}) — refresh X_AUTH_TOKEN / X_CSRF_TOKEN`,
    );
  }
  if (res.status === 429) {
    throw new TwitterRateLimitError("Rate limited by X (HTTP 429)");
  }
  if (!res.ok) {
    throw new Error(`X API error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const instructions =
    (asRecord(asRecord(asRecord(data.data).bookmark_timeline_v2).timeline)
      .instructions as { entries?: TimelineEntry[] }[] | undefined) ?? [];

  const entries: TimelineEntry[] = [];
  for (const instr of instructions) {
    if (Array.isArray(instr.entries)) entries.push(...instr.entries);
  }
  return entries;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOptions {
  authToken: string;
  csrfToken: string;
  /** Seconds to wait between page requests. Default 3. */
  requestDelaySeconds?: number;
  /** Hard cap on pages fetched (safety). Default 200. */
  maxPages?: number;
  /**
   * Called after each page with that page's tweets. Return `true` to stop
   * paginating (used for incremental sync once we hit already-seen tweets).
   */
  onPage?: (
    pageTweets: ExportedBookmark[],
    pageNumber: number,
  ) => boolean | Promise<boolean>;
}

export interface FetchResult {
  tweets: ExportedBookmark[];
  pagesFetched: number;
  stoppedEarly: boolean;
}

/**
 * Paginate through bookmarks (newest-first). Mirrors fetch_all_bookmarks() in
 * the Python script, but lets the caller stop early via `onPage`.
 */
export async function fetchAllBookmarks(
  options: FetchOptions,
): Promise<FetchResult> {
  const {
    authToken,
    csrfToken,
    requestDelaySeconds = 3,
    maxPages = 200,
    onPage,
  } = options;

  const tweets: ExportedBookmark[] = [];
  let cursor: string | null = null;
  let page = 0;
  let stoppedEarly = false;

  while (page < maxPages) {
    page += 1;

    let entries: TimelineEntry[];
    try {
      entries = await fetchPage(cursor, authToken, csrfToken);
    } catch (err) {
      if (err instanceof TwitterRateLimitError) {
        await sleep(60_000);
        page -= 1;
        continue;
      }
      throw err;
    }

    const pageTweets: ExportedBookmark[] = [];
    for (const entry of entries) {
      const tweet = extractTweet(entry);
      if (tweet) pageTweets.push(tweet);
    }

    tweets.push(...pageTweets);

    if (onPage) {
      const stop = await onPage(pageTweets, page);
      if (stop) {
        stoppedEarly = true;
        break;
      }
    }

    if (pageTweets.length === 0) break;

    const nextCursor = extractCursor(entries, "Bottom");
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;

    await sleep(requestDelaySeconds * 1000);
  }

  return { tweets, pagesFetched: page, stoppedEarly };
}
