# Changelog

All notable changes to Bloomlab. Format follows Keep a Changelog; versions follow `app_version` (spec §101).

## [Unreleased]

### Added — Phase 2 · Design System

- `packages/design-system` primitives: `HoloMaterial` (pearl, spectral, reflection, foil, sheen; pointer tilt ≤ 6°, touch press/drag/release, 420 ms settle, reduced-motion and off-screen gating; soft / collectible / mastery / legendary), `Surface`, `InkSurface` (inverted roles), `ToolPanel`, `Inspector`, `Sheet` (native dialog), `Popover`, `Field` + `Input` / `Select` / `Textarea`, `Button`, `IconButton`; layout `Stack` / `Cluster` / `Grid` / `VisuallyHidden`; 22 stroke icons.
- Motion: state / spatial / execution / reward classes, `ExecutionTrack`, skippable `RewardReveal` clamped to 1.5–3 s, `usePrefersReducedMotion`, `useOnScreen`.
- Semantic components: `MasteryBadge`, `SkillCard`, `HoloTerritory`, `ClientCaseCover` (+ deterministic `IdentityMark`), `WorkflowNode`, `ExecutionEvent`, `ContactRow`, `PipelineCard`, `ExercisePrompt`, `PricingScopeItem`, `CallParticipant`, `StatusPill`.
- Contrast tooling: `contrastRatio` / `WCAG_AA` with tests enforcing every token pairing; role tokens `--bl-color-link` / `--bl-color-focus` (`#3B69BD`) and Ink Faint tuned to `#86819C` (D-017).
- `/design` gallery behind the `design_gallery` flag (local/preview), `?section=` deep links; Phase 1 screens moved onto the primitives.
- 75 unit tests across the design system, shared, worker and web.

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
