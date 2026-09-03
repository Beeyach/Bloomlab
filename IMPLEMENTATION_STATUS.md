# IMPLEMENTATION STATUS

Concise roll-up in the spec §139 format. `REQUIREMENTS_MATRIX.md` is the source of truth for statuses; this file must agree with it. `node scripts/validate-requirements.mjs` enforces that agreement.

Last updated: 2026-09-02

## CURRENT PHASE

Phase 6 — Learning Engine: **complete** — `packages/mastery-engine` is a pure, deterministic domain package (no React, no network, no AI) with versioned explicit rules: the eight mastery states (NEEDS_REFRESH as an overlay on the earned ladder), an evidence schema carrying every §30 field and the version stamp, the assistance table (nudge / concept reminder / worked example → independent / light / guided / heavy), skill evaluation (state, confidence, missing requirements, review priority), the evidence-based review scheduler, clock-free prerequisite and campaign-gate evaluation, and the session builder (30 min / 1 h / 2 h / deep, Continue). Learner records live on the Phase 3/4 path: append-only evidence and attempts plus derived skill, campaign and review rows in Dexie v3, synced through the existing outbox and Worker with no new migration. Verified by 51 engine tests over the required scenarios, 9 web persistence / sync tests, and `npm run review:learning` across two browser contexts (A records → B receives the same derived rows → B records a worked-example pass offline → reconnect → both agree). Evidence enters through the diagnostic form on `/system` until Phases 8–9 produce it. CUR-002 stays partial (two Field Ready gates have no authored skills); INF-018 (P2 analytics) is not started. Phase 7 — Command Center + Skill Map is waiting for the go-ahead.

## VERSIONS

- app: 0.1.0
- content: 2026.09.02 (`content/content.yaml`, locked by `content/content.lock.yaml`)
- simulator: 0.0.0 (no engine yet)
- mastery rules: 2026.09.02-r1 (`MASTERY_RULES_VERSION`, stamped on every evidence record and evaluation)

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

- DES-001 — evidence: reference site studied live with a real pointer (tiles lift 8 px with a gradient ring and deeper shadow; the foil card is a photograph with a 4.5 s float; the only pointer-driven motion is a background parallax) and adapted into tokens and HoloMaterial (D-021, D-023); `docs/reviews/phase-2-visual-review.md`.
- DES-002 — evidence: gallery review of Skill Map territories, client covers and mastery states at all widths; sign-off recorded in KNOWN_LIMITATIONS as a judgment call pending the learner's own review.
- DES-003 — evidence: `HoloMaterial` is used only by SkillCard (independent and above), HoloTerritory, ClientCaseCover, the reward demo and the gallery; everything else uses `Surface` / `InkSurface`.
- DES-004 — evidence: `tokens.css` carries the nineteen §65 values with one documented contrast tuning (Ink Faint → `#86819C`, D-017); `tokens.test.ts` and `contrast.test.ts` enforce them.
- DES-005 — evidence: Bricolage Grotesque Variable, Inter Variable and IBM Plex Mono self-hosted via `@fontsource`; `document.fonts.check` true for all three in the running app; system fonts only in fallback stacks.
- DES-007 — evidence: SkillCard, ClientCaseCover, WorkflowNode, ExercisePrompt, MasteryBadge, ContactRow, PipelineCard, HoloTerritory, CallParticipant, PricingScopeItem, ExecutionEvent exist and share tokens; no `Card` export.
- DES-015 — evidence: HoloMaterial, Surface, InkSurface, ToolPanel, Sheet, Inspector, Popover, Field, Button, IconButton exist with focus styles and reduced-motion handling; 27 primitive tests.
- DES-016 — evidence: CSS Modules + custom properties everywhere; Tailwind absent from the lockfile.
- DES-019 — evidence: the Phase 1 screens now use Stack, Grid, Surface, Button; no placeholder grey UI remains.
- HOL-001 — evidence: five layers (pearl base, spectral bands, metallic grain, pointer-following glare, iridescent rim light) plus tilt, 5 px lift, direction-aware shadow that deepens with the lift, and touch response, modelled on the reference's foil card (D-021, D-023); measured on the production bundle in `docs/reviews/phase-2-visual-review.md`.
- HOL-002 — evidence: soft, collectible, mastery, legendary render distinctly in the gallery with stepped band/grain/glare intensities; legendary keeps the palette family (−20° hue, peach glow), no strobing, no idle animation.
- HOL-003 — evidence (production bundle, DevTools mouse input, `npm run review:holo`): pointer at 92 % / 9 % of a card → rotateX −4.98° / rotateY −5.08° (≤ 6°), lift −4.98 px, bands 92 % 9 % with hue +29.4°, glare translated +102 / −74 px at 0.96 opacity, rim shifted −3.94 %; follow reaches 95 % of a step in ~150 ms; release settles to rest in ~520 ms (≤ 600 ms) with no overshoot.
- HOL-004 — evidence (390 px mobile emulation, `pointer: coarse`, DevTools touch input): press at 20 % / 30 % → `nx −0.60, ny −0.40`, lift 1, glare −105 / −36 px; drag to 85 % / 80 % → `nx 0.68, ny 0.64`, glare +119 / +58 px; release → every property back at rest.
- MOT-001 — evidence: `motion.module.css` defines state, spatial, execution and reward classes; `RewardReveal` and `ExecutionTrack` components.
- MOT-002 — evidence: tokens 120 / 200 / 300 ms; reward duration clamped to 1500–3000 ms with a Skip control (unit tests).
- MOT-003 — evidence: with `prefers-reduced-motion: reduce` emulated on the production bundle the motion tokens read 0 ms, the holo tokens read `0deg / 0`, a hovered card stays at rest with its material intact, the reward end state shows immediately and the execution track renders its final state.
- MOT-004 — evidence: no idle animations; live pulse and speaking ring are gated by `useOnScreen` (IntersectionObserver) with unit tests; HoloMaterial detaches pointer work off-screen.
- PERF-003 — evidence: runtime `blur()` removed from the material after it stalled software rendering; static variant available for dense lists; same off-screen gating as above.
- A11Y-001 — evidence: every interactive element is a native button, link, input, select, textarea or dialog; keyboard tests for Button, SkillCard, Popover (Escape), Sheet (cancel); Tab reaches controls in the running app.
- A11Y-002 — evidence: `:focus-visible` ring observed in the running app (`solid` outline in `#3B69BD`); aqua ring inside ink surfaces.
- A11Y-003 — evidence: Field wires label, hint and error ids (tests); IconButton requires a label; gallery audit finds every control labelled.
- A11Y-004 — evidence: `contrast.test.ts` proves every text/surface, link, focus and ink-context pairing meets AA; palette swatches show live ratios.
- A11Y-005 — evidence: MasteryBadge has a distinct glyph and word per state; StatusPill always carries text; tests.
- A11Y-007 — evidence: 44 px minimum on Button, IconButton, controls and rows; small buttons grow to 44 px on coarse pointers; the 320 / 390 audits (coarse pointer) list no control under 44 px except the three native 20 px pricing checkboxes, whose `label[for]` hit area is 44 px.
- A11Y-008 — evidence: controls use `max(1rem, …)`; gallery audit reports 16 px for every control.
- A11Y-009 — evidence: hover only changes styling; IconButton duplicates its label as `title`; no tooltip-only content.

Phase 3:

- DATA-002 — evidence: `apps/web/src/data/db.ts` opens IndexedDB `bloomlab` through Dexie 4 with five tables (`device`, `notes`, `workspace`, `sync_queue`, `sync_state`) and no layer on top; every read and write goes through Dexie tables or `liveQuery`; the schema, envelope and store tests run on `fake-indexeddb`.
- DATA-003 — evidence: `vite-plugin-pwa` (Workbox `generateSW`) precaches the shell, scripts, styles, icons and fonts (45 entries, 993 KiB); `/api/*` is `NetworkOnly` and excluded from the navigation fallback; `/content/*` (Phase 5) is stale-while-revalidate; manifest with 192 / 512 / maskable icons. Production-bundle probe: service worker controlling the page, `Page.getAppManifest` without errors, `Page.getInstallabilityErrors` empty (Chrome's install criteria met), and with offline emulated on the page *and* the worker the shell renders from the precache while `fetch('/api/health')` fails instead of being served from cache.

Phase 4:

- DATA-004 — evidence: `migrations/0001_init.sql` contains only learner-data, identity, AI and system tables; the Worker schema test asserts no `skills`, `units`, `exercises`, `ghl_features` or `registry` table exists; curriculum stays in Git (`content/`, compiled at build time since Phase 5).
- DATA-005 — evidence: the migration creates the six §93 domains (learners, devices, sync_sessions · skill_progress, skill_evidence, campaign_progress, exercise_attempts, review_queue, fieldwork · sim_projects, sim_snapshots, sim_events, client_progress · portfolio_projects, portfolio_assets · ai_usage, ai_feedback, rubric_runs · content_versions, sync_operations, feature_flags) plus `notes` (D-029); the Worker schema test lists them all.
- DATA-010 — evidence: `worker/wrangler.jsonc` binds `bloomlab-dev` (local, preview) and `bloomlab-prod` (production); the migration was applied to dev first by hand and CI applies dev on every PR and prod only on `main`, before each deploy (D-033).
- SYNC-001 — evidence: two headless browser contexts linked by one key show the same note and the same conflict resolution with no login screen anywhere (`docs/reviews/phase-4-d1-sync.md`).
- SYNC-002 — evidence: `generateSyncKey` draws 32 bytes from `crypto.getRandomValues` (256 bits; `decodeSyncKey` round-trips them in the test) and displays `BLM-` plus thirteen groups of four Crockford base32 characters; normalisation accepts case, spacing, hyphens and the O/0, I/L/1 confusables.
- SYNC-003 — evidence: the Worker test reads the `learners` row after linking and finds only `key_hash = SHA-256(secret + SYNC_KEY_PEPPER)`; the pepper is read from the secret binding and never stored; `link` answers 503 when it is missing.
- SYNC-004 — evidence: after linking, every request carries `Authorization: Bearer <session token>`; D1 `devices` has exactly the seven fields; revoking a device clears its token hash and the Worker test shows its next `devices` and `pull` calls answered 401; the client unlinks itself on 401.
- SYNC-005 — evidence: `/sync` lists connected devices with label, last seen and a current-device tag; Revoke (other devices) and Unlink (this device) call `/api/sync/devices/revoke`; verified in the Worker test and in the two-device probe.
- SYNC-006 — evidence: the key screen states the recovery limitation (no account, no reset, loss of every device plus the key means no server recovery), offers Copy, Download recovery file (`bloomlab-sync-key.json`), Show QR and an "I saved my sync key" confirmation that gates linking.
- SYNC-008 — evidence: `decideMerge` (shared, unit-tested) implements simple = fast-forward else newest `updated_at`, append = id-addressed union, snapshot = conflict on divergence from another device; Worker tests exercise fast-forward, conflict and forced resolution.
- SYNC-009 — evidence: divergent offline edits of the same note on two devices produce a `conflict` outcome; the second device stores both versions and shows "Two versions were changed. Choose which version to keep."; the local text is untouched until the learner chooses; choosing converges both devices (probe steps "reconnect" and "resolved").
- SYNC-010 — evidence: offline edits show "Offline · saved on this device" / "Saved on this device"; reconnecting syncs in the background and the indicator reads "Synced"; there is no modal anywhere in the flow (the conflict chooser appears only for a genuine conflict and can be postponed).
- SYNC-011 — evidence: `docs/reviews/phase-4-d1-sync.md` records the two-context run (create key → link → note sync → offline edits → chooser → convergence → deletion → revoke) with captures.
- SYNC-012 — evidence: 130 tests at the end of Phase 4; sync-specific: shared merge rules and key (9), Worker link/push/pull/devices/schema in workerd (14), client engine link/push/pull/conflict/offline/retry/deletion/unauthorised (12), plus the Phase 3 store and queue tests.
- SEC-004 — evidence: same as SYNC-003.

Phase 5:

- CNT-001 — evidence: no lesson prose, exercise definition, skill or registry record exists in `apps/web` TSX; screens read `apps/web/src/content/bundle.ts`, which re-exports the compiled bundle; `ContentDiagnostics` renders counts and IDs from the bundle only.
- CNT-002 — evidence: all eleven folders exist under `content/` with records in each; `classifySources` rejects any file outside them (`INVALID_FORMAT`, fixture test).
- CNT-003 — evidence: definitions are YAML, learning units are MDX with YAML front matter; `FOLDER_EXTENSIONS` rejects other formats (a JSON file in `skills/` fails the build in the fixture test and in the demonstration).
- CNT-004 — evidence: `packages/content-schema/src/schemas/` has SkillSchema, GhlFeatureSchema, CampaignSchema, LearningUnitFrontMatterSchema, ExerciseSchema (six assertion types), ScenarioSchema, ClientSchema, RubricSchema, ProjectSchema, PortfolioSchema, GlossarySchema, WorkflowDefinitionSchema and ManifestSchema; 30 schema tests exercise required fields, enums, strictness and cross-field rules.
- CNT-005 — evidence: 28 fixture tests fail the build on duplicate ID, id/file-name mismatch, missing prerequisite, prerequisite cycle, territory mismatch, missing GHL feature, missing scenario, missing client, scenario/client mismatch, missing campaign skill, campaign prerequisite order, campaign missing prerequisite, missing project, REAL_GHL as simulator action, feature-type mismatch, removed feature, rubric type mismatch, missing rubric, invalid format, enum violation, MDX syntax, unknown embed, embed missing reference, missing manifest and lock mismatch; the same breakages applied to the real tree are logged in the Phase 5 review.
- CNT-006 — evidence: the Vite plugin compiles once per build and serves `virtual:bloomlab-content`; `vite build` fails on a content error; the client bundle contains no YAML or MDX parser (they live in `@bloomlab/content-schema/node`, imported only by the plugin, the CLI and tests); the app reads indexes (`graph`, `campaign_paths`, `indexes`, `coverage`) rather than scanning files.
- CNT-008 — evidence: `ClientSchema` requires all fifteen §38 fields plus `hidden_state`; a test removes each field in turn and expects failure; three seeded clients pass.
- CNT-011 — evidence: the Checks job runs `npm test` (71 content tests, incl. the real tree: all IDs valid, no missing prerequisite, no unknown GHL feature) and `npm run content:check` on every pull request and push to `main`; first green run on PR #5: 33718316982 (Checks and Preview deploy succeeded).
- CUR-001 — evidence: campaigns carry skill IDs only (`z.array(skillRef)`; an inline object fails the schema); each skill appears in one gate per campaign; the compiled `campaign_paths` resolve Field Ready to 20 ordered skills whose prerequisites all precede them (test).
- CUR-016 — evidence: `TERRITORIES` has the nine territories plus JUDGMENT; every skill's territory is checked against its ID; the compiled graph reports all ten territories populated (test).
- CUR-033 — evidence: `buildContentCoverage` derives Skill × Learn / Guided / Practice / Fix / Independent / Pressure / Fieldwork / Sales Use from units and exercises; a hand-checked row for `SK-AUTOMATE-no-show-recovery` (learn 0, guided 1, independent 1, gaps learn / pressure / fieldwork) matches in the test; `.content/coverage-content.md` is written on every build.
- GHL-001 — evidence: `GhlFeatureSchema` requires `id, official_name, area, feature_type, implementation_type, status, simulation_fidelity, last_verified, source_url, known_limitations, skills, supported_configs`; a test removes each and expects failure; 34 records at `content/ghl-features/`.
- GHL-002 — evidence: `implementation_type` enum `native_ghl | integration | custom_code | external_service`; `zapier` fails (test).
- GHL-003 — evidence: `status` enum `current | needs_review | deprecated | removed`; `active` fails (test and demonstration).
- GHL-004 — evidence: `simulation_fidelity` enum `A | B | C | REAL_GHL`; fidelity B and C require `approximation_note` (schema test); a REAL_GHL feature in a simulator exercise's `allowed_features` or a scenario workflow fails the build (`REAL_GHL_AS_SIMULATOR_ACTION`, fixture test and demonstration); no invented native feature exists in the registry.
- GHL-006 — evidence: every record's `source_url` is an https page on `help.gohighlevel.com` (schema rule; YouTube and http fail the test), with `last_verified: 2026-09-02` and a `verification_note` saying what was confirmed where; the verification log is in `docs/reviews/phase-5-content-engine.md`. Names follow the current help-center articles (e.g. `Wait` with alias `Wait Step`, `If/Else`, `Webhook` with alias `Custom Webhook`, `Create/Update Opportunity`).
- GHL-007 — evidence: `buildGhlCoverage` derives GHL Feature × Skill / Simulator / Fidelity / Exercise / Fieldwork / Last Verified; the test checks `GHL-WF-APPOINTMENT-STATUS` (simulated, used by the BUILD IT) and `GHL-SNAP-SNAPSHOTS` (REAL_GHL, never simulated, fieldwork only); `.content/coverage-ghl.md` is written on every build.

Phase 6:

- MAS-001 — evidence: `MASTERY_STATES` is exactly the eight states; `evaluateSkill` returns only them (engine test "only ever emits the eight states"); NEEDS_REFRESH keeps `refresh_from` so the earned rung is never lost.
- MAS-002 — evidence: `EXPOSURE_ONLY_KINDS` (exposure, quiz) never count as attempts; ten exposures plus a passed quiz evaluate to LEARNING (engine test 2); the web test records a unit exposure and reads LEARNING.
- MAS-003 — evidence: `SkillEvidenceSchema` requires skill, exercise, result, score, assistance, difficulty, critical failures, date, versions (app, content, content hash, simulator, rules) and real-GHL evidence; the engine test removes each field and expects rejection; `recordEvidence` validates inside the write transaction and an incomplete record writes nothing (web test).
- MAS-005 — evidence: due reviews go into the session's retrieval block; a due or NEEDS_REFRESH prerequisite never locks what depends on it (campaign test "never locks"); a failed retrieval sets NEEDS_REFRESH immediately and re-queues the skill (review test); a passed retrieval restores the earned state with the history intact (review test 14).
- MAS-006 — evidence: `buildSession` offers 30m / 1h / 2h / deep (30 / 60 / 120 / 240 min), consumes active campaign, current gate, weak prerequisites, review due, recent failures, assistance dependence, pending fieldwork and the active project, is deterministic (same input → equal plan), contains no AI call, and Continue rebuilds without the finished items (session tests); the diagnostic UI exposes Build my session and Continue.
- MAS-007 — evidence: `assistanceFromHints` implements the four levels from hint use; `assistanceDependence` is computed on every plan; UI copy names levels only ("independent", "guided") with no grades or shaming; MASTERED requires unassisted passes (D-045).
- MAS-008 — evidence: `packages/mastery-engine` imports only `zod`; inputs skill definition, evidence history (assistance, difficulty, recency, critical failures, fieldwork requirement) → outputs `state`, `confidence`, `missing_requirements`, `review_priority` (plus the counts behind them); 51 tests.
- MAS-009 — evidence: the scheduler uses last_demonstrated, failure_rate, mastery (ladder) level and importance to compute review_due and priority; tests cover interval arithmetic, ordering by priority and exclusion of skills below PRACTICED.
- MAS-011 — evidence: a pass with a worked example rolls up to heavy assistance, evaluates to GUIDED, and counts zero independent passes (engine test 4; the two-device probe records one and both devices show "independent 0/3").
- PRD-002 — evidence: no engine function that decides availability, gates or next work takes a clock; the campaign test evaluates the same history "two years later" and gets identical gate statuses; grep of the app finds no "tomorrow" / "come back" copy.
- PRD-003 — evidence: gates resolve on evidence counts and kinds (campaign test 9); a quiz never changes the ladder; an independent exercise does (web test).
- CNT-007 — evidence: every evidence and attempt record stores `versions.content` and `versions.content_hash` at write time (web test 16) and keeps them when the bundle changes (web test "never rewrites").
- DATA-011 — evidence: after recording evidence, recomputing against a bundle with a new content version and every registry record marked deprecated leaves the stored evidence byte-identical while the derived row records the new content version (web test).
- INF-013 — evidence: `currentVersions()` stamps app (`@bloomlab/shared`), content + hash (compiled bundle), simulator (`@bloomlab/simulator-core`) and rules on every attempt and evidence record; `/api/health` and `/system` show the triplet; the Learning section shows the stamp on every recent evidence row.

Deployment:

- RSP-005 — evidence: PR #1 triggered CI run 33659265707; the Preview deploy job ran (not skipped), built with `CLOUDFLARE_ENV: preview` and deployed `bloomlab-preview` to https://bloomlab-preview.cool-sunset-2169.workers.dev. `/api/health` returned `{"environment":"preview"}` and the preview `/system` route was reachable from a phone-width viewport.

## IN PROGRESS

- DES-006 — cross-cutting: Phase 2 gallery reviewed against the §70 list (no gradient heroes, gradient text, glassmorphism, blobs, icon-per-heading, card-everything, fake stats, emoji nav, trophies, huge shadows, confetti); re-checked every phase.
- DES-008 — density mechanism (`data-density`, `--bl-density-row`) implemented in ToolPanel and rows; per-environment assignment happens with the screens (Phase 7+).
- DES-012 — ClientCaseCover with the abstract IdentityMark exists; three persistent clients are seeded as content (Phase 5); the Clients environment is Phase 24.
- DES-017 — cross-cutting: Phase 2 review at 1440 / 1024 / 768 / 390 / 320 done for every gallery section and the Phase 1 screens with `npm run review:capture` (sixty page audits; one SkillCard badge overflow found and fixed); log in `docs/reviews/phase-2-visual-review.md`; the Phase 5 `/system` Content section checked at 1440 / 390 / 320.
- DES-018 — cross-cutting: the §136 matrix for the four Phase 1–2 screens (desktop, tablet, mobile, empty, loading, error, keyboard, touch) is recorded in `docs/reviews/phase-2-visual-review.md`; extended as screens arrive.
- RSP-001 — cross-cutting: all five widths captured and audited in Phase 2 (no horizontal overflow, clipping or off-viewport element on any of the sixty pages); later phases check the screens they touch.
- RSP-002 — cross-cutting: tablet compositions are deliberate (three-column skill cards, two-column panels and forms at 768); ContactRow, ExecutionEvent, SkillCard headers, CallParticipant and Sheet recompose on mobile; more recompositions come with the labs.
- RSP-003 — cross-cutting: nothing removed on mobile so far.
- PRD-013 — mastery language (Unseen … Mastered, Needs refresh, "n demonstrations") is in the components; the screens that show progress are Phase 7.

## PARTIAL

- DATA-001 — the whole chain `UI → local state → IndexedDB → sync queue → server` runs end to end and is verified across two browser contexts on the local and deployed preview (`npm run review:sync`): a note written on device A lands in Dexie and the outbox before any network call, syncs to D1, and appears on device B. Remaining acceptance interactions — moving a workflow node and completing a deterministic exercise offline — belong to Phases 12 and 9.
- SYNC-007 — every synced record carries `id, learner_id, updated_at, revision, device_id, deleted_at` (plus `created_at`), the outbox coalesces repeated pending changes per record so a keystroke stream becomes one operation, the Worker rejects writes for another learner, and soft deletes travel as tombstones. Remaining: "not every drag coordinate" is proven only once workflow nodes exist (Phase 12).
- CUR-002 — `CAMP-FIELD_READY` defines gates 0–12 as competency gates (placement plus twelve progression gates) and the engine resolves them on evidence only; gates 6 (Conversion and Copy) and 12 (Capstone) have no authored skills yet, so their §11 competencies are not mapped to skills until Phase 24.
- INF-001 — React + TypeScript + Vite + Cloudflare Workers/Static Assets + Dexie (IndexedDB) + D1 (dev and prod, bound and migrated) are in place and building; R2 (Phase 20) and Claude / ElevenLabs / Google Speech-to-Text (Phases 19–21) are not yet wired.
- INF-004 — local / preview / production are defined in `worker/wrangler.jsonc` with distinct Worker names and `BLOOMLAB_ENV` vars, and the client maps Vite modes in `apps/web/src/app/runtime.ts`. Preview and production deploys are now live and verified: `bloomlab-preview` on pull requests and `bloomlab` on `main`, each with its own D1 database and secrets. Remaining: R2 buckets and the AI/voice secrets per environment (Phases 19–21).
- INF-005 — `.github/workflows/ci.yml` runs typecheck, lint, format check, unit tests, docs validation, content validation (`content:check`, since Phase 5) and build on pull requests and `main`; the preview deploy job (PR #1, run 33659265707) and the production deploy job (run 33658838902) both ran only after the checks passed; since Phase 4 each deploy job applies D1 migrations (dev on PRs, prod on `main`) before deploying, and the Worker tests run inside workerd. Remaining: the simulator regression step (Phase 10).

## BLOCKED

None

## FAILED

None

## DEFERRED

- FLD-003 — optional GHL API verification is post-v1 by spec (TA§64).
- SEC-006 — recording consent/privacy legal pass applies only before a commercial launch (TA§49).

## NEXT

Phase 7 — Command Center + Skill Map targets: DES-009 … DES-013, PRD-007, PRD-012 … PRD-014, MAS-007 (the quiet meter's screen), the learner-facing views over the Phase 6 derived rows — real progress state, no fake metrics.

## PHASE CHECKLIST (§163)

- [x] Phase 0 — Spec Package
- [x] Phase 1 — Repository Foundation: React, TypeScript, Vite, Worker, routing, design tokens, lint, tests, CI, environments
- [x] Phase 2 — Design System: typography, palette, surfaces, buttons, forms, holo system, motion, responsive primitives, focus states, reduced motion (visually verified)
- [x] Phase 3 — Local-First Data: IndexedDB, data services, local state persistence, sync queue primitives (DATA-001 completes with the Phase 4 transport)
- [x] Phase 4 — D1 + Sync: learner, sync key, hashing, device sessions, sync, conflicts, offline recovery (verified across two browser contexts with `npm run review:sync`)
- [x] Phase 5 — Content Engine: schemas, YAML/MDX loading, validation, compilation, IDs, prerequisite resolution, feature registry (seed content compiled and verified; curriculum authoring is Phase 24)
- [x] Phase 6 — Learning Engine: skills, campaigns, mastery, evidence, review queue, session builder (deterministic engine, learner records synced, verified across two browser contexts with `npm run review:learning`)
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

311 requirements registered · 82 PASSED · 9 IN_PROGRESS · 6 PARTIAL · 0 BLOCKED · 2 DEFERRED · 212 NOT_STARTED. Run the validator for the live count by status and priority.
