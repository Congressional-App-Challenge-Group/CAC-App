# CivicLens

[![Build check](https://github.com/Congressional-App-Challenge-Group/CAC-App/actions/workflows/build-check.yml/badge.svg)](https://github.com/Congressional-App-Challenge-Group/CAC-App/actions/workflows/build-check.yml)

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

**The place spine extends this from a ZIP code to an address and a district.** Once a record has
coordinates, `src/lib/place.ts` tests the point against the county's own boundary layers — city
council, county commission, school board, congressional, NC House, NC Senate and ZIP — and copies the
districts it falls inside onto the record, along with the sitting member's name and city email where
the county publishes one. All seven layers come from a single official server
(`meckgis.mecklenburgcountync.gov`), so the location, the district and the person to contact are not
assembled from unrelated datasets.

The same module answers the question a resident actually starts from. `/api/place` takes a typed
address, looks it up in the county's `MasterAddressPoints` file — the structured columns it is keyed
on, never a full-text search that would happily return 8231 Douglas Dr for 8212 — and returns every
district containing that point. Every failure mode is distinct and explained: a typo, an address the
county has never recorded, a street that exists in both directions, and an unreachable server need
different next steps. Nothing is inferred from the ZIP code alone.

Geometry is generalised to ~11 m at build time (5.5 MB → ~0.4 MB) and the imprecision is declared in
the artifact rather than assumed away. Record-level district matching reads the codes already stored
on each record, so the address lookup alone depends on that file.

### 2. Change detection (`decision_changes`)

Each ingestion run snapshots the record set and diffs it against the previous snapshot
(`src/lib/changes.ts`). Stage changes, new official actions, and revised next steps are recorded as
explicit change rows — that is what "changed this week", the movement log, and any future
notification digest read from.

A first run establishes a baseline and reports nothing: a first appearance is a publication, not a
movement.

### 3. Matter identity, resolution and deadlines

**One petition was being counted once per meeting it touched.** Charlotte's Legistar assigns a brand
new Matter id to every agenda appearance of the same petition, so `Rezoning Petition: 2025-036 by
Rangeworks` existed as ten different "decisions" across ten meetings — which inflated the headline
count and is why so much of the set sat at "Under review" forever: an agenda appearance never states
an outcome, and the outcome belongs to the matter, not the appearance.

`src/lib/matter.ts` establishes a canonical identity for a record — the petition or case number in
the title where there is one, the matter id otherwise — and `scripts/collapse-matters.ts` merges
appearances into one published matter, recording a retired slug for each merged id so a link shared
beforehand still lands somewhere true. Genuine meeting notices are set aside and listed in
`.civiclens/excluded.json` so the exclusion is auditable. The collapse is idempotent: run against an
already-collapsed set it carries the alias and exclusion artifacts forward rather than recomputing
them, so history is never destroyed.

Agenda records state what appeared at a meeting but usually leave the outcome blank, which is why
most tracked items sat at "Under review" with no way to move. The government's own matter register
fills that in, and every CivicLens id already carries the id needed to join to it
(`charlotte-legistar:29968` is Legistar matter 29968), so `scripts/enrich-matters.ts` joins directly
rather than guessing. It resolves across *every* appearance id a matter has, so a merged petition
reports the matter's real standing rather than one meeting's stage.

From that register each record gains its published stage, the date of its next scheduled action, the
party the register names as the requester, and its cost when one is stated. `src/lib/deadlines.ts`
turns the date into a countdown.

**The deadline rule:** a countdown is only ever shown for a date the record itself states. CivicLens
does not compute comment windows the government has not published, so an item with no stated date
reports "no date on record" rather than a confident guess.

Because resolution rewrites hundreds of previously blank fields at once, `enrich-matters` writes a
marker naming the exact records and fields it touched. Change detection consumes it and holds those
fields back from the movement feed — a dataset upgrade is not public movement, and reporting it as
hundreds of "changes" would make the feed meaningless on the first run. The collapse re-baselines the
snapshot for the same reason: changing the record *model* is not movement either.

### 4. Plain-language drafts (`decision_drafts`)

Drafts are generated from the record's own wording — either by a configured model or by
deterministic templates that can only recombine text present in the record. **Generated text is
never public.** A draft is created as `pending` and becomes readable only after it has passed the
approval gate, either the automated one below or an editor in `/admin/drafts`.

`pnpm approve:drafts` is that gate, and it is built to *refuse* rather than repair — a job that
approves its own output is a formality, not a review. It checks the things that can be checked
mechanically and withholds the draft with a stated reason when one fails:

- every digit sequence in the draft must appear in the record's own text or dates, so no summary
  can state a figure the record never stated;
- a stage claim ("approved", "withdrawn", "deferred") must match the record's own status, unless
  the word appears in the title, where it is the government's wording rather than CivicLens's;
- a summary that names no subject and quotes no record text is refused, because it restates the
  filing category instead of the decision.

Against the current dataset that is 1,457 approvals and 68 refusals out of 1,525 drafts, leaving
692 of 760 records with a reviewable summary. The 68 keep the agency's own wording, and their pages
say so. The badge for an approved record reads **"Plain language"**, not "editor-reviewed": the
review is this gate, which is automated, and claiming a person read it would be one more thing the
interface asserts that it cannot support.

## Pipeline

```bash
pnpm ingest:local        # fetch records into .civiclens/local-decisions.json
pnpm collapse            # merge agenda appearances into one record per matter
pnpm enrich:matters      # resolve outcomes, dates, requesters, costs from the government register
pnpm enrich:geography    # match records against the official geospatial dataset + bundle districts
pnpm changes             # snapshot + diff -> .civiclens/changes.json
pnpm enrich:language     # create pending plain-language drafts
pnpm approve:drafts      # editor gate: approve what the record supports, refuse and report the rest
pnpm deadlines           # print upcoming deadlines and the disclosure gap
pnpm pipeline            # ingest:local + collapse + enrich:matters + changes + enrich
```

Order matters in `pnpm pipeline`: the collapse runs **before** matter resolution so the register is
queried once per matter instead of once per appearance, and change detection runs **after** both, so
the pipeline's own rewrites are held back instead of reported as movement.

`pnpm ensure:data` (run before `dev` and `build`) executes ingest → collapse → matters → geography →
changes → **enrich:language → approve:drafts**, and never fails the build on an upstream outage. A
step that dies quotes its own last four lines of output into the summary, because a step failing
leaves the dataset in the previous step's state — which looks fine at a glance.

The two drafting steps are in the build path deliberately. A fresh clone has no drafts at all, so a
deploy that skipped them would publish every record in the agency's own wording while the interface
still said "rewritten in plain language", with nothing on the page to show that anything was
missing. Both are deterministic and take seconds, because the build passes them
`ENRICHMENT_API_KEY=""`: build-time drafting is the template path and can never call a paid model,
so a release cannot spend money or publish phrasing nobody has read.

`pnpm collapse` and `pnpm enrich:matters` report a run against already-processed input as such,
rather than reporting zeroes that look like a failure.

`pnpm ingest` runs the full Supabase-backed job (storing snapshots, hashes, and candidates);
`pnpm ingest:publish` additionally publishes substantive Legistar items. Keep
`AUTO_PUBLISH_INGESTION` unset until candidate review is validated.

`.github/workflows/daily-ingestion.yml` runs daily at 10:17 UTC. Add `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `CHARLOTTE_REZONING_LAYER_URL` as GitHub Actions secrets.

**Model enrichment is deliberately not part of `pnpm build`.** A model call in the build would make
it slow, costly, and non-deterministic. Run it as a job. The deterministic drafting and approval
steps above are in the build path for the reason given there.

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
| `/places/[kind]/[code]` | both | One district: everything the record set places in it |

Two endpoints back those surfaces. `POST /api/place` resolves a typed address to a point and its
districts. `GET /api/calendar/[slug]` exports a record's dated steps as an `.ics` download —
deliberately as **all-day** events, because the record states a day and not a time, and inventing a
9am start would send a resident to an empty chamber.

`/places/[kind]/[code]` gives a district an address a neighbour can be sent. It reports how many of
the indexed records it can place in *any* district beside the count for this one, so a short list
reads as "quiet" rather than as a broken page.

## Taking part

`src/lib/action.ts` answers the question the tracker and the deadline engine both leave open. An
action is offered only when the official record supports it:

- No published date → no "attend the meeting" action, because there is no meeting to attend.
- No named representative with an address → no "write to them" action. Where a seat is named but the
  county publishes no address for it, the panel says exactly that instead of offering a dead link.
- An already-decided matter → no comment action at all, because the window has closed.

At most four actions are returned, because a list longer than that is not a plan. `commentStarter()`
produces a template filled in only from what the record states: the location is attributed to the
*record* ("the record places this at..."), never claimed as the writer's own home, and the writer's
name and ZIP are left as bracketed prompts. Generating an opinion and attributing it to a member of
the public would be the most dishonest thing this product could do.

A district can be followed as well as an item. `decision_follows` tracks one matter;
`place_follows` tracks a place, keyed by the same `kind:code` value as a shared district link, so a
standing question ("tell me when anything happens on my block") keeps working for records that did
not exist when it was set.

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
- A generated comment never asserts a fact about the writer. Location is attributed to the record.
- An action is offered only where the record supports the channel it uses; a missing representative
  address is stated rather than papered over with a link that goes nowhere.
- A calendar entry states a day when the record states a day. No start time is invented.
- A public number is only printed beside the denominator that makes it meaningful — a district's
  count sits next to how many records could be placed at all.
- The linked government record is always authoritative.

## Verify

```bash
pnpm typecheck
pnpm test     # normalizer, geography + place resolver, matter identity, change engine,
              # deadline engine, action layer, disclosure report
pnpm build
pnpm deadlines   # prints the two product claims straight from the dataset on disk
```

`pnpm collapse`, `pnpm enrich:matters` and `pnpm enrich:geography` all print their before/after
counts, so a run that resolved nothing is visible rather than silent. When working on the pipeline,
verify against an empty cache — `rm -rf .civiclens && FORCE_DATA_REFRESH=true pnpm ensure:data` —
because that is exactly what a cold CI or Vercel container sees.

GitHub Actions runs CI (`.github/workflows/ci.yml`) and the production build check
(`.github/workflows/build-check.yml`) on every pull request and every push to `main`.
