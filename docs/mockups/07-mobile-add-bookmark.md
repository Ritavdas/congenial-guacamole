# Mobile: Add Bookmark — ASCII variants

Pick one (or mix). Status: **proposal, awaiting approval**.

Current mobile state: bottom nav has Home / Search / Archive. No way to add.

---

## Variant A — Floating Action Button (FAB), bottom-right above nav

Pros: most discoverable, common pattern (Gmail, Inbox, Notion).
Cons: floats over content, can cover the last list item (need bottom padding).

```
┌─────────────────────────────┐
│  Pockaa            🔔  👤   │ ← top bar
├─────────────────────────────┤
│                             │
│  Recent                     │
│  ┌───────────────────────┐  │
│  │ 📰 Article title…     │  │
│  │ source • 4 min        │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📰 Article title…     │  │
│  └───────────────────────┘  │
│                             │
│                      ╭───╮  │
│                      │ + │  │ ← FAB (primary color)
│                      ╰───╯  │
├─────────────────────────────┤
│  🏠 Home  🔍 Search  📦 Arch│ ← bottom nav (unchanged)
└─────────────────────────────┘
```

---

## Variant B — Center "+" in bottom nav (notched)

Pros: always visible, no overlap with content, clear primary action.
Cons: replaces a nav slot OR adds a 4th item; visually heavier.

```
┌─────────────────────────────┐
│  Pockaa            🔔  👤   │
├─────────────────────────────┤
│                             │
│  Recent                     │
│  ┌───────────────────────┐  │
│  │ 📰 Article title…     │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📰 Article title…     │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│ 🏠       🔍   ╭─╮   📦      │
│ Home   Search │+│  Archive  │ ← raised + center button
│               ╰─╯           │
└─────────────────────────────┘
```

---

## Variant C — "+" in top app bar

Pros: cheap to ship, doesn't touch nav, mirrors desktop sidebar.
Cons: less reachable on tall phones (top-right thumb stretch).

```
┌─────────────────────────────┐
│  Pockaa         + 🔔  👤   │ ← + in top bar
├─────────────────────────────┤
│  Recent                     │
│  ┌───────────────────────┐  │
│  │ 📰 Article title…     │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📰 Article title…     │  │
│  └───────────────────────┘  │
├─────────────────────────────┤
│  🏠 Home  🔍 Search  📦 Arch│
└─────────────────────────────┘
```

---

## Variant D — Hybrid: FAB + Share-Sheet entry

Same FAB as Variant A, plus enabling iOS/Android share-sheet so user
can "Share → Pockaa" from any browser/app. PWA share_target manifest.

```
Browser (Safari/Chrome)        Pockaa PWA
┌──────────────┐               ┌──────────────────────────┐
│  example.com │               │  Save bookmark            │
│   ...        │  Share →      │  ────────────────────────│
│              │   ┌─────┐     │  URL: https://example… │
│   [Share]────┼──▶│ 🅿  │────▶│  Tags: [+ add tag]        │
│              │   └─────┘     │  [ Save ]   [ Cancel ]   │
└──────────────┘               └──────────────────────────┘
                ↑
        "Pockaa" appears
        in OS share sheet
```

Pros: matches how people actually browse on mobile; closest to "extension on desktop".
Cons: needs PWA `share_target` + handler route; more work.

---

## After tap — what the add sheet looks like (shared by all variants)

Bottom-sheet (mobile-friendly modal):

```
┌─────────────────────────────┐
│  ───                        │ ← drag handle
│                             │
│  Save bookmark         ✕   │
│  ─────────────────────────  │
│                             │
│  URL                        │
│  ┌───────────────────────┐  │
│  │ https://             │  │
│  └───────────────────────┘  │
│                             │
│  Tags (optional)            │
│  [ react ] [ + add ]        │
│                             │
│        [   Save   ]         │
└─────────────────────────────┘
```

---

## Recommendation

**Variant A (FAB) + Variant D (share target)** — A ships fast, D unlocks
the real mobile use-case (saving from the browser). Variant B is fine if
you want a more "appy" feel and don't mind the nav rework.
