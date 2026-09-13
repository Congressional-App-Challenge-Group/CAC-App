# CivicLens

CivicLens tracks source-backed decisions from the City of Charlotte, Mecklenburg County, and
Charlotte-Mecklenburg Schools. Public pages read verified decisions, sources, and timelines from
Supabase; there are no fictional fallback records.

**The promise:** local decisions, rewritten in plain language, placed on a map, and linked to the
official record — with changes reported as they happen. Where a record does not confirm something,
CivicLens leaves it blank rather than guessing.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Apply the SQL files in order:

1. `supabase/migrations/202607140001_civiclens_foundation.sql`
2. `supabase/migrations/202607150001_live_ingestion.sql`
3. `supabase/migrations/202608290001_auth_roles.sql`
4. `supabase/migrations/202609010001_civiclens_spine.sql`

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and the
server-only `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to browser code.

## The spine

Three capabilities make the product's promises true. They are the base every other feature sits on.

### 1. Geography (`decision_geography`)

Every record is matched against an official geospatial dataset — the City of Charlotte publishes a
"Rezoning History" inventory on data.charlottenc.gov. The matcher (`src/lib/geography.ts`) works in
descending order of trust:

| Method | Confidence | Meaning |
| --- | --- | --- |
| `petition-match` | exact | Petition number matched a row in the official dataset |
| `address-match` | exact | Street address matched a row in the official dataset |
| `record-text` | likely | A ZIP stated verbatim in the record (no coordinates) |
| `none` | unconfirmed | Nothing supports a location |

A location is never inferred. Unmatched records render as "location not confirmed".

### 2. Change detection (`decision_changes`)

Each ingestion run snapshots the record set and diffs it against the previous snapshot
(`src/lib/changes.ts`). Stage changes, new official actions, and revised next steps are recorded as
explicit change rows — that is what "changed this week", the movement log, and any future
notification digest read from.

A first run establishes a baseline and reports nothing: a first appearance is a publication, not a
movement.

### 3. Plain-language drafts (`decision_drafts`)

Drafts are generated from the record's own wording — either by a configured model or by
deterministic templates that can only recombine text present in the record. **Generated text is
never public.** A draft is created as `pending` and becomes readable only after an editor approves
it in `/admin/drafts`. If no draft is approved, the page shows the raw record wording and says so.

## Pipeline

```bash
pnpm ingest:local        # fetch records into .civiclens/local-decisions.json
pnpm changes             # snapshot + diff -> .civiclens/changes.json
pnpm enrich:geography    # match records against the official geospatial dataset
pnpm enrich:language     # create pending plain-language drafts
pnpm pipeline            # ingest:local + changes + enrich
```

`pnpm ingest` runs the full Supabase-backed job (storing snapshots, hashes, and candidates);
`pnpm ingest:publish` additionally publishes substantive Legistar items. Keep
`AUTO_PUBLISH_INGESTION` unset until candidate review is validated.

`.github/workflows/daily-ingestion.yml` runs daily at 10:17 UTC. Add `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `CHARLOTTE_REZONING_LAYER_URL` as GitHub Actions secrets.

**Enrichment is deliberately not part of `pnpm build`.** Model calls and network ingestion in the
build would make builds slow, costly, and non-deterministic. Run them as jobs.

## Rendering

Public pages use ISR (`revalidate = 300`) rather than `force-dynamic`. Pages were previously
rendered on every request, which cost performance and SEO. After an ingestion run, revalidate with
the `decisions` tag.

## Editorial rules

- No generated text reaches a public page without explicit editor approval.
- A location is asserted only when it traces to an official dataset or the record's own wording.
- Unknown affected groups, ZIP codes, costs, and next steps stay empty rather than being guessed.
- An agenda appearance is not treated as approval.
- The linked government record is always authoritative.

## Verify

```bash
pnpm typecheck
pnpm test     # unit tests for the normalizer, geography matcher, and change engine
pnpm build
```

CI (`.github/workflows/ci.yml`) runs typecheck and tests on every push and pull request.
