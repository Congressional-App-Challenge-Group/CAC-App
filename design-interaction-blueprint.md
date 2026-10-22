# CivicLens Interaction Blueprint — v2 "Living Record"

Derived from browser inspection of Lusion (lusion.co — verified reference, WebGL/scroll-driven,
reactive cursor) and full-scroll captures of the current CivicLens build (9,273px doc height).
Verified reference facts: wheel input drives a continuous 3D scene (stage is fixed, content scrolls
physically elsewhere), hero object responds to pointer with per-layer depth. Borrowed principles:
scroll drives state continuously; depth layers separate; pointer coordinates a multi-element
composition; transitions connect sections; reverse scroll restores.

Rubric used in design-evolution-log.md (baseline 75/100 after Iteration 3).

## Route/section coverage tracker

| Route | Section | Status |
| --- | --- | --- |
| `/` | Observatory hero | designed → implemented → browser-tested |
| `/` | Opening choreography | designed → implemented → browser-tested |
| `/` | Story ("A decision is never just a date") | designed → implemented → browser-tested |
| `/` |civic pulse | designed → implemented → browser-tested |
| `/` | Timeline of change | designed → implemented → browser-tested |
| `/` | Topics grid | designed → implemented → browser-tested |
| `/` | Closing + footer gate | designed → implemented → browser-tested |
| `/deadlines` | List | designed → implemented → browser-tested (inherits route motion) |
| `/explore` | Console/results | designed → implemented → browser-tested (inherits route motion) |
| `/changes`, `/my-area`, `/following` | Feeds | designed → implemented → browser-tested (inherits route motion) |
| `/ask` | Not redesigned this pass | still requiring work |

Not every element animates. Text stays restrained; scene and composition carry the motion.

## 1. Observatory hero (`/`)

- Initial state: full-bleed obsidian stage; 3D lens sculpture right-of-centre; kicker, headline,
  summary, search, two CTAs, scope line; four floating route labels; scroll cue bottom-right.
- Opening choreography (staged, ~0.9s total, non-blocking, minimum delay pattern):
  1. `--stage-in`: backdrop architecture columns fade/expand (0ms).
  2. `--stage-in`: sculpture stage scales from 0.94 + translateY(24px) → identity with spring-ish
     cubic-bezier(.16,1,.3,1), opacity 0→1 (90ms).
  3. Headline lines reveal via clip-path mask, per-line stagger 120ms (180ms).
  4. Summary, search, CTAs, scope, labels, scroll cue stagger-fade remaining slots (from 300ms).
  All elements start visible pre-JS; animation class applied via `data-hero-animated` only after
  hmm mount, so no-JS/SEO/crawler sees static composed page. Reduced-motion: skip entirely.
- Pointer response (multi-layer, physically composed, not one flat translate):
  - `observatory-stage`: ±18px translate (was 18px) + rotateY ±4.5deg with perspective 1200px —
    sculpture visibly turns with cursor.
  - 3D scene camera: existing ±0.5 world units + enhanced ±0.9 gain on sculpture rotation.y
    (pointer.x * 0.12), creating light angle shift across brass.
  - Architecture columns: counter-parallax −7px (already) — deepen to −10px with rotateY drift.
  - Labels: counter-translate ±9px (existing) — keep, they sit "in front" audibly.
  - Glow: follows pointer (existing, keep).
  - Headline: hairline counter-move ±3px (existing).
  Verification: element bounding boxes must shift ≥12px between pointer at left vs right edge.
- Scroll drive (continuous, reverse-safe):
  - progress = −top / (height × 0.7), clamped (existing), applied to: stage depth `translateZ`
    via scale 1 → 0.82, content translate/opacity (existing), labels drift (existing), ribbon
    dim. New: scene camera y +z retreat driven by same progress (scene reads `--hero-progress`),
    so the sculpture recedes and fades as you leave the hero.
- Verification: `--hero-progress` goes 0 → ~1 then back to 0 on reverse; no stuck transforms
  after fast scroll down + up.

## 2. Story — "A decision is never just a date" (pinned-journey section)

- Initial: intro wide type (existing). Journey: left instrument card (sticky), right steps list.
- Step activation already updates copy. Remain: keep, but add settle animation on progress.
- Scroll drive (new): the section tracks `--story-progress` (0..1 across section); the orbit
  rings rotate slowly with progress; the center node scale pulses 1→1.04→1; the connecting
  SVG dash draws based on progress; the orbit nodes highlight as each step becomes active.
- Transition in: intro heading clip-reveal; journey cards enter with translateY(36px)→0 and
  opacity as section enters viewport (data-in-view hooks already exist).
- Mobile: sticky disabled (existing), steps full width.
- Reduced motion: steps activate instantly (existing IO still fine), no orbit spin.

## 3. Pulse ("The civic pulse", `#civic-pulse`)

- Three panels. On `data-in-view`: each panel rises with 90ms stagger (existing reveal handles
  generic pages only; new: `.observatory-pulse[data-in-view] .pulse-panel` animation).
- Hover: panel border brightens + translateY(-3px); list rows reveal seconds after.
- Scroll out: nothing pinned; leave as scrolling flow (avoid over-pinning per blueprint rules).

## 4. Timeline of change (`#legal-timeline`)

- Timeline markers: already colour-coded. New: as the console enters view, the horizontal rail
  draws left→right (scaleX 0→1, 0.9s), each column's marker lights in sequence (stagger 70ms).
- List view toggle: existing buttons — add pressed-state glow (already aria-pressed styles).

## 5. Topics grid

- Enter: rows fade-slide with stagger (data-in-view).
- Hover: background brass tint + inset ring (existing) — keep; add arrow nudge.

## 6. Closing + footer gate

- The closing section is the footer's "front door": on enter, the huge serif h2 clip-reveals
  upward, buttons rise, then footer flows naturally below (no transformation needed in footer
  itself beyond existing layout. The record stays open.)
- The orbit motif (thin brass ring) repeats in closing — already there via ::after.

## 7. Other routes (via PageMotion, already exist)

- Decision cards: keep existing tilt (subtle 3deg). Buttons: focus-visible glow.
- Nav: existing hover states. Verify keyboard operability. Mobile nav unchanged.

## 8. Motion design system

- Easing tokens: `--ease-out-expo: cubic-bezier(.16,1,.3,1)` for entrances/hovers;
  `--ease-soft: cubic-bezier(.2,.7,.2,1)` kept for pointer drift (already used); linear only
  inside rAF-driven scroll updates.
- Durations: hover/micro 180ms; section enters 550–900ms; hero scroll mapping continuous.
- Stagger: 60–120ms between siblings, capped at 5 items.
- Depth: perspective 1200px on stage; translateZ used only with rotateY pairing.
- Reduced motion: global kill-switch (existing) extended to new pulse/timeline/closing
  animations; `data-hero-animated` never applied.

## 9. Acceptance tests (browser, must run)

1. Fresh load `/`: no flash of hidden content; headline clip-reveal visible within ~0.8s; no
   horizontal overflow at 1440×900 and 390×844.
2. Pointer: sculpture bounding box shifts ≥12px between cursor edges; labels counter-move;
   glow follows.
3. Slow scroll: hero progress var climbs 0→1; story orbit rotates; pulse panels stagger in;
   timeline rail draws.
4. Fast + reverse scroll: no stuck states (compare screenshot at y=0 after full down+up trip).
5. Keyboard: Tab reaches search, CTAs, labels, timeline filter buttons; focus visible.
6. Reduced motion: reduced-motion emulation → no transforms/staggers; content fully readable.
7. Console: no errors (beyond known dev-only noise); typecheck/tests/build green.
