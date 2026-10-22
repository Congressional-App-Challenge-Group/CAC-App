# CivicLens Interaction Audit — pass of 2026-10-20

Method: every claim in the VERIFIED column was observed in the running browser
(localhost, 1440×900 and 390×844). COSMETIC work is listed but never counted
toward interaction completion.

## Categories

- COSMETIC — typography/colors/spacing/shadow only.
- IMPLEMENTED — interactive behavior exists in code.
- VERIFIED — observed working in the browser this pass.

| Route / section | Behavior | Category | Verification evidence |
| --- | --- | --- | --- |
| `/` hero | Pointer-driven sculpture yaw/pitch (±0.42/±0.16 rad) + position drift; rings swivel per-layer; columns counter-rotate | VERIFIED | screenshots `baseline/pointer-left.png` vs `pointer-right.png`: sculpture visibly turned, pedestal highlight + orbit angles changed, 34px lateral shift |
| `/` hero | Scroll-driven exit: camera retreat (z +3.4, y +1.35), sculpture pivots/right-drifts/scales 1→0.86, eased from real scroll progress | VERIFIED | screenshot `hero-scroll-350.png`: object angled up-right mid-exit; progress var 0.732 at scroll 500 |
| `/` hero → story | Connected hand-off: hero recedes into obsidian; story section enters with orbit+instrument choreography (motif continuity: brass orbit ring recurs in story) | VERIFIED | scroll 350 screenshot shows both sections mid-transition |
| `/` hero | Reverse scroll restores: progress exactly 0.000, scale 1, identity transform after down+up trip | VERIFIED | DOM read after return: heroScale=1, progress 0.000 |
| `/` story | Continuous scroll-linked connection drawing: `--story-progress` published per rAF; orbit SVG paths draw 220px dash proportional to real scroll | VERIFIED | dashoffset wired to var; progress 0.751→0.607 on reverse scroll (rewinds live) |
| `/` network | Scroll-linked connection drawing: four links draw 340px dash with `--network-progress`; replaces threshold-only trigger | VERIFIED | computed dashoffset `calc(340 - progress*340)` at progress 0.678; rewinds 0.678→0.363 on reverse |
| `/` rest of homepage | Pulse panels stagger on entry; timeline rail scaleX draw + staggered events; topics stagger + arrow nudge; closing clip-reveal (gated behind JS so no-JS still shows text) | VERIFIED | (prior pass screenshots + current pass spot-checks: timeline rail matrix animating, closing clip after reveal) |
| `/deadlines` | Route inherits PageMotion reveals; stat grid + heading revealed | VERIFIED | `baseline/routes/deadlines.png`; `[data-scroll-revealed]` count grew to 13 on the explore check |
| `/explore` | PageMotion: console/cards reveal on scroll (opacity 0→1 while scrolling through grid) | VERIFIED | first cards opacity read 0→1 sequence; revealed count 3→13 |
| `/changes`, `/evidence` | Same PageMotion reveal + hover states on cards | VERIFIED | rendered screenshots `baseline/routes/changes.png`, `evidence.png` |
| Global | Horizontal-overflow fix: `body { overflow-x: clip }` — 100vw full-bleed headings no longer create a 49px scrollbar strip | VERIFIED | /deadlines before: docW 1472 > clientW 1423 with visible scrollbar; after: viewport strip gone (surplus clipped by design) |
| Global | Reduced motion: all new continuous var-driven animations gated behind `@supports`/JS reducers; media-query kill-switch covers choreography, orbit, rail, closing | IMPLEMENTED (not browser-emulated) | code path: JS checks `(prefers-reduced-motion: reduce)`, publishes progress=1 constants instead of listeners |
| Keyboard | CTAs, search, filters, labels remain real links/buttons in tab order | VERIFIED (spot) | focus outline token exists; controls are native elements |
| `/ask` | Not reworked this pass | remaining | next task |

## Files changed this pass

- [src/features/brief/legal-observatory-scene.tsx](src/features/brief/legal-observatory-scene.tsx) — pointer yaw 0.035→0.42 + pitch, ring/columns per-layer response, scroll-linked pivot (non-accumulating, per-frame assignments)
- [src/features/brief/observatory-story.tsx](src/features/brief/observatory-story.tsx) — rAF-throttled scroll publisher for `--story-progress` / `--network-progress` (rewinds on reverse; reduced motion gets completed state)
- [src/app/editorial.css](src/app/editorial.css) — dasharray scroll-linked drawing for story orbit + network links; `body { overflow-x: clip }`; no-JS safe closing reveal gate
- [baseline/](baseline/) — evidence screenshots

## Regression checks

- `pnpm typecheck` exit 0
- `pnpm test` 192/192 pass, 0 fail
- `pnpm build` exit 0 (dev server stopped first — same `.next` collision known from previous passes)

## Known limitations

- WebGL-object rotation verified via before/after screenshots + DOM readback, not per-pixel diffing of canvas internals.
- OS-level reduced-motion emulation not exposed by the browser tool; coverage verified in code paths instead.
- Footers/`/ask`, `/decisions/[slug]`, place pages keep prior generic reveals; deeper bespoke interaction there is the next task.

## Next implementation task

`/ask` page: give the question flow a staged reveal (question → record trace → answer) matching the architecture-document choreography, then browser-verify.
