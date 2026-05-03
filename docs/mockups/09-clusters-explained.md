# What "Clusters" actually does

## In one sentence

**Clusters auto-groups your saved bookmarks by what they're about — no
tagging required.**

## What it does, mechanically

1. Every bookmark gets an "embedding" — a numeric fingerprint of its
   meaning (generated when you save it).
2. When you click **Rebuild**, k-means groups bookmarks whose
   fingerprints are close together.
3. An LLM looks at the top titles in each group and writes a short
   label like "AI safety research" or "Rust async patterns".
4. You see a grid of those labeled groups; tap one to see its bookmarks.

You need ≥ 20 embedded bookmarks before it'll run.

## Why it exists / who it's for

You save 200 articles over six months. You never tagged them. You vaguely
remember saving "that thing about Rust futures" but can't find it.
Clusters surfaces "Rust async" as a group with 12 articles in it — done.

It's the **"I never organize my bookmarks but I want them organized
anyway"** feature.

## Why "Clusters" is a bad name

- Sounds like a database concept, not a user benefit.
- Doesn't tell anyone what they'd get out of clicking it.
- The page header already says **"Topics"** — but the sidebar/route
  still says "Clusters". Inconsistent.

## Naming options

| Name      | Vibe                    | Verdict                |
| --------- | ----------------------- | ---------------------- |
| Clusters  | Engineering jargon      | ❌ current, drop it    |
| Topics    | Plain, accurate         | ✅ already used inside |
| Themes    | Slightly softer         | ✅ alternative         |
| Auto-tags | Says exactly what it is | ✅ if we lean utility  |
| For You   | Editorial, but vague    | ⚠️ overloaded term     |

**Recommendation: rename route + sidebar to "Topics"** to match the page.

## Pitch / tagline options (for empty state + sidebar tooltip)

1. _"Auto-grouped by theme. No tagging required."_
2. _"Pockaa reads your saves and bundles related ones together."_
3. _"Find that article you forgot to tag."_
4. _"Your reading list, organized for you."_

## Suggested empty-state copy

> **Topics will appear here.**
> Save 20 or more bookmarks and Pockaa will automatically group them
> by theme — like "AI research" or "Rust tutorials" — so you can find
> related saves without ever tagging anything.
>
> _[ Rebuild now ]_ (disabled until threshold met, with progress: "12 / 20")

## Suggested loaded-state subtitle

Replace "**N topics**" with:

> **N auto-detected topics** · _last refreshed 2h ago_ · [Rebuild]

## What I'd change in code (small, surgical)

- Rename route `/clusters` → `/topics` (with redirect).
- Sidebar label `Clusters` → `Topics`.
- Empty state copy: replace current vague copy with the version above.
- Show progress toward 20-bookmark threshold in empty state.
- Add "last rebuilt at" timestamp (already in DB? check `topicClusters`).
- Optional: auto-rebuild weekly via cron instead of manual button.

---

**Does this match what you wanted the feature to be?** If yes, I'll
implement the rename + copy changes. If no, tell me what you actually
wanted "Clusters" to do and we'll redesign.
