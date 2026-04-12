# Pockaa Redesign — Extension + Dashboard Mockups

## Context

**Current pain points:**
- Extension requires manual click to save → should auto-save on open
- Dashboard has 7 sections of info overload (stats, AI recs, reading queue, recent, all bookmarks)
- Real workflow: save → tag (e.g. "newsletter") → go to tag → batch-read

**Extension redesign:**
- Auto-save on popup open (new URL → save immediately)
- Already-saved URL → show "Already in your library" + reader mode link
- Tag selection is optional, shown after save confirms

---

## Extension Mockups

### New URL (Auto-Save Flow)

```
┌──────────────────────────────────────┐
│  🔖 Pockaa                     ⚙️   │
├──────────────────────────────────────┤
│                                      │
│         ✓ Saved!                     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ How React Server Components  │    │
│  │ Work in Next.js 15           │    │
│  │ vercel.com · 8 min read      │    │
│  └──────────────────────────────┘    │
│                                      │
│  Add tags (optional)                 │
│  ┌──────────────────────────────┐    │
│  │ 🔍 Search or create a tag…   │    │
│  └──────────────────────────────┘    │
│  [newsletter] [react] [+ design]     │
│                                      │
│  ──────────────────────────────────  │
│  Open in Reader →                    │
│                                      │
├──────────────────────────────────────┤
│          pockaa.ritavdas.com         │
└──────────────────────────────────────┘
```

### Already-Saved URL

```
┌──────────────────────────────────────┐
│  🔖 Pockaa                     ⚙️   │
├──────────────────────────────────────┤
│                                      │
│  📚 Already in your library          │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ How React Server Components  │    │
│  │ Work in Next.js 15           │    │
│  │ vercel.com · Saved 3 days ago│    │
│  │                              │    │
│  │ Tags: [newsletter] [react]   │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     📖 Open in Reader        │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     🔗 Open in Pockaa        │    │
│  └──────────────────────────────┘    │
│                                      │
│  Edit tags ›                         │
│                                      │
├──────────────────────────────────────┤
│          pockaa.ritavdas.com         │
└──────────────────────────────────────┘
```

### Saving State (Brief, ~1 second)

```
┌──────────────────────────────────────┐
│  🔖 Pockaa                     ⚙️   │
├──────────────────────────────────────┤
│                                      │
│                                      │
│          ◠ Saving…                   │
│                                      │
│  vercel.com/blog/rsc-deep-dive       │
│                                      │
│                                      │
├──────────────────────────────────────┤
│          pockaa.ritavdas.com         │
└──────────────────────────────────────┘
```

### Error State

```
┌──────────────────────────────────────┐
│  🔖 Pockaa                     ⚙️   │
├──────────────────────────────────────┤
│                                      │
│     ⚠️  Couldn't save                │
│                                      │
│  vercel.com/blog/rsc-deep-dive       │
│                                      │
│  Network error. Check your           │
│  connection and try again.           │
│                                      │
│  ┌──────────────────────────────┐    │
│  │        🔄 Retry               │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│          pockaa.ritavdas.com         │
└──────────────────────────────────────┘
```

---

## Dashboard Mockups — Three Options

---

### OPTION A: Feed-Style

**Concept:** Homepage IS the feed. No stats, no widgets. Just a clean chronological
list of everything you've saved. Tags shown inline as chips. Minimal, scannable,
like a Twitter/RSS timeline.

**Best for:** People who want to quickly scan what they saved and find something to read.

```
┌─────────────┐  ┌──────────────────────────────────────────────────────────┐
│              │  │  Pockaa                              [+ Add]  [👤]      │
│  🔖 Pockaa  │  ├──────────────────────────────────────────────────────────┤
│              │  │                                                          │
│  ● Home     │  │  Good morning, Ritav              12 saved this week     │
│  ○ Search   │  │                                                          │
│  ○ Tags     │  │  ───────────────────────────────────────────────────────  │
│  ○ Archive  │  │                                                          │
│              │  │  ┌──────────────────────────────────────────────────┐    │
│              │  │  │  📄  How React Server Components Work           │    │
│              │  │  │      vercel.com · 8 min · 2h ago                │    │
│              │  │  │      [newsletter] [react]                        │    │
│              │  │  └──────────────────────────────────────────────────┘    │
│              │  │                                                          │
│              │  │  ┌──────────────────────────────────────────────────┐    │
│              │  │  │  📄  The State of CSS 2026                      │    │
│              │  │  │      smashingmag.com · 12 min · 5h ago          │    │
│              │  │  │      [design]                                    │    │
│              │  │  └──────────────────────────────────────────────────┘    │
│              │  │                                                          │
│              │  │  ┌──────────────────────────────────────────────────┐    │
│              │  │  │  📄  Why SQLite is Taking Over                  │    │
│              │  │  │      fly.io · 6 min · Yesterday                 │    │
│              │  │  │      [newsletter] [databases]                    │    │
│              │  │  └──────────────────────────────────────────────────┘    │
│              │  │                                                          │
│              │  │  ┌──────────────────────────────────────────────────┐    │
│              │  │  │  📄  Building a Second Brain (book notes)       │    │
│              │  │  │      notion.so · 15 min · 2 days ago            │    │
│              │  │  │      [no tags yet]                [+ add tag]    │    │
│              │  │  └──────────────────────────────────────────────────┘    │
│              │  │                                                          │
│              │  │  ┌──────────────────────────────────────────────────┐    │
│              │  │  │  📄  Deno 2.0: What You Need to Know            │    │
│              │  │  │      deno.com · 10 min · 3 days ago             │    │
│              │  │  │      [newsletter]                                │    │
│              │  │  └──────────────────────────────────────────────────┘    │
│              │  │                                                          │
│              │  │                   ↓ scroll for more                      │
│              │  │                                                          │
└─────────────┘  └──────────────────────────────────────────────────────────┘

SIDEBAR: Trimmed to just 4 items (Home, Search, Tags, Archive)
MAIN AREA: Pure chronological feed, no sections
TAGS: Inline chips on each card, clickable to filter
UNTAGGED ITEMS: Show a subtle [+ add tag] nudge
```

---

### OPTION B: Tag-Centric

**Concept:** Homepage shows your tags as "buckets" in a grid. Each bucket shows
its most recent/unread items. Untagged items surface at the bottom as a nudge.
You land directly on your workflow.

**Best for:** People who organize by topic and want to see "what's new" per category.

```
┌─────────────┐  ┌──────────────────────────────────────────────────────────┐
│              │  │  Pockaa                              [+ Add]  [👤]      │
│  🔖 Pockaa  │  ├──────────────────────────────────────────────────────────┤
│              │  │                                                          │
│  ● Home     │  │  Your Library                                            │
│  ○ Search   │  │                                                          │
│  ○ Archive  │  │  ┌────────────────────────┐  ┌────────────────────────┐  │
│              │  │  │  📰 newsletter         │  │  🎨 design             │  │
│              │  │  │  5 new articles        │  │  2 new articles        │  │
│              │  │  │ ──────────────────── │  │ ──────────────────── │  │
│              │  │  │  RSC Deep Dive         │  │  State of CSS 2026     │  │
│              │  │  │  SQLite Taking Over    │  │  Figma Variables API   │  │
│              │  │  │  Deno 2.0 Launch       │  │                        │  │
│              │  │  │  AI SDK Patterns       │  │                        │  │
│              │  │  │  Edge Runtime Guide    │  │                        │  │
│              │  │  │                        │  │                        │  │
│              │  │  │  View all →            │  │  View all →            │  │
│              │  │  └────────────────────────┘  └────────────────────────┘  │
│              │  │                                                          │
│              │  │  ┌────────────────────────┐  ┌────────────────────────┐  │
│              │  │  │  💾 databases           │  │  📚 books              │  │
│              │  │  │  1 new article          │  │  0 new · all read ✓   │  │
│              │  │  │ ──────────────────── │  │ ──────────────────── │  │
│              │  │  │  Why SQLite...          │  │  (nothing new)         │  │
│              │  │  │                        │  │                        │  │
│              │  │  │  View all →            │  │  View all →            │  │
│              │  │  └────────────────────────┘  └────────────────────────┘  │
│              │  │                                                          │
│              │  │  ─── Untagged (3) ──────────────────────────────────── │
│              │  │                                                          │
│              │  │  📄 Building a Second Brain...         2d ago [+ tag]   │
│              │  │  📄 Random HN thread about Rust...     3d ago [+ tag]   │
│              │  │  📄 Some YouTube video link...         5d ago [+ tag]   │
│              │  │                                                          │
└─────────────┘  └──────────────────────────────────────────────────────────┘

SIDEBAR: Minimal (Home, Search, Archive)
MAIN AREA: Tag buckets as cards in a 2-column grid
EACH BUCKET: Shows tag name, new count, recent titles, "View all" link
BOTTOM: Untagged items with [+ tag] action to encourage organizing
EMPTY TAGS: Show "all read ✓" so you feel good
```

---

### OPTION C: Inbox Model

**Concept:** Email-like triage. Everything you save lands in an "Inbox." You
process items from there — tag them, archive them, or read them. Tags live in
the sidebar with unread counts. Supports batch operations.

**Best for:** People who save a lot and want to process in batches (your newsletter workflow).

```
┌─────────────┐  ┌──────────────────────────────────────────────────────────┐
│              │  │  Pockaa                              [+ Add]  [👤]      │
│  🔖 Pockaa  │  ├──────────────────────────────────────────────────────────┤
│              │  │                                                          │
│  ● Inbox    │  │  Inbox (7)               [Select All]  [Archive]         │
│    (7)      │  │                                                          │
│  ○ Search   │  │  ┌──┬───────────────────────────────────────────────┐    │
│              │  │  │☐ │  How React Server Components Work            │    │
│  ── Tags ── │  │  │  │  vercel.com · 8 min · 2h ago                 │    │
│  ○ newslet- │  │  │  │  [+ tag]   [archive]   [→ read]              │    │
│    ter (5)  │  │  ├──┼───────────────────────────────────────────────┤    │
│  ○ design   │  │  │☐ │  The State of CSS 2026                       │    │
│    (2)      │  │  │  │  smashingmag.com · 12 min · 5h ago           │    │
│  ○ databa-  │  │  │  │  [+ tag]   [archive]   [→ read]              │    │
│    ses (1)  │  │  ├──┼───────────────────────────────────────────────┤    │
│  ○ books    │  │  │☐ │  Why SQLite is Taking Over                   │    │
│    (0)      │  │  │  │  fly.io · 6 min · Yesterday                  │    │
│              │  │  │  │  [+ tag]   [archive]   [→ read]              │    │
│  ── ──── ── │  │  ├──┼───────────────────────────────────────────────┤    │
│  ○ Archive  │  │  │☐ │  Building a Second Brain                     │    │
│              │  │  │  │  notion.so · 15 min · 2 days ago             │    │
│              │  │  │  │  [+ tag]   [archive]   [→ read]              │    │
│              │  │  ├──┼───────────────────────────────────────────────┤    │
│              │  │  │☐ │  Deno 2.0: What You Need to Know            │    │
│              │  │  │  │  deno.com · 10 min · 3 days ago              │    │
│              │  │  │  │  [+ tag]   [archive]   [→ read]              │    │
│              │  │  └──┴───────────────────────────────────────────────┘    │
│              │  │                                                          │
│              │  │  ── Batch Actions (when items selected) ──────────────  │
│              │  │  [Tag selected as... ▼]    [Archive all]    [Delete]    │
│              │  │                                                          │
└─────────────┘  └──────────────────────────────────────────────────────────┘

SIDEBAR: Inbox with count, then tags with counts, then Archive
MAIN AREA: Checklist-style items with inline actions
BATCH BAR: Appears when items are checked — tag, archive, or delete in bulk
TAGS IN SIDEBAR: Click a tag → see only that tag's items (same list layout)
INBOX: Items leave inbox once tagged OR archived
```

---

## Comparison Summary

| Aspect             | A: Feed        | B: Tag-Centric  | C: Inbox         |
|--------------------|----------------|-----------------|------------------|
| Default view       | Timeline       | Tag grid        | Triage list      |
| Complexity         | Lowest         | Medium          | Medium-High      |
| Batch operations   | No             | No              | Yes              |
| Tag visibility     | Inline chips   | Section headers | Sidebar + inline |
| Newsletter workflow| Scroll to find | Land on bucket  | Select → batch tag|
| Info density       | Low            | Medium          | High             |
| Feels like...      | Twitter/RSS    | Trello/Notion   | Gmail/Superhuman |

---

## Notes

- All three options drastically reduce the current 7-section dashboard
- Sidebar trimmed from 7 nav items to 3-4
- Stats, AI recommendations, enrichment banner, reading queue are all removed
- These can be brought back later as opt-in features if needed
