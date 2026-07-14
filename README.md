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
