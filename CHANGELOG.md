# Changelog

All notable changes to Bloomlab. Format follows Keep a Changelog; versions follow `app_version` (spec §101).

## [Unreleased]

### Added — Phase 6 · Learning Engine

- `@bloomlab/mastery-engine`: deterministic, versioned mastery rules (`MASTERY_RULES_VERSION`): the eight states with NEEDS_REFRESH as an overlay on the earned ladder, evidence kinds (exposure, quiz, guided practice, deterministic / independent exercise, pressure test, explanation, sales use, fieldwork, real-GHL, retrieval), the assistance table (nudge / concept reminder / worked example → independent / light / guided / heavy), the evidence schema with the full §30 field set, skill evaluation (state, confidence, missing requirements, review priority), the evidence-based review scheduler, prerequisite and campaign-gate evaluation with no clock input, and the session builder (30 min / 1 h / 2 h / deep; retrieval → repair → focus → campaign → fieldwork / project; Continue). A retrieval passed with guided or heavy assistance neither restores a NEEDS_REFRESH skill nor postpones its review (D-050); which evidence resets the review clock is an explicit, tested rule — `DEMONSTRATION_RULES` (D-051); retrieval maintains mastery and never advances it — `REVIEW_DEMONSTRATION_KINDS` vs `INDEPENDENT_KINDS` (D-052). No React, no network, no AI (D-044 … D-050).
- Learner records on the Phase 3/4 path: Dexie v3 adds `skill_evidence` and `exercise_attempts` (append-only, version-stamped with app / content / content hash / simulator / rules) and the derived `skill_progress`, `campaign_progress` and `review_queue` rows, recomputed from evidence on every device and after every sync that pulled something; all five sync through the existing outbox and Worker with no new migration (D-043, D-049).
- `recordEvidence` — the single write path for evidence: attempt + evidence rows in one IndexedDB transaction, schema-validated (an incomplete record aborts the write), then recompute. `buildLearnerSession` — the session builder over the compiled content and the learner's evidence.
- `/system` gains a diagnostic Learning section: skills with evidence (state badge, confidence, counts, review due, missing requirements), campaign gates, review queue with pass / fail retrieval, a record-evidence form (skill, optional exercise from content, kind, result, difficulty, hints, real-GHL proof) and Build my session with Continue.
- Verification: 51 engine tests over the required scenarios, 9 web tests for persistence, version stamping, content-change safety, prerequisite unlock, session building, two-device convergence and link-time re-keying; `npm run review:learning` drives two headless browsers (A records → syncs → B links and receives the same derived rows → B records a worked-example pass offline → reconnect → both devices agree). The sync probe now shares its browser helpers with the learning probe (`scripts/review/probe-lib.mjs`).

### Added — Phase 5 · Content Engine

- `@bloomlab/content-schema`: strict Zod schemas for all eleven content types (Skill, GHLFeature, Campaign, LearningUnit front matter, Exercise with the six assertion types, Scenario with account state and pricing economics, Client with the fifteen §38 fields and §39 hidden state, Rubric, Project, Portfolio, Glossary) plus the workflow-as-data definition (SIM-016) and the release manifest.
- Compiler `source → validate → resolve → compile`: YAML and MDX loading, ID/file-name rule, duplicate detection, cross-reference validation (skills, prerequisites and cycles, GHL features, clients, scenarios, campaigns, projects, exercises, rubrics, portfolio), campaign prerequisite order, REAL_GHL-never-simulated, removed-feature and feature-type checks, MDX syntax and embed checks; every error reported at once with file, path and message. Warnings list coverage gaps without failing the build.
- Compiled bundle: sorted records, skill graph (topological order, depth, dependents, territories), campaign paths, relationship indexes, the §137 content coverage matrix, the §138 GHL coverage matrix, the §151 freshness review list, a search index and the warnings; `npm run content:build` writes them to `.content/` (JSON + Markdown).
- Content versioning: `content/content.yaml` (`content_version`, `schema_version`), `content/content.lock.yaml` (source hash per version), `npm run content:lock` / `content:check`; CI runs `content:check` (D-038).
- Vite plugin `@bloomlab/content-schema/vite`: compiles at build time, fails the build on content errors, serves `virtual:bloomlab-content` (app) and `virtual:bloomlab-content/version` (Worker), rebuilds and reloads on content edits in `vite dev` (D-037). `/system` gains a Content section; `/api/health` reports the compiled content version.
- Seed content proving every type and relationship: 22 skills across all ten territories, 34 GHL registry records verified on help.gohighlevel.com (dated, sourced, limitations and approximations labelled), Field Ready (13 gates) and Advanced Automation campaigns, 3 MDX units with live embeds, 16 exercises across 13 families, 4 scenarios, 3 persistent clients, 5 versioned rubrics, 2 projects, 2 portfolio templates, 8 glossary terms.
- Tests: 71 content-engine tests — schema rules, the real tree, and fixture builds that fail on every broken-reference class (`docs/reviews/phase-5-content-engine.md`).

### Added — Phase 4 · D1 + Sync

- D1 schema `migrations/0001_init.sql`: the §93 tables in six domains plus `notes` (D-029); databases `bloomlab-dev` (local, preview) and `bloomlab-prod` (production) bound as `DB`; CI applies migrations to dev on pull requests and to prod on `main` before each deploy (D-033).
- Worker `/api/sync/*`: link with a Bloomlab Sync Key (server keeps `SHA-256(secret + pepper)`, pepper in a Worker secret), per-device revocable session tokens (stored hashed), push with the shared merge rules (simple / append / snapshot, `base_revision`, `force`), pull from the learner's change log, connected-devices list, revoke and rename. Tests run inside workerd against the real migration (D-032).
- Shared sync contract in `@bloomlab/shared`: entity kinds, envelope, API types, `decideMerge`, and the sync key (256-bit, Crockford base32 `BLM-XXXX-…` display, tolerant normalisation).
- Client sync engine: `linkThisDevice` (re-keys local records to the real learner), `syncNow` (push → pull, shadows, conflicts), `resolveConflict`, background scheduler; Dexie schema v2 adds `sync_shadow` and `sync_conflicts`.
- Screens: `/sync` (create or enter a key, recovery warning, copy / download recovery file / QR / "I saved it", connected devices with revoke, show key), the "Two versions were changed" chooser in the app frame, the indicator now links to sync; the device rename reaches the server; diagnostics show link state, cursor, last error and a newest-note editor.
- Idempotent pushes: a retry after a lost response is confirmed at the existing revision without a new log row; soft deletes propagate as tombstones and a stale edit of a deleted record is a conflict, not a resurrection.
- Verification: `npm run review:sync` drives two headless browsers through create-key → A writes and syncs → B links and receives → offline divergent edits → conflict chooser → convergence → deletion → revoke.

### Added — Phase 3 · Local-First Data

- `apps/web/src/data`: Dexie database `bloomlab` (v1: `device`, `notes`, `workspace`, `sync_queue`, `sync_state`), the SYNC-007 envelope and stamping helpers, `createSyncableStore` (record + outbox in one transaction, soft deletes, coalesced queue rows), the sync-queue primitives, device identity with a provisional learner id, workspace checkpoints, `useSyncStatus`, `useDevice`, `useNotes`, `useWorkspace` (D-025 … D-027).
- Quiet sync indicator in the app frame ("Offline · saved on this device" / "Saved on this device" / "Syncing…" / "Synced"); "This device" tile on the foundation home with an offline-safe rename; "Local data" section in System diagnostics (database, persisted storage, usage, record counts, sync queue, test-note actions).
- Installable PWA: `vite-plugin-pwa` service worker precaching the shell and stable assets, `/api/*` never cached, manifest and icons (`scripts/make-icons.mjs`), persistent-storage request (D-028).
- Verification: `npm run review:offline` (service-worker control, installability, offline shell, uncached API, offline write) and 37 web tests (Dexie layer on `fake-indexeddb`, hooks, device rename UI).

### Added — Phase 2 · Design System

- `packages/design-system` primitives: `HoloMaterial` modelled on the reference's foil trading card (pearl base, sweeping spectral bands with pointer-driven hue shift, metallic grain with parallax, edge-boosted glare that follows the pointer, iridescent rim light at the pointer angle, direction-aware shadow that deepens with the lift (D-023); ≤ 6° tilt with a 5 px lift, ≈ 120 ms follow easing and 420 ms eased settle in a frame loop (D-022), touch press/drag/release, reduced-motion and off-screen gating; soft / collectible / mastery / legendary), `Surface`, `InkSurface` (inverted roles), `ToolPanel`, `Inspector`, `Sheet` (native dialog), `Popover`, `Field` + `Input` / `Select` / `Textarea`, `Button`, `IconButton`; layout `Stack` / `Cluster` / `Grid` / `VisuallyHidden`; 22 stroke icons.
- Motion: state / spatial / execution / reward classes, `ExecutionTrack`, skippable `RewardReveal` clamped to 1.5–3 s, `usePrefersReducedMotion`, `useOnScreen`.
- Semantic components: `MasteryBadge`, `SkillCard`, `HoloTerritory`, `ClientCaseCover` (+ deterministic `IdentityMark`), `WorkflowNode`, `ExecutionEvent`, `ContactRow`, `PipelineCard`, `ExercisePrompt`, `PricingScopeItem`, `CallParticipant`, `StatusPill`.
- Contrast tooling: `contrastRatio` / `WCAG_AA` with tests enforcing every token pairing; role tokens `--bl-color-link` / `--bl-color-focus` (`#3B69BD`) and Ink Faint tuned to `#86819C` (D-017).
- `/design` gallery behind the `design_gallery` flag (local/preview), `?section=` deep links; Phase 1 screens moved onto the primitives.
- 76 unit tests across the design system, shared, worker and web.
- Visual-review tooling `scripts/review/` (`npm run review:capture`, `npm run review:holo`; a DevTools-Protocol driver for headless Chrome, D-024) and the Phase 2 review log `docs/reviews/phase-2-visual-review.md` (five widths, sixty page audits, HoloMaterial measurements against the live reference, §136 coverage matrix).

### Fixed — Phase 2

- `SkillCard`: the header wraps, so the mastery badge no longer pokes past the card edge or splits the title into hyphenated fragments in three- and four-column grids (found in the 768–1440 review).

### Deployed

- Production Worker `bloomlab` (https://bloomlab.cool-sunset-2169.workers.dev) deploys on every push to `main`; preview Worker `bloomlab-preview` (https://bloomlab-preview.cool-sunset-2169.workers.dev) redeploys on every pull request (D-020). Verified end to end from PR #1.

### Added — Phase 1 · Repository Foundation

- npm-workspaces monorepo per spec §102: `apps/web`, `worker`, `packages/{shared, design-system, simulator-core, exercise-engine, mastery-engine, content-schema}`, `content/`, `migrations/`, `tests/`, `public/`.
- `apps/web`: React 19 + TypeScript 6 + Vite 8, React Router 8 declarative routing with a flag-gated route registry and per-screen lazy chunks; Phase 1 foundation home, flag-gated `/system` diagnostics, not-found screen, skip link, visible focus styles.
- `worker`: Cloudflare Worker (Workers + Static Assets, `run_worker_first: ["/api/*"]`) with `/api/health` returning the version triplet and environment; local / preview / production environments in `wrangler.jsonc`.
- `packages/shared`: `APP_VERSION`, `CONTENT_VERSION`, runtime environment parsing, feature flags per environment.
- `packages/design-system`: full token set as CSS variables (color, spacing, radius, shadow, motion, typography, holographic material, density, z-index, breakpoints) with a TypeScript mirror, reduced-motion overrides, and self-hosted fonts.
- Tooling: ESLint 10 + typescript-eslint (strict, `no-explicit-any`), Prettier, Vitest 4 projects (jsdom for web), `strict` TypeScript everywhere.
- GitHub Actions CI: typecheck · lint · format · unit tests · control-doc validation · build on PR and `main`; preview/production deploy jobs gated on `CLOUDFLARE_DEPLOY`.

### Added — Phase 0 · Spec Package

- `CLAUDE.md`, `PRODUCT_VISION.md`, `CURRICULUM_MASTER_MAP.md`, `DESIGN_SYSTEM.md`, `TECH_ARCHITECTURE.md`, `CONTENT_ARCHITECTURE.md`, `SIMULATOR_SPEC.md`, `EXERCISE_ENGINE.md`, `REQUIREMENTS_MATRIX.md`, `ACCEPTANCE_TESTS.md`, `IMPLEMENTATION_STATUS.md`, `KNOWN_LIMITATIONS.md`.
- `docs/DECISIONS.md` decision log and `scripts/validate-requirements.mjs` control-document validator.
- Repository baseline: `.gitignore`, `.gitattributes` (LF), `README.md`.

### Versions

- app: 0.1.0
- content: none (`CONTENT_VERSION = null` until the content compiler exists)
- simulator: 0.0.0 (no engine yet)
