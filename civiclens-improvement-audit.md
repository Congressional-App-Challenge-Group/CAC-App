# CivicLens Improvement Audit — hackathon edition (2026-10-20)

Scope: everything suggested to make the project stronger for judges
(legislature people), not aesthetics — features, promise alignment, repo
hygiene, infra risk, demo strategy. Every claim is grounded in the code on
disk; each item carries effort, impact and priority.

## 0. Correction to an earlier assessment

`/ask` is NOT a stub. [src/server/assistant.ts](src/server/assistant.ts) is a
150-line grounded assistant + [src/app/api/ask/route.ts](src/app/api/ask/route.ts)
that answer per-decision questions (status, changes, impact, timeline, cost,
sources, why-it-matters) strictly from verified fields, citing official
sources, and refusing what the record doesn't confirm. What it truly lacks is
cross-record retrieval — see 1.1.

## 1. FEATURES — product gaps to build

### 1.1 Cross-record question answering on /ask (P0 — highest judge impact)
- **Today:** no `decisionId` → refusal ("pick a tracked decision…"). Judge
  asks "what's scheduled for vote in my district this month?" → dead end.
- **Build:** retrieval over the already-loaded decision set (topic, status,
  geography, dates, requester) + a composed answer from top matches, each
  cited; refuse when nothing matches. The per-decision answerer stays as the
  final composer per matched record.
- **Why:** demo moment #3 ("ask it something we didn't script") is where
  grounded refusal + real answers beats generic LLM demos.
- Effort M · Impact ★★★★★

### 1.2 District Brief — weekly printable pack per district (P1)
- One page per place (`/places/[kind]/[code]/brief`): what changed this week,
  upcoming published dates, each line sourced; print/PDF styling; opinion-free
  by construction (editorial rules already forbid invention).
- **Why:** judges are legislature people; give the council member's aide an
  artifact they'd actually use Monday morning. Mostly composing existing
  place/deadline/change data into one layout.
- Effort M · Impact ★★★★★

### 1.3 Notifications promise alignment (P1)
- Follow UI copy promises "notifications arrive once the movement engine has
  new changes" — no digest code exists (`grep digest` → only error.tsx).
- **Minimal honest build:** `/following` "moves since your last visit" counter
  (needs no email infra) + a cron-driven weekly email digest as stretch.
  Otherwise soften the copy — judges who read the repo notice overpromise.
- Effort S (M for email) · Impact ★★★★

### 1.4 Candidate review UI for auto-publish ingestion (P2)
- README: "Keep `AUTO_PUBLISH_INGESTION` unset until candidate review is
  validated" — no review surface exists. Fold candidate review into `/admin`
  (approve/reject pending Legistar items before publish).
- Effort M · Impact ★★ (demo) ★★★★ (credibility)

### 1.5 Spanish-language drafts (stretch, P3)
- Charlotte has a large Spanish-speaking community; plain-language pipeline
  could produce ES drafts through the same approval gate. High "impact" slide
  value; touches the drafting gate, so do after stable items.
- Effort L · Impact ★★★★

### 1.6 Light-theme consistency pass (P2)
- Dark is the designed default (a11y contrast in editorial.css is thorough for
  dark); audit light theme across observatory/instrument surfaces; keep the
  `ThemeToggle` honest rather than shipping two untested identities.
- Effort S-M · Impact ★★

### 1.7 District finder depth (P1)
- `/api/place` already exists and works from typed addresses; finish the
  touch equivalent for mobile (`navigator.geolocation` opt-in) so a judge can
  pull up someone's phone and show "your area" sorting working in one tap.
  Reuses existing place/personalization plumbing, zero backend changes.
- Effort S · Impact ★★★

### 1.8 Calendar subscribe button (P3)
- `/api/calendar/[slug]` (all-day `.ics`) exists; add a visible "subscribe to
  this record's dates" affordance on the decision page so the plumbing gets
  seen. Low effort, nice demo texture.
- Effort XS · Impact ★★

## 2. WHAT WE DELIBERATELY DO NOT SUGGEST

1. **No further visual polish** — 87/100; marginal judge value near zero vs
   the above. Motion system spans all sections and holds up.
2. **No more personalization depth** — ZIP/interests/follows/near-you already
   exist; "civic twin"-style gimmicks dilute the sober brand.
3. **No perf work** — 102kB shared JS, static routes; nothing to fix.
4. **No new dependencies** — `@supabase/ssr`, `@supabase/supabase-js`,
   `next`, `react`, `three`, `zod`, `lucide-react`, `@vercel/analytics` are
   sufficient.

## 3. REPO HYGIENE for the repo-tour

- [ ] `.tmp-*` ×24 at repo root (dev logs/PIDs) → delete + add `.tmp-*` to
  `.gitignore` (nowhere covered today).
- [ ] ~900 lines dead homepage system (`src/features/brief/{brief,masthead,
  civic-city-scene,cityscape-fallback}.tsx`, 3 APIs it served) → remove; also
  dead CSS in `globals.css`. Clarifies "which page is the real home page?"
- [ ] Lint actually runnable: `next lint` prompts interactively for a config;
  add flat config so the badge claim is true to anyone who clones.
- [ ] Validate today's `.civiclens/` artifacts are real, not mock (see 4.1).
- [ ] Keep a small, pinned snapshot of verified records as fallback data?

## 4. INFRA RISK for the live demo

1. **`ensure:data` on cold Vercel** could fetch Legistar at build time; a
   failure yields an empty dataset on the render that matters.
2. **Supabase down → whole product down.** Mitigation: a static JSON fallback
   built into the app (fallback lowering, not degraded).
3. **Deploy: all pages pre-rendered at build** — good; verify no ISR edge
   cases when ingesting near the demo window.

## 5. DEMO ARC (5 min — the sequencing that uses the fixes above)

1. Hero, still. Let it land ~5s.
2. Story section — "one real decision; every number traceable". Pause on
   the evidence page for the closure.
3. `/ask` with a *cross-record* query. Include one refusal on purpose (the
   refusal is the differentiator, not a bug).
4. District Brief for the judge's own district, printed in tab.
5. `/evidence` last — "here's what the record **doesn't** say, counted."

## 6. One-line roadmap

P0: 1.1 build → P1: 1.2 District Brief + clean 1.3 counter + 1.7 mobile
place + hygiene → P2: 1.4 review UI + 1.6 light + 1.8 ics button →
P3: 1.5 Spanish + email digest.
