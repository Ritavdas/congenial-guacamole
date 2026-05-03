# Tag a saved bookmark — ASCII variants

Pick one (or mix). Status: **proposal, awaiting approval**.

Today: `tag-selector.tsx` already exists (used during add). There is no
way to add/change tags on an _existing_ bookmark.

---

## Variant A — Inline chips on the bookmark card

Tap a tag chip to remove. Tap "+" to open a quick picker.

```
┌──────────────────────────────────────┐
│ 📰  How React Server Components work │
│     react.dev • 8 min                │
│                                      │
│  [react ✕] [rsc ✕] [+ tag]    ⋯     │
└──────────────────────────────────────┘
```

Pros: zero clicks to see tags; fastest editing.
Cons: card gets crowded; accidental removes; harder on dense list view.

---

## Variant B — Card overflow menu (⋯) → "Edit tags"

```
┌──────────────────────────────────────┐
│ 📰  How React Server Components work │
│     react.dev • 8 min            ⋯  │──┐
└──────────────────────────────────────┘  │
                                          ▼
                          ┌──────────────────┐
                          │ Open             │
                          │ Edit tags        │ ← opens picker
                          │ Archive          │
                          │ Delete           │
                          └──────────────────┘

Picker (bottom-sheet on mobile, popover on desktop):

┌─────────────────────────────────────┐
│  Tags for "How React Server…"  ✕   │
│  ─────────────────────────────────  │
│  [react ✕] [rsc ✕]                  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Search or create…            │  │
│  └───────────────────────────────┘  │
│                                     │
│  Suggested                          │
│   ☐ frontend                        │
│   ☐ nextjs                          │
│   ☐ web                             │
│                                     │
│        [   Done   ]                 │
└─────────────────────────────────────┘
```

Pros: clean card; consistent with other actions; works everywhere.
Cons: 2 taps to edit.

---

## Variant C — Tag chips inside Reader View

While reading the article, the tag bar lives in the reader header.

```
┌─────────────────────────────────────┐
│  ← Back                       ⋯    │
│                                     │
│  How React Server Components Work   │
│  react.dev • 8 min                  │
│                                     │
│  Tags: [react ✕] [rsc ✕] [+ add]   │
│  ─────────────────────────────────  │
│                                     │
│  Article body text…                 │
│  …                                  │
└─────────────────────────────────────┘
```

Pros: user is already engaged with the bookmark; natural moment to organize.
Cons: doesn't help when triaging the list.

---

## Variant D — Bulk edit from list (multi-select)

Long-press / shift-click selects bookmarks; toolbar appears.

```
┌────────────────────────────────────────────┐
│  3 selected             [Tag] [Archive] ✕ │ ← bulk action bar
├────────────────────────────────────────────┤
│  ☑  📰 Article one                         │
│  ☑  📰 Article two                         │
│  ☑  📰 Article three                       │
│  ☐  📰 Article four                        │
└────────────────────────────────────────────┘

Tap [Tag] → same picker as Variant B, applies to all selected.
```

Pros: massive time-saver for organizing backlogs.
Cons: more complex UI; needs selection state.

---

## Recommendation

**Variant B + Variant C** — B is the universal entry, C catches the
in-context moment. Variant D is a great follow-up once B works.
Variant A is tempting but the card gets noisy fast.
