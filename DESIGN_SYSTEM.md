# DESIGN SYSTEM — the Bloomlab Design Bible

Derived from `BLOOMLAB_MASTER_SPEC.md` §62–§84, §131, §135–§136, §148, §158–§159 and TA§3. Requirement IDs: DES-*, HOL-*, MOT-*, RSP-*, A11Y-*, PERF-*.

## 1. Reference and adaptation (DES-001)

Primary visual reference: https://doodlemonjigsaw.netlify.app/

The learner strongly likes its colour palette, holographic appearance, iridescence, interaction, animation, tactile behavior and playful material quality. Match that visual feeling closely.

Never copy: Pokémon/Doodlemon art, logo, copyrighted characters, exact branded illustrations, exact page composition. Adapt the visual language into Bloomlab.

## 2. North star and core rule (DES-002, DES-003)

Bloomlab should feel **collectible + tactile + intelligent + playful + polished + immersive** — Doodlemon energy × premium creative software × professional simulation game. The interface should make the learner want to open it for hours.

**The interface is quiet. The objects are magical.**

Do not make everything holographic. Strong holo treatment is reserved for: territory cards · mastery cards · client case covers · selected challenges · portfolio projects · meaningful unlocks · advanced/mastered states · Field Ready achievement.

## 3. Colour tokens (DES-004)

Initial tokens. Tune slightly only for contrast and polish, staying within the Doodlemon-inspired family. Variable names are as implemented in `packages/design-system/src/tokens.css` (D-015); role aliases such as `--bl-color-text` and `--bl-color-surface` sit on top of the palette.

| Token | Hex | CSS variable | Role |
|---|---|---|---|
| Cloud | `#F8FAFF` | `--bl-color-cloud` | Default light ground |
| Snow | `#FFFFFF` | `--bl-color-snow` | Surfaces |
| Mist | `#F0F3FC` | `--bl-color-mist` | Secondary surfaces |
| Soft Lilac | `#EEEAFB` | `--bl-color-lilac-soft` | Tinted surfaces |
| Ink | `#18152B` | `--bl-color-ink` | Primary text, dark workspaces |
| Deep Ink | `#100D22` | `--bl-color-ink-deep` | Deepest workspace / Call Room |
| Ink Soft | `#5D5873` | `--bl-color-ink-soft` | Secondary text |
| Ink Faint | `#86819C` (spec `#8F8AA5`) | `--bl-color-ink-faint` | Decorative and large text only — 3.6:1 on Cloud, below AA for small text (D-017) |
| Electric Sky | `#6EC8FF` | `--bl-color-sky` | Accent, execution |
| Bubblegum | `#FF82C8` | `--bl-color-bubblegum` | Accent |
| Lavender | `#A99BFF` | `--bl-color-lavender` | Accent |
| Aqua | `#75E6DE` | `--bl-color-aqua` | Active execution |
| Lemon Cream | `#FFE98A` | `--bl-color-lemon` | Accent |
| Peach | `#FFB49C` | `--bl-color-peach` | Accent |
| Ice | `#CFF8FF` | `--bl-color-ice` | Cool highlight |
| Success | `#56BFA1` | `--bl-color-success` | Semantic |
| Warning | `#E5A94C` | `--bl-color-warning` | Semantic |
| Error | `#D85C72` | `--bl-color-error` | Semantic |
| Info | `#5D90D9` | `--bl-color-info` | Semantic |
| Link / Focus | `#3B69BD` | `--bl-color-link`, `--bl-color-focus` | Info darkened to 5.1:1 on Cloud for link text and focus rings (D-017); Aqua inside ink surfaces |

Status is never conveyed by colour alone (A11Y-005). Semantic colours are never used as small text; they outline controls (error) or sit as glyphs beside a text label. `packages/design-system/src/color/contrast.test.ts` enforces every pairing above.

## 4. Typography (DES-005)

| Role | Face | Fallback class |
|---|---|---|
| Display | Bricolage Grotesque | expressive display grotesk |
| UI / Body | Inter | highly readable UI sans |
| Technical | IBM Plex Mono | restrained technical mono |

Substitution only with a strong implementation reason, retaining the class. Generic system fonts only as performance fallback, never everywhere. Mobile input font size ≥ 16 px (A11Y-008).

## 5. Token categories (DES-014)

Explicit tokens for: color · spacing · radius · shadow · motion · typography · holographic material · density · z-index · breakpoints.

Breakpoints follow the review widths: 320 · 390 · 768 · 1024 · 1440.

## 6. HoloMaterial (HOL-001 … HOL-004)

One reusable `HoloMaterial`, not dozens of unrelated gradients. It is modelled on the foil trading card the Doodlemon reference shows in its puzzle view (D-021): a photographed holo card whose frame carries diagonal rainbow bands with metallic grain and a bright glare.

Layers, bottom to top:

1. **Pearl** — light pearlescent base (`--bl-holo-pearl`) with a top highlight, so the blends have a field to work on.
2. **Bands** — the spectral foil: `--bl-holo-spectral`, a 110° repeating band gradient of the palette on a 260% tile, `mix-blend-mode: multiply`. Its `background-position` follows the pointer (0–100%) and a `hue-rotate` of ±35° tracks pointer x, so the colour shift moves with the interaction instead of sitting still.
3. **Grain** — fine turbulence texture, `overlay`, with a small counter-parallax so it shimmers.
4. **Glare** — the moving light: a radial highlight translated with the pointer, `overlay`; its opacity rises from `glare-min` toward the card edge (`--holo-hyp`).
5. **Rim** — edge sheen: a conic rim light masked to a 1.5 px border whose bright point sits at the pointer angle.

Variants: **soft** (bands 0.26, no grain) · **collectible** (0.5 / 0.18) · **mastery** (0.62 / 0.22, lavender glow) · **legendary** (0.72 / 0.28, −20° hue, peach glow; must remain tasteful).

### Physics

JavaScript writes only pointer state (`--holo-nx/ny` −1…1, `--holo-px/py` 0–100, `--holo-hyp` 0–1, `--holo-angle`); every visual response is CSS.

Desktop — rotateX/rotateY = pointer × `--bl-holo-tilt-max` (6°, spec 5–7°) plus a 3 px lift and 1.2% scale while tracking; the shadow offsets away from the pointer; bands, grain, glare and rim respond as above. Smoothing runs in the frame loop, not in CSS transitions (D-022): while the pointer is inside, the pose eases toward the target with a 40 ms time constant (≈ 120 ms to sit on a new position, so it feels tactile without lag); on pointer exit it eases back with a 140 ms time constant, ≈ 95 % home at `--bl-holo-settle` (420 ms, spec 350–500 ms). The loop stops as soon as the pose converges; nothing runs at rest.

Touch — press starts tracking (glare and bands jump to the finger), drag moves them, release settles. `touch-action: pan-y` keeps page scrolling. Device orientation permissions are never requested.

Reduced motion — `--bl-holo-tilt-max: 0deg` and `--bl-holo-track: 0` freeze tilt, lift, band sweep, glare travel and rim tracking; the material itself (pearl, bands, grain, rim, static glare) stays (MOT-003). Off-screen cards detach their pointer work (MOT-004).

Legibility — content sits above all layers and is never blended; the base stays light and the bands are pastel and multiplied, so ink text keeps ≥ 4.5:1 across the card.

## 7. Motion (MOT-001 … MOT-004)

Categories: **state** · **spatial** · **execution** · **reward**.

Timing: normal interaction ≈ 120–300 ms; major accomplishments ≈ 1.5–3 s and skippable by the user. Respect `prefers-reduced-motion` everywhere. No constant expensive holographic animation; animations stop off-screen.

## 8. No AI-slop design (DES-006)

Reject as default patterns: giant gradient hero · purple SaaS gradient · gradient text · glassmorphism everywhere · random blobs · icon beside every heading · endless three-column cards · every section in a card · giant useless stats · fake analytics · emoji navigation · trophy spam · rocket graphics · stock SaaS art · generic AI avatar · huge shadows · random confetti · excessive pills · identical layouts across every environment · generic "Welcome back" dashboard.

## 9. Primitives and semantic components (DES-007, DES-015, DES-016)

Styling: CSS variables + CSS Modules or well-structured component CSS. Tailwind may be used selectively for layout utilities only; Bloomlab must not look like a standard Tailwind component library.

Visual primitives (design-system package): `HoloMaterial` · `Surface` · `InkSurface` · `ToolPanel` · `Sheet` · `Inspector` · `Popover` · `Field` · `Button` · `IconButton`.

Semantic product components sit above the primitives and share tokens: `SkillCard` · `ClientCaseCover` · `WorkflowNode` · `ExercisePrompt` · `MasteryBadge` · `ContactRow` · `PipelineCard` · `HoloTerritory` · `CallParticipant` · `PricingScopeItem` · `ExecutionEvent`.

Do not create one universal Card component for the whole product.

## 10. Information density (DES-008)

| Environment | Density |
|---|---|
| Academy | low–medium |
| Workflow Lab | medium–high |
| CRM | high |
| Call Room | very low |
| Pricing Arena | medium |
| Skill Map | high visual, low text |

Never one density everywhere.

## 11. Environment design

### App shell (DES-009)

Desktop: compact left rail ≈ 68–80 px. Primary areas: Home · Campaign · Skill Map · Simulator · Clients · Portfolio · Playground. Minimal top context. No giant sidebar.

### Command Center (DES-010)

Primary question: "What should I do next?" Main object: **Continue** (campaign, gate, current topic, progress). Supporting: active client · due retrieval · recent mastery · Build My Session. Home is never filled with meaningless metrics.

### Skill Map (DES-011) — signature screen

Nine territories plus Judgment as holographic regions or collectible objects, not tiny LMS nodes. Skill states: unseen · available · learning · practiced · independent · pressure-tested · mastered · needs refresh. Mastery changes the visual material.

### Academy (DES-020)

An interactive editorial publication: strong typography, short sections, diagrams, inline simulations, interaction, expandable depth. Never "video + paragraph + next lesson".

### Workflow Lab (WFL-007)

Dark ink workspace. Light clean nodes. Active execution in aqua/blue. Not neon hacker software.

### Client cases (DES-012)

Covers feel collectible and premium. Abstract identity/material treatment, no mandatory stock photos. Persistent clients may later get generated portraits where useful.

### Call Room (CALL-001)

Minimal, immersive, dark. Shows client identity, company, objective, audio state, elapsed time, notes drawer. Not a Zoom clone. Early training may show discovery anchors; advanced calls remove aids.

### Pricing Arena (PRI-001)

A deal desk: requirements · scope · price · payment · timeline · recurring · exclusions. Scope reductions have visible structural consequences.

### Broken Build Mode (DES-013)

Understated **INCIDENT** state with symptom, logs, client complaint, system state. No cartoon alarm effects.

## 12. Responsive (RSP-001 … RSP-004)

Required review widths: **1440 · 1024 · 768 · 390 · 320**. Tablet is first class. Mobile is recomposed. No critical desktop feature may disappear because responsive work is difficult.

Mobile recompositions: Workflow → vertical step editor · CRM → stage view / deliberate local horizontal scroller · Academy → editorial reading · Call Room → mobile-first voice experience · Inbox → natural conversation flow · Skill Map → territory-first.

## 13. Accessibility (A11Y-001 … A11Y-010)

Keyboard operability · visible focus · labels · reduced motion · sufficient contrast (including over holo surfaces) · non-color status · drag alternatives · touch targets ≈ 44 px · mobile input font ≥ 16 px · no critical hover-only information. Automated checks in CI plus manual review of keyboard, focus flow, touch, reduced motion, holographic contrast, drag alternatives.

## 14. Performance rules (PERF-001 … PERF-003)

CSS transforms and composited layers · route-level lazy loading · off-screen animation pause · Web Worker simulator · local-first interaction. Heavy simulator routes never load during simple Academy reading. Holographic richness never harms usability.

## 15. Copy (PRD-012, PRD-013)

Short, smart, direct, professional, occasionally playful. "Run it." "Something broke. Find out why." "No hints this time." "Deal lost. Good decision." Progress shown as capabilities demonstrated and the states Passed / Needs another run / Demonstrated / Independent / Mastered / Field Ready. No XP, no stars, no "Amazing job, superstar!".

## 16. Review protocol (DES-017, DES-018)

Review every major screen at 1440 / 1024 / 768 / 390 / 320 for: hierarchy · density · material · interaction · holo restraint · slop patterns · responsive composition · long-session comfort.

The review fixture is the `/design` gallery (flag `design_gallery`, local and preview only): every primitive and semantic component in every state, `?section=<id>` to isolate one section. Contrast ratios shown there are computed live by `contrastRatio` and enforced by `packages/design-system/src/color/contrast.test.ts`.

Screen coverage matrix (maintained from Phase 7 onward; no major screen is complete with only Desktop checked):

| Screen | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|

## 17. Signature moments to polish (PRD-015)

Holo Skill Interaction · First Workflow Execution · Client Case Reveal · Failed Test reveal · Independent Pass · Field Ready. Sound (PRD-016) is optional, subtle and always mutable.
