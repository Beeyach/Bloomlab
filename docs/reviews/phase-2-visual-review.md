# Phase 2 visual review — design system and HoloMaterial

Date: 2026-09-02 · Build: `feat/holo-foil` (production bundle, preview environment) · Reviewer: Claude Code, for the learner's sign-off.

Implements spec §82 (review widths), §135 (visual review), §136 (screen coverage matrix), §62 (reference), §67–§68 (holographic material), §84 (accessibility). Requirement evidence lives in `IMPLEMENTATION_STATUS.md`; this document is the review log behind it.

## Method

- **Tooling.** `npm run review:capture` and `npm run review:holo` drive headless Chrome 152 over the DevTools Protocol (`scripts/review/`). The protocol gives exact viewport emulation (touch device below 768 px, so `(pointer: coarse)` is true), full-page and sliced captures, real mouse and touch input with a live frame loop, and `prefers-reduced-motion` emulation. Output goes to `.review/` (git-ignored).
- **Why not the in-app browser pane.** It only composites frames while an input action is running, so eased motion, CSS transitions and rAF loops look frozen; its captures time out or tile at fresh navigations; it cannot emulate reduced motion; and its touch translation stalls clicks and drags while the pane is hidden. It was used for spot checks only; every number below comes from the DevTools driver.
- **Pages.** All nine gallery sections (`/design?section=…`), Foundation home (`/`), System diagnostics (`/system`) and the not-found screen, at 320 · 390 · 768 · 1024 · 1440.
- **Audit per page.** Horizontal overflow, elements outside the viewport, clipped text, control size (< 44 px), input font size (< 16 px), text under 12 px, pointer type, reduced-motion state. Sixty pages audited.

## Results by width

| Width | Composition | Audit |
|---|---|---|
| 320 | Single column everywhere. Palette one swatch per row; nav wraps to three lines; button rows wrap; inputs full width; five holo cards stacked; motion demos stacked; execution log and inspector stacked; semantic components single column — ContactRow recomposes into name/time, channels, tags/assignee rows; CallParticipant stacks; long skill titles wrap without mid-word breaks; case-cover meta wraps to two lines. | No overflow, no clipping, coarse pointer, all controls ≥ 44 px except the three 20 px pricing checkboxes (see findings), 0 inputs < 16 px, 0 text < 12 px. |
| 390 | As 320 with more air; palette two columns; nav two lines. | Same as 320. |
| 768 | Palette four columns; surfaces three; forms two columns; holo three cards + legendary alone on a second row (gallery only) + static; motion three columns + reward; panels two columns; skill cards three columns; territories and covers two + one; workflow nodes one column inside the ink surface; contact rows inline (name · channels · tags · assignee · time). | No overflow or clipping, fine pointer, small button variants 36 px (by design on fine pointers), 0 inputs < 16 px. |
| 1024 | Palette six columns; forms three; holo four cards; motion four columns; panels two; skill cards four columns; territories and covers three; workflow nodes two columns. | Same as 768. |
| 1440 | Content column capped at ≈ 1024 px and centred; same compositions as 1024; nothing stretches; long-session comfort preserved. | Same as 768. |

Screens: Foundation home (eyebrow, title, four version tiles — two columns at ≤ 390, inline at ≥ 768 — and two links), System diagnostics (label/value rows, labels wrap at 320/390), Not found (title and link). All clean at every width.

## Findings

1. **Fixed — SkillCard badge overflow.** In three- and four-column grids (768, 1024, 1440) the mastery badge poked past the card edge ("Needs refresh" on Deliverability, "Pressure-tested" on No-show recovery) and squeezed titles into hyphenated fragments ("No- / show / recovery"). The header row now wraps and the badge drops under the title, right-aligned, when there is no room (`SkillCard.module.css`). Re-captured at all five widths: no overflow, no fragments.
2. **Accepted — pricing checkboxes are 20 px.** `PricingScopeItem` renders a native 20 × 20 checkbox next to a `label[for]` that is at least 44 px tall (name + description) and toggles the box; the effective target is the row. Kept native for platform familiarity.
3. **By design — small buttons are 36 px on fine pointers.** The small variants grow to 44 px under `(pointer: coarse)`; the 320/390 audits confirm 0 controls under 44 px apart from finding 2.
4. **Gallery only — empty grid slot at 768.** The holo demo row shows three cards plus legendary alone; product screens will use their own grids.

## HoloMaterial verification against the reference

### What the reference actually does (live, real pointer)

- Landing tiles: hover → `translateY(-8px)`, shadow `0 16px 40px` 14 %, a pastel gradient ring fades in (`opacity 0→1`, 0.3 s ease-out), art scales 1.06, the mini foil-card thumbnail un-rotates and scales 1.08, a grid hint fades in. No tilt, no glare, no pointer-following light.
- Puzzle view: the card is a photographed foil (`Dragonair.jpg`, 290 px) inside a green→pink→purple gradient frame with a 4.5 s `translateY(0 → −8px)` float; moving the pointer over it changes nothing (transform stays on the float curve).
- The only pointer-driven motion is a background parallax: `mousemove` sets a target from the pointer's viewport position and a rAF loop eases toward it (`cx += (tx − cx) × 0.06`), moving decorative doodles by depth.
- Pointer handlers exist only for dragging puzzle pieces.

What Bloomlab took (D-021, D-023): the tactile lift-and-shadow hover and the iridescent edge, rebuilt as its own procedural material; what it did not: the photograph, the idle float (spec §148 / MOT-004), the parallax, the gradient values, any art.

### Measurements (production bundle, DevTools input, 1280 × 900 unless stated)

| Check | Result |
|---|---|
| Rest | no custom properties set; transform identity; bands 50 % 50 %, hue 0°; glare opacity 0.30; rim 0.55; shadow `0 12px 30px` |
| Pointer at 92 % / 9 % of the collectible card (peak) | `nx 0.84, ny −0.82`; rotateX −4.98°, rotateY −5.08° (≤ 6°); lift −4.98 px; bands 92 % 9 %, hue +29.4°; glare translated +102 / −74 px at opacity 0.75; rim opacity 1.0 from −44°; grain parallax −7 / +5 px; shadow −8.4 / 26.2 px, blur 42 px |
| Pointer at 15 % / 80 % | `nx −0.70, ny 0.60`; rotateX +3.64°, rotateY +4.24°; bands 15 % 80 %, hue −24.5°; glare −85 / +54 px; shadow +7 / 12 px |
| Follow easing | 63 % of the way in 41 ms, 95 % in 120 ms (40 ms time constant) |
| Settle on leave | 95 % home at 460 ms (spec 350–500 ms); loop converges and `data-tracking` clears at ≈ 0.9 s |
| Reduced motion (emulated) | tokens `--bl-holo-tilt-max: 0deg`, `--bl-holo-track: 0`, `--bl-motion-settle: 0s`; hovering the corner sets nothing (transform identity, glare/rim/bands at rest) while the material stays (bands opacity 0.5) |
| Touch, 390 px mobile emulation (`pointer: coarse` true, `touch-action: pan-y`) | press at 20 % / 30 % → `nx −0.60, ny −0.40`, lift 1, rotateY +3.64°, glare −105 / −36 px; drag to 85 % / 80 % → `nx 0.68, ny 0.64`, glare +119 / +58 px, hue +23.7°; release → every property back to rest, loop stops ≈ 0.9 s after release; events seen as `pointerdown/pointermove/pointerup : touch`; a touch move without a press moves nothing |

Captures for review: `.review/holo-rest.png`, `.review/holo-peak.png`, `.review/holo-touch-drag-390.png`, `.review/holo-reduced-motion-hover.png` (regenerate with `npm run review:holo`).

### What still visibly differs from the reference

- The reference's holo is a photographed foil card: a warm gold-green base with hard diagonal rainbow bands and micro-sparkle. Bloomlab's is procedural in the pastel palette on a light ground, so it reads softer and cooler; sparkle is approximated by static grain with a small parallax rather than per-pixel glitter.
- The reference floats its card constantly and drifts its background with the mouse; Bloomlab moves only under the pointer or a touch (spec §148, MOT-004).
- The reference's hover ring is a saturated green→pink→purple gradient at full opacity; Bloomlab's rim is white at the light's angle with pastel tints elsewhere, so it stays quiet on cards that carry text.
- The reference tiles lift 8 px with no tilt; Bloomlab lifts 5 px and tilts up to 6°, which the spec asks for (§68).

## Screen coverage matrix (§136)

| Screen | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|
| Foundation home | ✓ 1440 / 1024 | ✓ 768 | ✓ 390 / 320 | n/a (static) | route chunk fallback (`RouteLoading`) | n/a | ✓ links reachable by Tab, visible focus ring | ✓ layout; links are inline text |
| System diagnostics | ✓ | ✓ | ✓ | n/a | "checking" state while the Worker health call runs | Worker-unreachable message (Phase 1) | ✓ | ✓ layout |
| Not found | ✓ | ✓ | ✓ | n/a | n/a | is the error screen | ✓ | ✓ |
| Design gallery (every section) | ✓ | ✓ | ✓ | n/a (fixtures) | route chunk fallback | n/a | ✓ Tab order, Escape closes popover and sheet (Phase 2 keyboard pass) | ✓ real touch on holo (above); 44 px audit at 320 / 390 |

## Reproduce

```bash
npm run build:preview -w @bloomlab/web   # or point BASE at a deployed preview
npm run preview
npm run review:capture                   # .review/<page>-<width>.png, audit.json
npm run review:holo                      # .review/holo-probe.json + captures
```

Set `CHROME` if Chrome is not at the default path, `BASE` to review a deployed build, `WIDTHS` / `PAGES` to narrow a run.
