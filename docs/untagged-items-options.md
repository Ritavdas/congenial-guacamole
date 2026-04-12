# Untagged Items — Design Options

With auto-save, many articles will land without tags. Here are 4 approaches
to handle them on the tag-centric homepage.

---

## Option 1: "Unsorted" Shelf at Bottom

A persistent section below the tag grid. Low-key, always there.

```
  ┌────────────────────────┐  ┌────────────────────────┐
  │  📰 newsletter         │  │  🎨 design             │
  │  5 new                 │  │  2 new                 │
  │  RSC Deep Dive         │  │  State of CSS 2026     │
  │  SQLite Taking Over    │  │  Figma Variables API   │
  │  View all →            │  │  View all →            │
  └────────────────────────┘  └────────────────────────┘

  ─── 📥 Unsorted (8) ─────────────────────────────────

  📄 Some random HN link             3h ago   [+ tag]
  📄 YouTube: Systems Design          1d ago   [+ tag]
  📄 A tweet thread about auth         2d ago   [+ tag]
  📄 Blog post about Bun              3d ago   [+ tag]

  Show all 8 →
```

**Pros:** Always visible, easy to process one-by-one
**Cons:** Can get long, adds noise if you don't care about tagging everything


---

## Option 2: Floating Counter Badge

No section on the page at all — just a small pill/badge in the sidebar
or header that shows the count. Click it to see the list.

```
  ┌─────────────┐
  │  🔖 Pockaa  │
  │              │
  │  ● Home     │
  │  ○ Search   │
  │  ○ Archive  │
  │              │
  │  ── Tags ── │
  │  ○ newslet… │
  │  ○ design   │
  │  ○ databa…  │
  │              │
  │  ── ──── ── │
  │  📥 Unsorted│   ← clicking this opens a full-page
  │     (8)     │      list of untagged items
  │              │
  └─────────────┘

  Homepage stays perfectly clean:

  ┌────────────────────────┐  ┌────────────────────────┐
  │  📰 newsletter         │  │  🎨 design             │
  │  5 new                 │  │  2 new                 │
  │  ...                   │  │  ...                   │
  └────────────────────────┘  └────────────────────────┘
  ┌────────────────────────┐  ┌────────────────────────┐
  │  💾 databases           │  │  📚 books              │
  │  1 new                 │  │  all read ✓            │
  │  ...                   │  │  ...                   │
  └────────────────────────┘  └────────────────────────┘

  (no untagged section here — homepage is only tag buckets)
```

**Pros:** Cleanest homepage, untagged items are out of sight until you want them
**Cons:** Easy to forget about, pile grows silently


---

## Option 3: Smart "Inbox Zero" Card

A single card in the tag grid — same size as tag buckets — that acts as
a mini inbox. Shows a count and the most recent untagged item. Disappears
when inbox is empty (inbox zero!).

```
  ┌────────────────────────┐  ┌────────────────────────┐
  │  📰 newsletter         │  │  🎨 design             │
  │  5 new                 │  │  2 new                 │
  │  RSC Deep Dive         │  │  State of CSS 2026     │
  │  SQLite Taking Over    │  │  Figma Variables API   │
  │  View all →            │  │  View all →            │
  └────────────────────────┘  └────────────────────────┘

  ┌────────────────────────┐  ┌────────────────────────┐
  │  💾 databases           │  │                        │
  │  1 new                 │  │  📥 Unsorted            │
  │  Why SQLite...         │  │  8 articles need tags   │
  │                        │  │                        │
  │  View all →            │  │  Latest:               │
  │                        │  │  "Some HN link" (3h)   │
  └────────────────────────┘  │                        │
                               │  Sort these →          │
                               └────────────────────────┘

  When inbox hits zero:

  ┌────────────────────────┐  ┌────────────────────────┐
  │  📰 newsletter         │  │  🎨 design             │
  │  5 new                 │  │  2 new                 │
  │  ...                   │  │  ...                   │
  └────────────────────────┘  └────────────────────────┘
  ┌────────────────────────┐
  │  💾 databases           │
  │  1 new                 │     ← "Unsorted" card is gone!
  │  ...                   │        Clean grid of tags only.
  └────────────────────────┘
```

**Pros:** Fits naturally in the grid, disappears when empty (satisfying!),
       doesn't break the tag-centric layout
**Cons:** Takes up a grid slot, might feel cluttered if you never tag things


---

## Option 4: Quick-Tag Banner (Triage Mode)

A dismissible banner at the top of the homepage that shows ONE untagged
article at a time. You tag it or skip it, and the next one appears.
Like a flashcard/tinder for your articles.

```
  ┌──────────────────────────────────────────────────────┐
  │  📥 8 unsorted articles — quick-tag them?            │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │  📄 Some random HN link about Rust            │    │
  │  │     news.ycombinator.com · 5 min · 3h ago     │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  [newsletter] [design] [databases] [books] [skip →]  │
  │                                                      │
  │  ─── or [dismiss for today] ──────────────────────── │
  └──────────────────────────────────────────────────────┘

  ┌────────────────────────┐  ┌────────────────────────┐
  │  📰 newsletter         │  │  🎨 design             │
  │  5 new                 │  │  2 new                 │
  │  ...                   │  │  ...                   │
  └────────────────────────┘  └────────────────────────┘
```

After tapping a tag or skip:

```
  ┌──────────────────────────────────────────────────────┐
  │  📥 7 unsorted articles                              │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │  📄 YouTube: Systems Design Interview         │    │ ← next card
  │  │     youtube.com · 45 min · 1d ago             │    │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  [newsletter] [design] [databases] [books] [skip →]  │
  │                                                      │
  │  ─── or [dismiss for today] ──────────────────────── │
  └──────────────────────────────────────────────────────┘
```

**Pros:** Fun, fast triage. One decision at a time. Feels lightweight.
**Cons:** Adds vertical space, only useful if you want to tag everything.
       "Dismiss for today" means it comes back tomorrow.


---

## Comparison

| Approach           | Homepage cleanliness | Discoverability | Satisfying? | Effort to process |
|--------------------|---------------------|-----------------|-------------|-------------------|
| 1. Shelf at bottom | Medium              | High            | Neutral     | One-by-one        |
| 2. Sidebar badge   | Highest             | Low             | Neutral     | Separate page     |
| 3. Grid card       | High                | High            | Yes (zero!) | Separate page     |
| 4. Triage banner   | Medium              | Highest         | Very yes    | One-by-one, fast  |

My instinct: **Option 3** (grid card) fits the tag-centric design best and
gives you that "inbox zero" satisfaction. But Option 4 (triage banner) is
the most fun if you want to actually tag everything.
