# CivicLens — Local development & Vercel deploy

Quick steps to run locally and deploy to Vercel.

Local (development)

1. Copy example env and fill values from your Supabase project:

```bash
cp .env.example .env.local
# edit .env.local and set values for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

2. Install and run dev server:

```bash
pnpm setup
pnpm dev
```

Production (local build & serve)

```bash
pnpm build
pnpm start
```

Vercel deployment checklist

- Remove or update any custom `vercel.json` that targets static/Vite builds (this project uses Next.js).
- Ensure the following env vars are set in the Vercel project settings (do NOT commit secrets):
  - `NEXT_PUBLIC_SUPABASE_URL` (public)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- Confirm `package.json` contains `build` and `dev` scripts (uses `pnpm`).
- Link the repo to Vercel via the dashboard or `vercel` CLI and trigger a deploy.

Deploy via Vercel CLI (optional):

```bash
# install vercel CLI if needed
pnpm add -g vercel
# from repo root
vercel login
vercel --prod
```

Notes

- Keep `.env.local` out of source control. Use Vercel's Environment Variables UI for production secrets.
- If you want, I can also run a production build locally to validate the output — let me know.
# CivicLens MVP

CivicLens is a mobile-first civic decision tracker for Charlotte, Mecklenburg County, and CMS. This MVP uses clearly labeled fictional demonstration data and mocked assistant responses—no claims describe current government activity.

## Run locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Supabase variables can remain blank for the seeded guest-mode demo. Guest preferences and follows use local storage as requested.

## Production setup

1. Create a Supabase project and run `supabase/migrations/202607140001_civiclens_foundation.sql`.
2. Fill in `.env.local` using `.env.example`.
3. Replace the temporary admin flow with Supabase role claims before exposing write operations.
4. Deploy to Vercel; the project uses standard Next.js build/start commands.

## Architecture

- `src/data`: 12 fictional seeded decisions (4 per organization)
- `src/features`: decisions, timeline, search, personalization, assistant, admin
- `src/lib`: Zod validation and Supabase client boundary
- `src/server`: interfaces for future source monitoring, summarization, and retrieval
- `supabase/migrations`: PostgreSQL schema, relationships, RLS policies
- `public`: manifest, icon, and basic offline service worker

## Quality and safety

Run `pnpm build` for strict TypeScript and production validation. All assistant answers are deterministic and cite demo sources. Unknown cost questions use the required “cannot confirm” fallback. Live scraping and AI are intentionally not included.
