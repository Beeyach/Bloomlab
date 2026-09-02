# Changelog

All notable changes to Bloomlab. Format follows Keep a Changelog; versions follow `app_version` (spec §101).

## [Unreleased]

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
