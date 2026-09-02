# IMPLEMENTATION STATUS

Concise roll-up in the spec §139 format. `REQUIREMENTS_MATRIX.md` is the source of truth for statuses; this file must agree with it. `node scripts/validate-requirements.mjs` enforces that agreement.

Last updated: 2026-09-02

## CURRENT PHASE

Phase 1 — Repository Foundation: **complete locally** — typecheck, lint, format, 21 unit tests, docs validation and build all pass; the running app was checked in a browser at 320, 390, 768, 1024 and 1440 with the Worker answering `/api/health`. GitHub Actions run 33653862745 passed all six steps in 39 s with deploy jobs skipped as designed. Phase 2 — Design System has not started and is waiting for the go-ahead.

## VERSIONS

- app: 0.1.0
- content: none (`CONTENT_VERSION = null` until the content compiler exists)
- simulator: 0.0.0 (no engine yet)

## PASSED

- INF-002 — evidence: the §102 tree exists (`apps/web`, `worker`, six `packages/*`, `content/`, `migrations/`, `tests/`, `scripts/`, `docs/`, `public/`); every package has its own `package.json` and `tsconfig.json`; `npm run typecheck` runs all eight workspaces.
- INF-003 — evidence: conventional commits on `main`; LF enforced via `.gitattributes`.
- INF-009 — evidence: `tsconfig.base.json` has `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`; no `.js`/`.jsx` under `apps/`, `worker/`, `packages/`; ESLint `@typescript-eslint/no-explicit-any` is an error; typecheck passes.
- INF-010 — evidence: `packages/shared/src/featureFlags.ts` with per-environment defaults; `apps/web/src/app/App.test.tsx` proves `/system` is unreachable by URL and unlinked from home when `system_diagnostics` is off, and reachable when on; browser check in local dev shows the route on.
- INF-012 — evidence: Phase 0 and Phase 1 commit messages reference requirement IDs.
- INF-014 — evidence: control documents updated for Phase 1; validator exits 0.
- DES-014 — evidence: `packages/design-system/src/tokens.css` declares all ten TA§3 categories (`--bl-color-*`, `--bl-space-*`, `--bl-radius-*`, `--bl-shadow-*`, `--bl-motion-*`, `--bl-font-*`, `--bl-holo-*`, `--bl-density-*`, `--bl-z-*`, `--bl-bp-*`); `tokens.test.ts` verifies the nineteen §65 colours, breakpoints, motion ranges and the reduced-motion override.

## IN PROGRESS

- INF-013 — `APP_VERSION`, `CONTENT_VERSION` (null) and `SIMULATOR_VERSION` are exported and surfaced by `/api/health` and `/system`; the attempt records that must persist them arrive with the learning engine (Phase 6) and exercise runner (Phase 9).

## PARTIAL

- INF-001 — React + TypeScript + Vite + Cloudflare Workers/Static Assets are in place and building; Dexie (Phase 3), D1/R2 (Phase 4) and Claude / ElevenLabs / Google Speech-to-Text (Phases 19–21) are not yet wired.
- INF-004 — local / preview / production are defined in `worker/wrangler.jsonc` with distinct Worker names and `BLOOMLAB_ENV` vars, and the client maps Vite modes in `apps/web/src/app/runtime.ts`; D1 bindings are Phase 4; preview and production deploys need Cloudflare secrets (see BLOCKED).
- INF-005 — `.github/workflows/ci.yml` runs typecheck, lint, format check, unit tests, docs validation and build on pull requests and `main`, with deploy jobs gated behind the checks; observed passing on GitHub (run 33653862745); the simulator regression (Phase 10) and content validation (Phase 5) steps do not exist yet.

## BLOCKED

- RSP-005 — preview deploys need the repository variable `CLOUDFLARE_DEPLOY=true` and the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` on GitHub (Cloudflare account "Bloomwired"). User action; nothing has been deployed.

## FAILED

None

## DEFERRED

- FLD-003 — optional GHL API verification is post-v1 by spec (TA§64).
- SEC-006 — recording consent/privacy legal pass applies only before a commercial launch (TA§49).

## NEXT

Phase 2 — Design System targets: DES-001, DES-002, DES-003, DES-004, DES-005, DES-007, DES-015, DES-016, DES-019, HOL-001, HOL-002, HOL-003, HOL-004, MOT-001, MOT-002, MOT-003, MOT-004, PERF-003, A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005, A11Y-007, A11Y-008, A11Y-009.

## PHASE CHECKLIST (§163)

- [x] Phase 0 — Spec Package
- [x] Phase 1 — Repository Foundation: React, TypeScript, Vite, Worker, routing, design tokens, lint, tests, CI, environments
- [ ] Phase 2 — Design System: typography, palette, surfaces, buttons, forms, holo system, motion, responsive primitives, focus states, reduced motion (visually verified)
- [ ] Phase 3 — Local-First Data: IndexedDB, data services, local state persistence, sync queue primitives
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

311 requirements registered · 7 PASSED · 1 IN_PROGRESS · 3 PARTIAL · 1 BLOCKED · 2 DEFERRED · 297 NOT_STARTED. Run the validator for the live count by status and priority.
