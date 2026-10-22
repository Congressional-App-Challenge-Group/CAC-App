# CivicLens Engineering Audit — mission of 2026-10-20

Autonomous implementation pass over the roadmap in
[civiclens-improvement-audit.md](civiclens-improvement-audit.md) plus a fresh
skeptical review. Evidence-based: nothing is marked verified that was not
executed in this environment. Baseline before any change: typecheck 0 errors,
192/192 tests, build exit 0.

## A. Executive summary

**What materially improved**

1. **/ask now answers across the whole verified index.** A new retrieval layer
   (`src/lib/ask-retrieval.ts`) interprets topic/status/date-window/district
   criteria deterministically; the service composes grounded answers where
   before it refused everything without a picked record.
2. **A weekly District Brief exists** (`/places/[kind]/[code]/brief`) — a
   printable, print-CSS-styled product surface composed only from placed
   records, with generation and window stamps.
3. **The watchlist tells the truth about notifications**: a real
   "changes since your last visit" card (device-local timestamp) replaced an
   implied email-notification promise.
4. **A publication-gate hole was closed**: with `AUTO_PUBLISH_INGESTION=true`,
   *pending, never-reviewed* candidates were being published. Now only
   explicitly approved candidates publish.
5. **Light theme became coherent** across the observatory homepage instead of a
   light hero over a dark page.
6. **Optional device-position district lookup** added, anchored to the county's
   own address file, never required, never stored.

**What CivicLens can now do that it could not before:** answer "what's
scheduled for a vote this month?" (and ZIP/topic variants) with a count, a
bounded list, citations, and an explicit incompleteness disclosure; produce a
one-click printable district brief; show watchlist movement since the last
visit; and safely keep auto-publish on.

**Biggest remaining risks:** Spanish drafts unshipped (P3, gate-safe reason);
no rate limiting on public POST/PUT endpoints (documented, low judge risk);
light theme on /admin and detail pages checked only by CSS review.

**Ready for a hackathon demo? Yes.** Every scripted beat works, refusals are
honest, and the dataset fallback is provenance-verified (816/816 records carry
verified official source URLs).

## B. Original audit items — status table

| Item | Before | Changed | Files | Tests run | Observed outcome | Status | Limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cross-record Q&A | refuse without decisionId | deterministic scope interpretation + retrieval + grounded composer with citations and three distinct failure modes | [ask-retrieval.ts](src/lib/ask-retrieval.ts), [assistant.ts](src/server/assistant.ts), [route.ts](src/app/api/ask/route.ts), [types](src/types/index.ts), [page copy](src/app/ask/page.tsx), [ask-box.tsx](src/features/assistant/ask-box.tsx) | 15 unit tests + live API | "vote this month" → 5 real dated records with sources; opinion → refusal; ZIP 99999 → searched-not-found with index count; "my area" without ZIP → no-inference answer | **VERIFIED** | LLM paraphrase not used by design; keyword scope only |
| District Brief | absent | new ISR page + print stylesheet + Print client component | [brief/page.tsx](src/app/places/[kind]/[code]/brief/page.tsx), [editorial.css](src/app/editorial.css), [print-button.tsx](src/features/brief/print-button.tsx) | typecheck; browser desktop + mobile | renders real data (District 2: Oct 19 approval on Rezoning 2026-029 with official source link, honest empty calendar, truly-open list); mobile: no horizontal overflow | **VERIFIED** | exact print rendering not checked (no OS print target) |
| Notification alignment | implied promise | device-local last-visit stamp + filtered change counter + copy fix | [last-visit.ts](src/lib/last-visit.ts), [changes-since-visit.tsx](src/features/following/changes-since-visit.tsx), [api/changes/recent](src/app/api/changes/recent/route.ts), [following/page.tsx](src/app/following/page.tsx), [brief.tsx](src/features/brief/brief.tsx) | typecheck; route 200 x2 | /following 200; recent API 200; card gated to non-empty watchlists; first-visit baseline text; zero is a stated real answer | **IMPLEMENTED BUT NOT FULLY VERIFIED** | counter UI not yet observed with follows set (needs an interactive follow) |
| Mobile district finder | typed-address only | opt-in "Use my device location" → `PUT /api/place` → nearest county-record address anchor → same district resolver; full permission/denial/timeout messaging | [place.tsx](src/features/place/place.tsx), [place.ts (server)](src/server/place.ts), [api/place/route.ts](src/app/api/place/route.ts) | typecheck | browser geolocation grant flow not testable in this environment; typed-address flow untouched and verified earlier | **IMPLEMENTED BUT NOT FULLY VERIFIED** | coords→EPSG:2264 envelope math is approximate; nearest-match radius disclosed to the user |
| Candidate review safety | auto-publish published pending candidates | gate now requires `review_status === "approved"` | [ingestion/run.ts](src/ingestion/run.ts) | 207/207 tests after change | regression suite green; live Supabase run not available locally | **IMPLEMENTED BUT NOT FULLY VERIFIED** | full publish path needs a configured Supabase environment |
| Light theme | light hero over dark page | full observatory section remap + scope-line contrast fix | [editorial.css](src/app/editorial.css) | browser screenshot | story section now reads as one paper document in light mode | **VERIFIED (homepage)** | /admin + decision pages CSS-reviewed only |
| Spanish drafts | absent | **not implemented deliberately**: adding a DraftField requires a DB migration, and the numeric/stage approval gate is English-keyed — shipping without re-validating the gate would publish unreviewed wording against the project's own first rule | — | — | — | **NOT IMPLEMENTED (blocked, documented)** | record the gate redesign as the follow-on |
| Calendar subscription | already existed | verified rather than rebuilt | [api/calendar](src/app/api/calendar/[slug]/route.ts) | live curl | valid VCALENDAR, all-day DTSTART/DTEND (no invented times), stable UID, attachment/content-type headers correct; no-date records already return an explanatory 404 | **VERIFIED** (already implemented) | — |
| Infra reliability | probed | `prepare-data.ts` already keeps the last good dataset on step failure (exit 0, quoted failure output) — no change needed; `.civiclens/` snapshot verified as genuine (816/816 verified-source records, Legistar URLs, snapshots dir) | — | artifact inspection | cold-build failure keeps a usable dataset; snapshot provenance recorded | **VERIFIED** | — |

## C. Additional technical findings

1. **Pending candidates could auto-publish (HIGH).** Found by reading the
   ingestion publish condition: the only block was `review_status === "rejected"`,
   so `AUTO_PUBLISH_INGESTION=true` published every *unreviewed* item (new
   candidates default to pending). Fixed to require explicit approval.
   Evidence: [ingestion/run.ts](src/ingestion/run.ts) diff + 207/207 tests.
   Residual risk: verified live only in Dev-observable paths.
2. **Light theme rendered a light hero over a dark page (MEDIUM).** Found
   visually in the browser. Fixed with a full section remap; verified by
   screenshot. Residual: interior pages.
3. **/ask once had `answerAcrossRecords` missing from its interface (LOW,
   transient)** — caught by typecheck within the pass; no shipping impact.
4. **Scattered small transient errors** (unused destructures, a missing import,
   an over-broad regex) — all caught by typecheck/tests and fixed in-pass; the
   final state has typecheck 0 and tests 207/207.
5. **Known-accepted, not fixed:** no rate limiting on /api/place and /api/ask
   (single-tenant demo scale; documented); the exact-134-line gate for cross-
   record answers caps at 5 records by policy; geolocation anchor math is a
   disclosed approximation.

## D. Modified-file inventory

**Created**
- [src/lib/ask-retrieval.ts](src/lib/ask-retrieval.ts) — deterministic cross-record query interpretation + retrieval
- [src/lib/ask-retrieval.test.ts](src/lib/ask-retrieval.test.ts) — 15 unit tests
- [src/lib/last-visit.ts](src/lib/last-visit.ts) — device-local visit stamp
- [src/features/following/changes-since-visit.tsx](src/features/following/changes-since-visit.tsx) — watchlist counter card
- [src/app/api/changes/recent/route.ts](src/app/api/changes/recent/route.ts) — bounded read-only change-log API
- [src/app/places/[kind]/[code]/brief/page.tsx](src/app/places/[kind]/[code]/brief/page.tsx) — District Brief page
- [src/features/brief/print-button.tsx](src/features/brief/print-button.tsx) — client island for browser print

**Modified** (additive or single-purpose)
- [src/server/assistant.ts](src/server/assistant.ts) — added `answerAcrossRecords` composer
- [src/app/api/ask/route.ts](src/app/api/ask/route.ts) — dispatch without decisionId to cross-record
- [src/types/index.ts](src/types/index.ts) — service interface extension (+answer fields)
- [src/app/ask/page.tsx](src/app/ask/page.tsx), [src/features/assistant/ask-box.tsx](src/features/assistant/ask-box.tsx) — copy + cross-record suggestion chips
- [src/server/place.ts](src/server/place.ts) — `nearestPlace` (opt-in geolocation anchor)
- [src/app/api/place/route.ts](src/app/api/place/route.ts) — `PUT /api/place`
- [src/features/place/place.tsx](src/features/place/place.tsx) — "Use my device location" UI
- [src/app/following/page.tsx](src/app/following/page.tsx) — card placement
- [src/features/brief/brief.tsx](src/features/brief/brief.tsx) — notification copy made true
- [src/ingestion/run.ts](src/ingestion/run.ts) — publication gate fix
- [src/app/editorial.css](src/app/editorial.css) — brief styling + light-theme remap + print CSS

**Preserved pre-existing work:** the 5 modified-by-earlier-session files
([design-evolution-log.md](design-evolution-log.md),
[src/app/editorial.css](src/app/editorial.css),
[src/features/brief/legal-observatory-scene.tsx](src/features/brief/legal-observatory-scene.tsx),
[src/features/brief/observatory-story.tsx](src/features/brief/observatory-story.tsx),
[src/features/brief/observatory.tsx](src/features/brief/observatory.tsx)) kept
their earlier changes intact; nothing was deleted, renamed or moved; no
commits; `.tmp-*` files untouched per the no-cleanup constraint.

## E. Verification matrix

| Check | Executed | Result | Establishes | Does not establish |
| --- | --- | --- | --- | --- |
| `pnpm typecheck` | yes | 0 errors (re-run ≥5 times during pass) | type-correct | runtime safety |
| `pnpm test` (incl. new 15) | yes | 207 pass / 0 fail | deterministic scope/retrieval behavior meaningful | Supabase/live Legistar behavior |
| `pnpm build` (prod) | yes | exit 0, full SSG manifest | ships standalone, no runtime fetch dependency | deployed-runtime SSG equivalence |
| POST /api/ask (live) | yes | 200 + real matched set | cross-record answers against the real 816-record set | model-mode answer quality (unused) |
| POST /api/ask refusal set (live) | yes | refusal/not-found/no-inference texts | honoring grounding rules | — |
| GET /api/changes/recent (live) | yes | 200 | client feed accessibility | — |
| GET /api/calendar/…13017 (live) | yes | 200, valid ICS body, headers | calendar export correctness | third-party calendar app parsing |
| /places/council/2/brief (browser) | yes | 200 desktop and mobile, real content, no overflow | Brief works from real data | exact print-media output |
| light theme (browser) | yes | coherent homepage, screenshot | main surfaces are usable | every component incl. admin |
| following page (browser) | yes | 200, empty-state correct | page + gating | populated watchlist state |
| geolocation flow | **no** | env cannot grant browser permissions | — | denial/timeout UI response |
| reduced motion | code-level only | no emulation available | CSS/JS guards present | actual emulator behavior |

## F. API and security review

- **`POST /api/ask`** — input parsed inside try/catch, trimmed, empty rejected
  (400); routes per-decision or cross-record; retrieval filters only
  deterministic structured fields (never model-decided); answers composed from
  record text only, treated as data (never instructions); record count
  disclosure prevents a partial list reading as exhaustive; no user PII logged.
- **`PUT /api/place`** — new; strictly optional; no storage, no third-party;
  coordinates arrive in body (not URL/query) so they stay out of access logs;
  county-window bounded so far-away positions are refused as not-in-county,
  honestly.
- **`GET /api/changes/recent`** — read-only, bounded (limit ≤ 200, days ≤ 365),
  failure returns empty list with `ok:false` never zero-as-truth.
- **`GET /api/calendar/[slug]`** — unchanged (verified).
- **Admin endpoints** — untouched; publication gate on the ingestion side now
  requires explicit `approved` status server-side (independent of UI).
- **Rate limiting** — none on public endpoints (risk accepted for demo scale,
  documented in the original audit too).

## G. Production and demo readiness

- **Supabase failure path:** verified by architecture — `getDecisions` falls
  back to `.civiclens/local-decisions.json` (the artifact just
  provenance-verified as 816/816 verified-source). Cannot be tested live here
  (no local Supabase); "IMPLEMENTED BUT NOT FULLY VERIFIED" status from the
  original audit clearly applies to cross-service behavior.
- **Legistar failure path:** `prepare-data.ts` keeps the last good dataset and
  exits 0; failures are quoted into the build log. Since the fallback artifact
  already exists, a cold build on a flaky network still yields a usable site.
- **Stale-data badge:** no user-facing env or fetch-date disclosure yet — the
  brief carries generation/window stamps which is the strongest current
  freshness signal on a page surface.
- **Deployed-environment limits:** no Vercel production deployment was made or
  tested this pass (auth and time).

## H. Remaining risks / next steps (ranked)

1. **Rate limiting + calendar caching headers** (low effort, safety).
2. **Spanish drafts** — requires one SQL migration + gate redesign; document as
   roadmap item, do not ship half-built.
3. **Light theme /admin + decision detail** — visual pass only; likely small.
4. **Geolocation anchor math** — replace approximate envelope with a
   proper projection or true per-row distance query when GIS semantics allow.
5. **Email digest** — genuinely new subsystem; do not add for its own sake.

## I. Final integrity statement

- **No cleanup performed.** No file was deleted, renamed or moved.
- **No sync commits.** Working tree retained all modifications.
- **Pre-existing edits preserved in full**, including the 5 files previously
  changed by the interaction passes and the `.tmp-*` artifacts.
- **No secrets exposed** in logs or audit (county URL is public; no
  credentials handled).
- **Snapshot fallback** is the existing local artifact set, verified genuine
  by source URL + verification_status, not fabricated.
