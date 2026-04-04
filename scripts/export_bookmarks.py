#!/usr/bin/env python3
"""
Twitter/X Bookmarks Exporter
Fetches all bookmarks via the GraphQL API with automatic pagination.
Exports to both JSON and CSV.

Usage:
  1. Open x.com in Chrome, go to bookmarks page
  2. Open DevTools → Application → Cookies → x.com
  3. Copy your 'auth_token' and 'ct0' cookie values
  4. Run:
       export X_AUTH_TOKEN="your_auth_token"
       export X_CSRF_TOKEN="your_ct0_value"
       python3 scripts/export_bookmarks.py
"""

import json
import csv
import os
import sys
import time
import urllib.parse
import urllib.request
import ssl
from datetime import datetime
from pathlib import Path

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

# Paste your tokens here OR set as environment variables
AUTH_TOKEN = os.environ.get("X_AUTH_TOKEN", "")
CSRF_TOKEN = os.environ.get("X_CSRF_TOKEN", "")

# Delay between API requests (seconds) — stay conservative to avoid rate limits
REQUEST_DELAY = 3

# Max bookmarks per page (Twitter caps at 20)
PAGE_SIZE = 20

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "bookmarks_export"

# GraphQL endpoint
GRAPHQL_URL = "https://x.com/i/api/graphql/YCrjINs3IPbkSl5FQf_tpA/Bookmarks"

# Public bearer token used by Twitter's web app (same for everyone)
BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

FEATURES = {
    "rweb_video_screen_enabled": False,
    "profile_label_improvements_pcf_label_in_post_enabled": True,
    "responsive_web_profile_redirect_enabled": False,
    "rweb_tipjar_consumption_enabled": False,
    "verified_phone_label_enabled": True,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "premium_content_api_read_enabled": False,
    "communities_web_enable_tweet_community_results_fetch": True,
    "c9s_tweet_anatomy_moderator_badge_enabled": True,
    "responsive_web_grok_analyze_button_fetch_trends_enabled": False,
    "responsive_web_grok_analyze_post_followups_enabled": True,
    "responsive_web_jetfuel_frame": True,
    "responsive_web_grok_share_attachment_enabled": True,
    "responsive_web_grok_annotations_enabled": True,
    "articles_preview_enabled": True,
    "responsive_web_edit_tweet_api_enabled": True,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
    "view_counts_everywhere_api_enabled": True,
    "longform_notetweets_consumption_enabled": True,
    "responsive_web_twitter_article_tweet_consumption_enabled": True,
    "content_disclosure_indicator_enabled": True,
    "content_disclosure_ai_generated_indicator_enabled": True,
    "responsive_web_grok_show_grok_translated_post": False,
    "responsive_web_grok_analysis_button_from_backend": True,
    "post_ctas_fetch_enabled": True,
    "freedom_of_speech_not_reach_fetch_enabled": True,
    "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True,
    "longform_notetweets_inline_media_enabled": False,
    "responsive_web_grok_image_annotation_enabled": True,
    "responsive_web_grok_imagine_annotation_enabled": True,
    "responsive_web_grok_community_note_auto_translation_is_enabled": False,
    "responsive_web_enhance_cards_enabled": False,
}


def build_url(cursor: str | None = None) -> str:
    variables = {"count": PAGE_SIZE, "includePromotedContent": True}
    if cursor:
        variables["cursor"] = cursor

    params = {
        "variables": json.dumps(variables, separators=(",", ":")),
        "features": json.dumps(FEATURES, separators=(",", ":")),
    }
    return f"{GRAPHQL_URL}?{urllib.parse.urlencode(params)}"


def build_headers() -> dict:
    return {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": f"Bearer {urllib.parse.unquote(BEARER_TOKEN)}",
        "content-type": "application/json",
        "x-csrf-token": CSRF_TOKEN,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language": "en",
        "cookie": f"auth_token={AUTH_TOKEN}; ct0={CSRF_TOKEN}",
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/146.0.0.0 Safari/537.36"
        ),
    }


def extract_tweet(entry: dict) -> dict | None:
    """Extract clean tweet data from a timeline entry."""
    try:
        content = entry.get("content", {})
        if content.get("__typename") != "TimelineTimelineItem":
            return None

        item = content.get("itemContent", {})
        result = item.get("tweet_results", {}).get("result", {})

        # Handle tweets wrapped in TweetWithVisibilityResults
        if result.get("__typename") == "TweetWithVisibilityResults":
            result = result.get("tweet", {})

        if result.get("__typename") != "Tweet":
            return None

        legacy = result.get("legacy", {})
        user_result = result.get("core", {}).get("user_results", {}).get("result", {})
        user_core = user_result.get("core", {})
        user_legacy = user_result.get("legacy", {})

        tweet_id = result.get("rest_id", "")
        screen_name = user_core.get("screen_name", "")

        # Extract media URLs
        media = legacy.get("entities", {}).get("media", [])
        media_urls = [m.get("media_url_https", "") for m in media]

        # Extract expanded URLs
        urls = legacy.get("entities", {}).get("urls", [])
        expanded_urls = [u.get("expanded_url", "") for u in urls]

        return {
            "tweet_id": tweet_id,
            "tweet_url": f"https://x.com/{screen_name}/status/{tweet_id}",
            "created_at": legacy.get("created_at", ""),
            "full_text": legacy.get("full_text", ""),
            "author_name": user_core.get("name", ""),
            "author_handle": f"@{screen_name}",
            "author_followers": user_legacy.get("followers_count", 0),
            "retweet_count": legacy.get("retweet_count", 0),
            "favorite_count": legacy.get("favorite_count", 0),
            "reply_count": legacy.get("reply_count", 0),
            "bookmark_count": legacy.get("bookmark_count", 0),
            "view_count": result.get("views", {}).get("count", "0"),
            "lang": legacy.get("lang", ""),
            "media_urls": "; ".join(media_urls),
            "urls": "; ".join(expanded_urls),
            "is_quote": bool(legacy.get("quoted_status_id_str")),
            "is_reply": bool(legacy.get("in_reply_to_status_id_str")),
        }
    except Exception as e:
        print(f"  ⚠ Skipping entry: {e}")
        return None


def extract_cursor(entries: list, cursor_type: str = "Bottom") -> str | None:
    """Find the pagination cursor from entries."""
    for entry in entries:
        content = entry.get("content", {})
        if (
            content.get("__typename") == "TimelineTimelineCursor"
            and content.get("cursorType") == cursor_type
        ):
            return content.get("value")
    return None


def fetch_page(cursor: str | None = None) -> dict:
    """Fetch a single page of bookmarks."""
    url = build_url(cursor)
    headers = build_headers()
    ctx = ssl.create_default_context()

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx) as resp:
        return json.loads(resp.read().decode())


def fetch_all_bookmarks() -> list[dict]:
    """Paginate through all bookmarks."""
    all_tweets = []
    cursor = None
    page = 0

    print("🔖 Starting bookmark export...\n")

    while True:
        page += 1
        print(f"📄 Page {page}...", end=" ", flush=True)

        try:
            data = fetch_page(cursor)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 60
                print(f"\n⏳ Rate limited! Waiting {wait}s...")
                time.sleep(wait)
                continue
            else:
                print(f"\n❌ HTTP {e.code}: {e.reason}")
                body = e.read().decode() if e.fp else ""
                if body:
                    print(f"   {body[:300]}")
                break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            break

        instructions = (
            data.get("data", {})
            .get("bookmark_timeline_v2", {})
            .get("timeline", {})
            .get("instructions", [])
        )

        entries = []
        for instr in instructions:
            entries.extend(instr.get("entries", []))

        tweets_on_page = []
        for entry in entries:
            tweet = extract_tweet(entry)
            if tweet:
                tweets_on_page.append(tweet)

        all_tweets.extend(tweets_on_page)
        print(f"{len(tweets_on_page)} tweets (total: {len(all_tweets)})")

        if not tweets_on_page:
            print("\n✅ No more bookmarks.")
            break

        cursor = extract_cursor(entries, "Bottom")
        if not cursor:
            print("\n✅ Done (no more pages).")
            break

        print(f"   ⏳ Waiting {REQUEST_DELAY}s...")
        time.sleep(REQUEST_DELAY)

    return all_tweets


def save_json(tweets: list[dict], path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(tweets, f, indent=2, ensure_ascii=False)
    print(f"📝 JSON → {path} ({len(tweets)} tweets)")


def save_csv(tweets: list[dict], path: Path):
    if not tweets:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=tweets[0].keys())
        writer.writeheader()
        writer.writerows(tweets)
    print(f"📊 CSV  → {path} ({len(tweets)} tweets)")


def main():
    if not AUTH_TOKEN or not CSRF_TOKEN:
        print("❌ Missing credentials!\n")
        print("How to get your tokens:")
        print("  1. Open x.com/i/bookmarks in Chrome")
        print("  2. DevTools → Application → Cookies → x.com")
        print("  3. Copy 'auth_token' and 'ct0' cookie values\n")
        print("Then run:")
        print('  export X_AUTH_TOKEN="<auth_token value>"')
        print('  export X_CSRF_TOKEN="<ct0 value>"')
        print("  python3 scripts/export_bookmarks.py")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    tweets = fetch_all_bookmarks()

    if tweets:
        save_json(tweets, OUTPUT_DIR / f"bookmarks_{ts}.json")
        save_csv(tweets, OUTPUT_DIR / f"bookmarks_{ts}.csv")
        print(f"\n🎉 Exported {len(tweets)} bookmarks → {OUTPUT_DIR}/")
    else:
        print("\n⚠ No bookmarks fetched. Check your credentials.")


if __name__ == "__main__":
    main()
