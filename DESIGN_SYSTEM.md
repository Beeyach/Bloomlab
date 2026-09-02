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

Initial tokens. Tune slightly only for contrast and polish, staying within the Doodlemon-inspired family. Proposed CSS variable names are shown; final names are fixed in Phase 1/2 (`packages/design-system`).

| Token | Hex | Proposed variable | Role |
|---|---|---|---|
| Cloud | `#F8FAFF` | `--bl-cloud` | Default light ground |
| Snow | `#FFFFFF` | `--bl-snow` | Surfaces |
| Mist | `#F0F3FC` | `--bl-mist` | Secondary surfaces |
| Soft Lilac | `#EEEAFB` | `--bl-lilac-soft` | Tinted surfaces |
| Ink | `#18152B` | `--bl-ink` | Primary text, dark workspaces |
| Deep Ink | `#100D22` | `--bl-ink-deep` | Deepest workspace / Call Room |
| Ink Soft | `#5D5873` | `--bl-ink-soft` | Secondary text |
| Ink Faint | `#8F8AA5` | `--bl-ink-faint` | Tertiary text, hints |
| Electric Sky | `#6EC8FF` | `--bl-sky` | Accent, execution |
| Bubblegum | `#FF82C8` | `--bl-bubblegum` | Accent |
| Lavender | `#A99BFF` | `--bl-lavender` | Accent |
| Aqua | `#75E6DE` | `--bl-aqua` | Active execution |
| Lemon Cream | `#FFE98A` | `--bl-lemon` | Accent |
| Peach | `#FFB49C` | `--bl-peach` | Accent |
| Ice | `#CFF8FF` | `--bl-ice` | Cool highlight |
| Success | `#56BFA1` | `--bl-success` | Semantic |
| Warning | `#E5A94C` | `--bl-warning` | Semantic |
| Error | `#D85C72` | `--bl-error` | Semantic |
| Info | `#5D90D9` | `--bl-info` | Semantic |

Status is never conveyed by colour alone (A11Y-005).

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

One reusable `HoloMaterial`, not dozens of unrelated gradients.

Layers: base pearlescent layer · spectral layer · moving radial reflection · fine foil texture · edge sheen · pointer tilt · touch response · reduced-motion mode.

Variants: **soft** · **collectible** · **mastery** · **legendary** (legendary must remain tasteful).

### Physics

Desktop — pointer position influences rotateX, rotateY, reflection position, spectral angle, shadow direction, edge sheen. Maximum tilt ≈ 5–7°. On pointer exit, settle toward neutral in ≈ 350–500 ms.

Touch — press changes reflection; drag moves reflection; release settles. Device orientation permissions are never requested.

Reduced motion — tilt and moving reflection disabled; static pearlescent layer remains (MOT-003).

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

Screen coverage matrix (maintained from Phase 7 onward; no major screen is complete with only Desktop checked):

| Screen | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|

## 17. Signature moments to polish (PRD-015)

Holo Skill Interaction · First Workflow Execution · Client Case Reveal · Failed Test reveal · Independent Pass · Field Ready. Sound (PRD-016) is optional, subtle and always mutable.
