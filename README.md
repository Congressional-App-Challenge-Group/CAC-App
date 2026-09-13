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

Four capabilities make the product's promises true. They are the base every other feature sits on.

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

### 3. Matter resolution and deadlines

Agenda records state what appeared at a meeting but usually leave the outcome blank, which is why
most tracked items sat at "Under review" with no way to move. The government's own matter register
fills that in, and every CivicLens id already carries the id needed to join to it
(`charlotte-legistar:29968` is Legistar matter 29968), so `scripts/enrich-matters.ts` joins directly
rather than guessing.

From that register each record gains its published stage, the date of its next scheduled action, the
party the register names as the requester, and its cost when one is stated. `src/lib/deadlines.ts`
turns the date into a countdown.

**The deadline rule:** a countdown is only ever shown for a date the record itself states. CivicLens
does not compute comment windows the government has not published, so an item with no stated date
reports "no date on record" rather than a confident guess.

Because resolution rewrites hundreds of previously blank fields at once, `enrich-matters` writes a
marker naming the exact records and fields it touched. Change detection consumes it and holds those
fields back from the movement feed — a dataset upgrade is not public movement, and reporting it as
hundreds of "changes" would make the feed meaningless on the first run.

### 4. Plain-language drafts (`decision_drafts`)

Drafts are generated from the record's own wording — either by a configured model or by
deterministic templates that can only recombine text present in the record. **Generated text is
never public.** A draft is created as `pending` and becomes readable only after an editor approves
it in `/admin/drafts`. If no draft is approved, the page shows the raw record wording and says so.

## Pipeline

```bash
pnpm ingest:local        # fetch records into .civiclens/local-decisions.json
pnpm enrich:matters      # resolve outcomes, dates, requesters, costs from the government register
pnpm enrich:geography    # match records against the official geospatial dataset
pnpm changes             # snapshot + diff -> .civiclens/changes.json
pnpm enrich:language     # create pending plain-language drafts
pnpm deadlines           # print upcoming deadlines and the disclosure gap
pnpm pipeline            # ingest:local + enrich:matters + changes + enrich
```

Order matters in `pnpm pipeline`: change detection runs **after** matter resolution, so the
pipeline's own re-resolving is held back instead of reported as movement.

`pnpm ensure:data` (run before `dev` and `build`) executes ingest → matters → geography → changes,
and never fails the build on an upstream outage.

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

The evidence page uses `revalidate = 600`, since its figures change only when the record set does.

## Surfaces

The product has two modes, and they answer different questions.

| Route | Mode | Question it answers |
| --- | --- | --- |
| `/` | both | The brief: what is next, and what just moved |
| `/deadlines` | deadline | What is about to be decided, and how long is left |
| `/changes` | tracker | What has moved since the last ingestion run |
| `/evidence` | neither | What the records omit — computed, not editorial |
| `/explore` | tracker | Everything indexed, filtered |
| `/decisions/[slug]` | both | One decision: countdown, record, sources, participation |
| `/my-area`, `/following` | both | Narrowed by saved location and follows |

`/evidence` is generated by `src/lib/disclosure.ts`. Every measure uses its own denominator — money
only against records that move money, scheduling only against records still open — and the page
prints an auto-generated scope sentence naming the exact record count and sources. The figures
describe the indexed set and never generalise to local government as a whole.

## Editorial rules

- No generated text reaches a public page without explicit editor approval.
- A location is asserted only when it traces to an official dataset or the record's own wording.
- A countdown is shown only for a date the official record publishes. Comment windows are never
  derived, because only the meeting body sets them.
- Unknown affected groups, ZIP codes, costs, next steps, and dates stay empty rather than guessed.
- An agenda appearance is not treated as approval, and a deferral is not treated as a decision.
- A withdrawal is recorded as withdrawn — not as a rejection, and not as still pending.
- A gap is measured no more broadly than the data supports, and named as the government's omission
  only where that was verified against the publisher's own register.
- The linked government record is always authoritative.

## Verify

```bash
pnpm typecheck
pnpm test     # normalizer, geography matcher, change engine, deadline engine, disclosure report
pnpm build
pnpm deadlines   # prints the two product claims straight from the dataset on disk
```

CI (`.github/workflows/ci.yml`) runs typecheck and tests on every push and pull request.
