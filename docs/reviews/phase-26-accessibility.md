# Phase 26 — controlled accessibility review

> Navigation follow-up: D-202 and [the navigation redesign review](../reviews/navigation-shell-redesign.md) supersede this document’s fixed-104 px/containment contract. Historical PASS evidence is preserved, but the learner’s contradictory real-use report requires fresh two-state genuine-input verification. All unrelated acceptance remains unchanged.


This is implementation evidence, not physical-device or independent accessibility certification.
Checkpoint E uses built Chromium with real keyboard/pointer/touch input, axe-core 4.13.0 and
reduced-motion emulation. Later final-head runs are recorded in the Phase 26 review/PR.

## CI policy and reproduction

Run `npm run build && npm run test:a11y` under Node 22 with Chrome available (`CHROME` overrides
the executable). The script starts/stops its own local preview server unless `BASE` is supplied.
`WIDTHS` defaults to 1440,390; `REVIEW_HEAD` additionally requires browser and Worker identity.
No credentials, real learner data or paid providers are used.

The [axe API](https://www.deque.com/axe/core-documentation/api-documentation/) is injected into
the actual built pages. All default rules run; no rules or elements are excluded. Serious and
critical violations fail the process/Checks job. Moderate/minor findings and incomplete checks
remain in the uploaded JSON, not silently counted as passes. A deliberately unnamed button must
produce a serious button-name violation, proving both the engine and blocking policy. The fixture
is removed before exit and never ships in application code. Finite entrance animations settle
before contrast is measured; reduced-motion and active interactions have separate probes.

`scripts/review/screen-matrix.mjs` lists 26 major route/detail/runner states. The phone More-open
state adds one scan: **53 scans passed, zero violations**, and the negative control was detected.
Artifacts: `.review/phase-26-accessibility/verified/a11y-probe.json`. Gradient contrast remains
incomplete where axe cannot determine the painted backdrop; automated silence is not WCAG proof.

The first run found small-text contrast failures in locked Skill Map cards (whole-card opacity)
and Incident client labels (faint token). Removed the opacity and used the existing soft-text
token, respectively. Both route families remain in the recurring gate.

## Six-area record

| Area | Setup and observed result | Limit |
|---|---|---|
| Keyboard | Native Tab traversal on Search, Sync, Clients and Campaign (35 stops each); visible rings on controls. Workflow selection, arrow-key node movement and undo pass. All rail destinations pass forward/reverse Tab and native activation. | This samples real core flows, not every possible field/error/assistive-technology combination; A11Y-001 remains PARTIAL. |
| Focus flow | More → focus a secondary link → Escape now returns focus to More. App unit regression and rail browser assertion cover it. Restore preview/confirmation/cancel focus and search detail/back focus passed at B/C. | No claim of screen-reader or physical Safari certification. |
| Touch | Five-width workflow probe passes actual touch open/configure/add/test/timeline on 390/320; controls are at least 44 px. Rail touch gestures scroll only their own container, including tablet emulation. | Chromium emulation is not physical-device acceptance. |
| Reduced motion | Workflow first execution shows the full recorded trace immediately without travelling dots. Holo hover remains flat with tilt/track tokens zero; touch release returns neutral. Rail isolation passes in normal and reduced modes. | Live preference changes during an active effect are also hardened and retested at F. |
| Holographic contrast | Inspected collectible peak/rest and all four static/reduced variants: dark text remains legible over the existing material, with content above decorative layers. Token contrast unit tests pass; no tiny/faint explanatory text is introduced. | Gradient/grain backgrounds are not fully resolved by axe; this controlled visual review is not a numerical certificate for every painted pixel or display. |
| Drag alternatives | Workflow arrow-key movement + undo and phone step editor add/configure/save pass; drag is not required. Existing Funnel reorder buttons remain covered by its regression/probe at final sweep. | Does not infer full keyboard operability from one canvas test. |

## Short-height rail

Five normal widths and **ten 480 px-high cases** (1440/1024/768/390/320 × normal/reduced motion)
pass with real scrollbar gutters: vertical overflow is deliberate, wheel/touch scrolling stays
independent of the page, boundary gestures do not chain, every link and bottom action is reachable,
focus rings are unclipped, reverse Tab works, and labels/104 px rail width remain unchanged.
Phone More retains its own bounded scrolling and restores focus on Escape.

## Supporting results

- 44 focused tests / 6 files passed: app navigation, Holo, token contrast, motion and Workflow UI.
- All workspace typechecks and scoped ESLint pass; Preview build/provider-secret scan pass.
- Workflow probe: 15 sections passed, including five compositions, keyboard/drag alternatives,
  actual first-execution playback, skip/replay, reduced motion and 504 additional worker events.
  This container sample had frame p95 41.2 ms/max 65 ms and one 56 ms long task; it is not a
  reference-device performance certification.
- Artifacts under `.review/phase-26-accessibility/{workflow,rail,holo}`; native keyboard trace in
  `/tmp/bloomlab-phase26-a11y-keyboard.log`. Workflow 320 and Holo peak/reduced screenshots inspected.

No parked human status, private data boundary or earlier PR changed. Provider spend: $0.

## Checkpoint H expansion

The route matrix now covers 36 states. Its 73 initial/More scans passed, then actual recovery
screenshots exposed low-contrast Sync failure copy. Added a document-scoped failed-link transport
fixture at both CI widths: no request creates a learner or sends its generated local key. Axe
reported a serious color-contrast violation before the correction. The same decorative error
token was used for body copy in session builder, Academy and runner failures; four new source
regressions failed on those uses. All four now use the existing normal text role, without changing
error wording, retry, focus or learning behavior. The full **75-scan** gate passes afterward with
zero violations and its unnamed-button negative control detected. Gradient incompletes remain.

The corrected Preview build also passes the five-width Portfolio/export recovery probe. The
98-test focused suite, all workspace types/lint and browser secret scan pass. H's broader
screen/state matrix and native pricing-label touch regression are recorded in
`phase-26-screen-matrix.md`; local artifacts are `.review/phase-26-sweep/error-verified`.
