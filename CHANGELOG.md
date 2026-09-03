# Changelog

All notable changes to Bloomlab. Format follows Keep a Changelog; versions follow `app_version` (spec §101).

## [Unreleased]

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
