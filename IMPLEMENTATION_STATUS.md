# IMPLEMENTATION STATUS

Concise roll-up in the spec §139 format. `REQUIREMENTS_MATRIX.md` is the source of truth for statuses; this file must agree with it. `node scripts/validate-requirements.mjs` enforces that agreement.

Last updated: 2026-09-02

## CURRENT PHASE

Phase 3 — Local-First Data: **complete for its scope** — the Dexie database, the syncable-store write path (record + outbox in one transaction), device identity, workspace checkpoints, sync-status indicator and the installable PWA are built, unit-tested and verified on the production bundle with the DevTools driver (`npm run review:offline`): the app shell loads with both the page and the service worker offline, the API is never served from cache, and a device rename survives an offline reload. DATA-001 stays PARTIAL until Phase 4 drains the queue to the Worker. Phase 2 (design system) is complete; its review is in `docs/reviews/phase-2-visual-review.md`. Phase 4 — D1 + Sync is waiting for the go-ahead.

## VERSIONS

- app: 0.1.0
- content: none (`CONTENT_VERSION = null` until the content compiler exists)
- simulator: 0.0.0 (no engine yet)

## PASSED

Phase 0–1:

- INF-002 — evidence: the §102 tree exists; every package has its own `package.json` and `tsconfig.json`; `npm run typecheck` runs all eight workspaces.
- INF-003 — evidence: conventional commits on `main`; LF enforced via `.gitattributes`.
- INF-009 — evidence: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`; no `.js`/`.jsx` under `apps/`, `worker/`, `packages/`; `no-explicit-any` is an error.
- INF-010 — evidence: per-environment flags; tests prove `/system` and `/design` are unreachable by URL and unlinked when off; verified in the production bundle.
- INF-012 — evidence: commit messages reference requirement IDs.
- INF-014 — evidence: control documents updated every phase; validator exits 0.
- DES-014 — evidence: `tokens.css` declares all ten TA§3 categories; `tokens.test.ts` verifies palette, breakpoints, motion ranges, reduced-motion override.

Phase 2:

- DES-001 — evidence: reference site studied live with a real pointer (tiles lift 8 px with a gradient ring and deeper shadow; the foil card is a photograph with a 4.5 s float; the only pointer-driven motion is a background parallax) and adapted into tokens and `HoloMaterial` (D-021, D-023); no art, logo, character, illustration, composition or gradient values copied (design-system source contains only geometric SVG). Side-by-side notes in `docs/reviews/phase-2-visual-review.md`.
- DES-002 — evidence: gallery review of Skill Map territories, client covers and mastery states at all widths; sign-off recorded in KNOWN_LIMITATIONS as a judgment call pending the learner's own review.
- DES-003 — evidence: `HoloMaterial` is used only by SkillCard (independent and above), HoloTerritory, ClientCaseCover, the reward demo and the gallery; everything else uses `Surface` / `InkSurface`.
- DES-004 — evidence: `tokens.css` carries the nineteen §65 values with one documented contrast tuning (Ink Faint → `#86819C`, D-017); `tokens.test.ts` and `contrast.test.ts` enforce them.
- DES-005 — evidence: Bricolage Grotesque Variable, Inter Variable and IBM Plex Mono self-hosted via `@fontsource`; `document.fonts.check` true for all three in the running app; system fonts only in fallback stacks.
- DES-007 — evidence: SkillCard, ClientCaseCover, WorkflowNode, ExercisePrompt, MasteryBadge, ContactRow, PipelineCard, HoloTerritory, CallParticipant, PricingScopeItem, ExecutionEvent exist and share tokens; no `Card` export.
- DES-015 — evidence: HoloMaterial, Surface, InkSurface, ToolPanel, Sheet, Inspector, Popover, Field, Button, IconButton exist with focus styles and reduced-motion handling; 27 primitive tests.
- DES-016 — evidence: CSS Modules + custom properties everywhere; Tailwind absent from the lockfile.
- DES-019 — evidence: the Phase 1 screens now use Stack, Grid, Surface, Button; no placeholder grey UI remains.
- HOL-001 — evidence: five layers (pearl base, spectral bands, metallic grain, pointer-following glare, iridescent rim light) plus tilt, 5 px lift, direction-aware shadow that deepens with the lift, and touch response, modelled on the reference's foil card (D-021, D-023); under emulated `prefers-reduced-motion` the tokens read `0deg / 0 / 0s`, a hovered card sets nothing and stays at rest while the bands remain at opacity 0.5 (`npm run review:holo`).
- HOL-002 — evidence: soft, collectible, mastery, legendary render distinctly in the gallery with stepped band/grain/glare intensities; legendary keeps the palette family (−20° hue, peach glow), no strobing, no idle animation.
- HOL-003 — evidence (production bundle, DevTools mouse input, `npm run review:holo`): pointer at 92 % / 9 % of a card → rotateX −4.98° / rotateY −5.08° (≤ 6°), lift −4.98 px, bands 92 % 9 % with hue +29.4°, glare translated +102 / −74 px at opacity 0.75, rim at full opacity from the pointer angle, grain parallax, shadow offset −8.4 / 26.2 px and deepened to 42 px blur; at 15 % / 80 % every layer flips (rotate +3.6° / +4.2°, hue −24.5°, glare −85 / +54 px, shadow +7 / 12 px). Follow reaches 63 % in 41 ms and 95 % in 120 ms; on leave the pose is 95 % home at 440–460 ms (spec 350–500 ms) and the loop stops at ≈ 0.9 s (D-022). Unit tests cover the maths, clamping, follow, settle and reset.
- HOL-004 — evidence (390 px mobile emulation, `pointer: coarse`, DevTools touch input): press at 20 % / 30 % → `nx −0.60, ny −0.40`, lift 1, glare −105 / −36 px; drag to 85 % / 80 % → `nx 0.68, ny 0.64`, glare +119 / +58 px; release → every property back to rest and the loop stops ≈ 0.9 s later; the browser reports `pointerdown / pointermove / pointerup : touch`; a touch move without a press moves nothing; page scrolling preserved by `touch-action: pan-y`; no DeviceOrientation usage anywhere. Unit tests cover the same sequence.
- MOT-001 — evidence: `motion.module.css` defines state, spatial, execution and reward classes; `RewardReveal` and `ExecutionTrack` components.
- MOT-002 — evidence: tokens 120 / 200 / 300 ms; reward duration clamped to 1500–3000 ms with a Skip control (unit tests).
- MOT-003 — evidence: with `prefers-reduced-motion: reduce` emulated on the production bundle the motion tokens read 0 ms, the holo tokens read `0deg / 0`, a hovered card stays at rest with its material intact, the reward end state shows immediately and the spinner is static; unit tests cover the hook path.
- MOT-004 — evidence: no idle animations; live pulse and speaking ring are gated by `useOnScreen` (IntersectionObserver) with unit tests; HoloMaterial detaches pointer work off-screen.
- PERF-003 — evidence: runtime `blur()` removed from the material after it stalled software rendering; static variant available for dense lists; same off-screen gating as above.
- A11Y-001 — evidence: every interactive element is a native button, link, input, select, textarea or dialog; keyboard tests for Button, SkillCard, Popover (Escape), Sheet (cancel); Tab reaches controls in the running app.
- A11Y-002 — evidence: `:focus-visible` ring observed in the running app (`solid` outline in `#3B69BD`); aqua ring inside ink surfaces.
- A11Y-003 — evidence: Field wires label, hint and error ids (tests); IconButton requires a label; gallery audit finds every control labelled.
- A11Y-004 — evidence: `contrast.test.ts` proves every text/surface, link, focus and ink-context pairing meets AA; palette swatches show live ratios.
- A11Y-005 — evidence: MasteryBadge has a distinct glyph and word per state; StatusPill always carries text; tests.
- A11Y-007 — evidence: 44 px minimum on Button, IconButton, controls and rows; small buttons grow to 44 px on coarse pointers; the 320 / 390 audits (coarse pointer) list no control under 44 px except the three native 20 px pricing checkboxes, whose `label[for]` row is the ≥ 44 px target; on fine pointers only the small button variants (36 px) are under 44 px.
- A11Y-008 — evidence: controls use `max(1rem, …)`; gallery audit reports 16 px for every control.
- A11Y-009 — evidence: hover only changes styling; IconButton duplicates its label as `title`; no tooltip-only content.

Phase 3:

- DATA-002 — evidence: `apps/web/src/data/db.ts` opens IndexedDB `bloomlab` through Dexie 4 with five tables (`device`, `notes`, `workspace`, `sync_queue`, `sync_state`) and no layer on top; every read and write goes through Dexie tables or `liveQuery`; the production-bundle probe shows the database open (`bloomlab@10` in `indexedDB.databases()`) and `localStorage` empty after a full session; unit tests assert the schema and that localStorage stays untouched.
- DATA-003 — evidence: `vite-plugin-pwa` (Workbox `generateSW`) precaches the shell, scripts, styles, icons and fonts (45 entries, 993 KiB); `/api/*` is `NetworkOnly` and excluded from the navigation fallback; `/content/*` (Phase 5) is stale-while-revalidate; manifest with 192 / 512 / maskable icons. Production-bundle probe: service worker controlling the page, `Page.getAppManifest` without errors, `Page.getInstallabilityErrors` empty (Chrome's install criteria met), and with offline emulated on the page *and* the worker the shell renders from the precache while `fetch('/api/health')` fails instead of being served from cache.

Deployment:

- RSP-005 — evidence: PR #1 triggered CI run 33659265707; the Preview deploy job ran (not skipped), built with `CLOUDFLARE_ENV: preview` and deployed `bloomlab-preview` to https://bloomlab-preview.cool-sunset-2169.workers.dev. `/api/health` returned `{"environment":"preview","versions":{"app":"0.1.0","content":null,"simulator":"0.0.0"}}`; `/`, `/design`, `/system` and an unknown path all served the SPA shell (200 text/html); `/api/nope` returned JSON 404; hashed assets served as text/javascript. Opened in a 390 px viewport: foundation home and the holo gallery section rendered with no horizontal overflow and no console errors.

## IN PROGRESS

- SYNC-007 — groundwork: every syncable record carries `id, learner_id, created_at, updated_at, revision, device_id, deleted_at` (`SyncEnvelope`), stamped by `createSyncableStore`; the outbox coalesces repeated pending changes to one row per record (so drags and keystrokes never replay) and leaves in-flight rows alone; `takeOperations / completeOperation / failOperation / resetOperations` are the primitives Phase 4's transport will use. Unit tests cover stamping, coalescing, in-flight isolation and soft deletes.
- INF-013 — versions exported and surfaced by `/api/health` and `/system`; attempt records that persist them arrive with the learning engine (Phase 6) and exercise runner (Phase 9).
- DES-006 — cross-cutting: Phase 2 gallery reviewed against the §70 list (no gradient heroes, gradient text, glassmorphism, blobs, icon-per-heading, card-everything, fake stats, emoji nav, trophies, huge shadows, confetti); re-checked every phase.
- DES-008 — density mechanism (`data-density`, `--bl-density-row`) implemented in ToolPanel and rows; per-environment assignment happens with the screens (Phase 7+).
- DES-012 — ClientCaseCover with the abstract IdentityMark exists; persistent clients arrive in Phase 24.
- DES-017 — cross-cutting: Phase 2 review at 1440 / 1024 / 768 / 390 / 320 done for every gallery section and the Phase 1 screens with `npm run review:capture` (sixty page audits; one SkillCard badge overflow found and fixed); log in `docs/reviews/phase-2-visual-review.md`; repeated per phase.
- DES-018 — cross-cutting: the §136 matrix for the four Phase 1–2 screens (desktop, tablet, mobile, empty, loading, error, keyboard, touch) is recorded in `docs/reviews/phase-2-visual-review.md`; extended as screens arrive.
- RSP-001 — cross-cutting: all five widths captured and audited this phase (no horizontal overflow, clipping or off-viewport element on any of the sixty pages).
- RSP-002 — cross-cutting: tablet compositions are deliberate (three-column skill cards, two-column panels and forms at 768); ContactRow, ExecutionEvent, SkillCard headers, CallParticipant and Sheet recompose on mobile; more recompositions come with the labs.
- RSP-003 — cross-cutting: nothing removed on mobile so far.
- PRD-013 — mastery language (Unseen … Mastered, Needs refresh, "n demonstrations") is in the components; the screens that show progress are Phase 7.

## PARTIAL

- DATA-001 — the local chain is in place and verified: a UI action writes local state and IndexedDB immediately and the change's outbox row commits in the same transaction (`createSyncableStore`), nothing waits on the network, and the production-bundle probe renames the device with the page and the service worker offline, reloads offline, and finds the new name in IndexedDB. The last hop, `sync queue → server`, arrives with the Phase 4 transport, and the three acceptance interactions (note, workflow node, deterministic exercise) re-verify the flow when their features exist.
- INF-001 — React + TypeScript + Vite + Cloudflare Workers/Static Assets + Dexie (IndexedDB) are in place and building; D1/R2 (Phase 4) and Claude / ElevenLabs / Google Speech-to-Text (Phases 19–21) are not yet wired.
- INF-004 — local / preview / production are defined in `worker/wrangler.jsonc` with distinct Worker names and `BLOOMLAB_ENV` vars, and the client maps Vite modes in `apps/web/src/app/runtime.ts`. Preview and production deploys are now live and verified: `bloomlab-preview` (https://bloomlab-preview.cool-sunset-2169.workers.dev, health reports `preview`) and `bloomlab` (https://bloomlab.cool-sunset-2169.workers.dev, health reports `production`; deployed by run 33658838902). Remaining: D1 bindings per environment (Phase 4) and, where practical, separate R2 buckets.
- INF-005 — `.github/workflows/ci.yml` runs typecheck, lint, format check, unit tests, docs validation and build on pull requests and `main`; the preview deploy job (PR #1, run 33659265707) and the production deploy job (run 33658838902) both ran only after the checks passed. Remaining: the simulator regression (Phase 10) and content validation (Phase 5) steps do not exist yet.

## BLOCKED

None

## FAILED

None

## DEFERRED

- FLD-003 — optional GHL API verification is post-v1 by spec (TA§64).
- SEC-006 — recording consent/privacy legal pass applies only before a commercial launch (TA§49).

## NEXT

Phase 4 — D1 + Sync targets: SYNC-001 … SYNC-012, DATA-004, DATA-005, DATA-010; completes DATA-001 (queue → server) and SYNC-007.

## PHASE CHECKLIST (§163)

- [x] Phase 0 — Spec Package
- [x] Phase 1 — Repository Foundation: React, TypeScript, Vite, Worker, routing, design tokens, lint, tests, CI, environments
- [x] Phase 2 — Design System: typography, palette, surfaces, buttons, forms, holo system, motion, responsive primitives, focus states, reduced motion (visually verified)
- [x] Phase 3 — Local-First Data: IndexedDB, data services, local state persistence, sync queue primitives (DATA-001 completes with the Phase 4 transport)
- [ ] Phase 4 — D1 + Sync: learner, sync key, hashing, device sessions, sync, conflicts, offline recovery (verified across two device contexts)
- [ ] Phase 5 — Content Engine: schemas, YAML/MDX loading, validation, compilation, IDs, prerequisite resolution, feature registry
- [ ] Phase 6 — Learning Engine: skills, campaigns, mastery, evidence, review queue, session builder
- [ ] Phase 7 — Command Center + Skill Map: premium UI, real progress state, no fake metrics
- [ ] Phase 8 — Academy: interactive learning units with embedded small simulations
- [ ] Phase 9 — Exercise Runner: core shell + deterministic grading; Build It, Fix It, Run the Lead, Edge Case, Architecture Decision, Rebuild Blind
- [ ] Phase 10 — Simulator Core: account state, events, clock, scheduler, snapshots, replay, seeded randomness, logs
- [ ] Phase 11 — CRM Lab: core contact/pipeline state
- [ ] Phase 12 — Workflow Lab: flagship, extensive testing
- [ ] Phase 13 — Funnel Lab: forms connected to CRM/workflows
- [ ] Phase 14 — Calendar Lab: booking events connected
- [ ] Phase 15 — Troubleshooting + Reporting: diagnostic scenarios
- [ ] Phase 16 — Sales Exercises: Prospect It, Audit It, Write It, Explain It
- [ ] Phase 17 — Pricing Arena: pricing logic and scenarios
- [ ] Phase 18 — Negotiation: branching negotiation, limited AI when justified
- [ ] Phase 19 — AI Gateway: server routes, model routing, budget governor, structured grading, retry/failure behavior
- [ ] Phase 20 — Voice Asset System: reusable ElevenLabs assets
- [ ] Phase 21 — Call Room: turn-based voice simulations
- [ ] Phase 22 — Fieldwork: real-GHL proof flow
- [ ] Phase 23 — Portfolio: demonstration-project records
- [ ] Phase 24 — Field Ready Content: placement through capstone
- [ ] Phase 25 — Advanced Curriculum
- [ ] Phase 26 — Polish: responsive, accessibility, performance, design audit, simulator audit, GHL audit, content audit, adversarial test, gap audit

## ROLL-UP

311 requirements registered · 34 PASSED · 9 IN_PROGRESS · 3 PARTIAL · 0 BLOCKED · 2 DEFERRED · 263 NOT_STARTED. Run the validator for the live count by status and priority.
