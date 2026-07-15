# CivicLens

CivicLens tracks source-backed decisions from the City of Charlotte, Mecklenburg County, and Charlotte-Mecklenburg Schools. Public pages read verified decisions, sources, and timelines from Supabase; there are no fictional fallback records.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Apply both SQL files in order:

1. `supabase/migrations/202607140001_civiclens_foundation.sql`
2. `supabase/migrations/202607150001_live_ingestion.sql`

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to browser code.

## Daily ingestion

```bash
pnpm ingest
INGEST_SOURCE=charlotte-legistar pnpm ingest
```

Configured sources:

- Charlotte Legistar: meeting and agenda-item extraction
- Mecklenburg County Legistar: meeting and agenda-item extraction
- CMS BoardDocs: official index snapshot and link discovery; items remain staged until its item parser is validated

The job stores source snapshots, hashes, and normalized candidates. Candidates are private by default. `AUTO_PUBLISH_INGESTION=true` publishes substantive Legistar items and appends source-backed timeline events; enable it only after reviewing target-project results.

`.github/workflows/daily-ingestion.yml` runs daily at 10:17 UTC. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets. Keep its `AUTO_PUBLISH_INGESTION` repository variable unset until validation is complete.

## Lifecycle

- Every public surface consumes the same Supabase records.
- Stage, organization, topic, personalization, and recency filters operate on active records.
- Source hashes distinguish real changes from unchanged documents.
- `archive_stale_decisions()` hides approved/rejected/funded/completed items 60 days after approval.
- Archived records retain their permanent page, sources, and timeline.
- Active `Implementation` records are not automatically archived.

An agenda appearance is not treated as approval. Unknown affected groups, ZIP codes, costs, and next steps remain empty rather than being guessed. The linked government record is authoritative.

The admin area is intentionally read-only until Supabase authentication and editorial role claims protect mutations.

## Verify

```bash
pnpm exec tsc --noEmit
pnpm build
```
