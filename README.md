# Pockaa

A full-featured bookmark manager inspired by Pocket — save, read, and organize articles with AI-powered summaries.

## Tech Stack

- **Next.js 15+** (App Router, Server Actions, Route Handlers)
- **TypeScript**
- **shadcn/ui + Tailwind CSS**
- **Drizzle ORM**
- **Supabase** (Postgres)
- **Clerk** (Authentication)
- **Vercel AI SDK** (AI Summarization)

## Features

- 🔖 **Save URLs** — auto-extract title, description, and OG image
- 🏷️ **Tags & Collections** — organize bookmarks your way
- 🔍 **Full-text Search** — search across all saved content
- 📖 **Reader Mode** — clean, distraction-free article view
- 🤖 **AI Summarization** — generate concise summaries with one click
- ✨ **Highlights & Annotations** — highlight text and add notes
- 🧩 **Browser Extension** — save articles from any webpage (Chrome)

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd AnotherPocketClone
npm install
```

### 2. Configure Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

You'll need:

- **Supabase**: Create a project at [supabase.com](https://supabase.com), copy the Postgres connection string
- **Clerk**: Create a project at [clerk.com](https://clerk.com), copy the publishable and secret keys
- **AI Summaries** (choose one):
  - **OpenRouter (default)**: Get an API key at [openrouter.ai](https://openrouter.ai), set `OPENROUTER_API_KEY` in `.env.local`, and leave `AI_PROVIDER=openrouter`
  - **OpenAI**: Get an API key at [platform.openai.com](https://platform.openai.com), set `AI_PROVIDER=openai` in `.env.local`
  - **Ollama (local)**: Install [Ollama](https://ollama.com), then run `ollama pull llama3.2:3b` and `ollama serve`, and set `AI_PROVIDER=ollama`

### 3. Set Up Database

Push the Drizzle schema to your Supabase database:

```bash
npx drizzle-kit push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

```bash
vercel
```

Set your environment variables in the Vercel dashboard.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Sign-in/sign-up pages (Clerk)
│   ├── (dashboard)/     # Main app pages
│   │   ├── page.tsx     # All bookmarks
│   │   ├── favorites/   # Favorite bookmarks
│   │   ├── archive/     # Archived bookmarks
│   │   ├── search/      # Search page
│   │   ├── tags/        # Tag management
│   │   └── collections/ # Collection management
│   ├── api/
│   │   ├── extract/     # URL metadata extraction
│   │   ├── summarize/   # AI summarization
│   │   └── extension/   # Browser extension API
│   └── read/[id]/       # Reader mode
├── components/
│   ├── bookmarks/       # Bookmark-related components
│   ├── layout/          # Sidebar, navigation
│   └── ui/              # shadcn/ui components
├── db/
│   ├── schema.ts        # Drizzle schema definitions
│   └── index.ts         # Database connection
└── lib/
    ├── actions.ts       # Server actions (CRUD, search, etc.)
    ├── extract.ts       # URL metadata extraction
    └── utils.ts         # Utility functions
```

## Browser Extension

A Chrome extension is included in `/extension`. To install:

1. Set `EXTENSION_API_KEY` in your `.env.local` (any random secret string)
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `extension/` folder
5. Click the extension icon, configure your app URL, API key, and Clerk user ID
6. Save any page with one click!

## Automated Twitter/X Bookmark Sync

Two ways to get your X bookmarks into the app:

**Manual export** — run the standalone exporter, then upload the JSON in the
import UI:

```bash
export X_AUTH_TOKEN="<auth_token cookie>"   # DevTools → Application → Cookies → x.com
export X_CSRF_TOKEN="<ct0 cookie>"
python3 scripts/export_bookmarks.py          # writes bookmarks_export/*.json
```

**Automated daily sync (Vercel Cron)** — a scheduled job fetches new bookmarks
server-side and ingests them automatically (incremental: it stops as soon as it
hits already-saved tweets, so daily runs are fast).

1. Set these env vars in Vercel (and `.env.local` for local testing):
   - `CRON_SECRET` — random secret; Vercel sends it as `Authorization: Bearer …`
   - `SYNC_USER_ID` — your Clerk user id (e.g. `user_xxx`) to attach bookmarks to
   - `X_AUTH_TOKEN` / `X_CSRF_TOKEN` — your `auth_token` / `ct0` cookies from x.com
2. The schedule lives in `vercel.json` (`0 3 * * *` = daily at 03:00 UTC).
3. Endpoint: `GET /api/cron/sync-twitter-bookmarks` (self-protected by `CRON_SECRET`).

Test it locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-twitter-bookmarks
```

> **Cookie refresh:** X session cookies expire eventually. When they do, the
> run returns HTTP 401 with a clear message — just re-copy fresh `auth_token`
> and `ct0` values into the env vars.

## License

MIT
