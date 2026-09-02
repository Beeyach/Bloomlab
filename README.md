# Bloomlab

A premium, interactive, mastery-based web application that trains one learner to become highly competent at funnel strategy, GoHighLevel implementation, conversion thinking, marketing, prospecting, sales, pricing, negotiation, client delivery, and advanced technical GHL work.

## Status

Phase 1 (repository foundation) complete. No learning content or simulator yet. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Develop

Requires Node ≥ 22.22 and npm 10.

```bash
npm install
```

```bash
npm run dev
```

Runs the Vite dev server with the Cloudflare Worker (via the Cloudflare Vite plugin) at http://localhost:5173. `/system` shows versions, environment and Worker health in local and preview environments.

Full verification, as run in CI:

```bash
npm run ci
```

Individual steps: `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm test` · `npm run validate:docs` · `npm run build`.

## Layout

`apps/web` React app · `worker` Cloudflare Worker · `packages/*` shared, design-system, simulator-core, exercise-engine, mastery-engine, content-schema · `content/` curriculum · `migrations/` D1 · `tests/` cross-package suites · `public/` static assets. See [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md).

## Source of truth

- [BLOOMLAB_MASTER_SPEC.md](BLOOMLAB_MASTER_SPEC.md) — authoritative build specification
- [CLAUDE.md](CLAUDE.md) — operating principles for every coding session
- [docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md](docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md) — architecture reference

## Working specs

[PRODUCT_VISION.md](PRODUCT_VISION.md) · [CURRICULUM_MASTER_MAP.md](CURRICULUM_MASTER_MAP.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) · [CONTENT_ARCHITECTURE.md](CONTENT_ARCHITECTURE.md) · [SIMULATOR_SPEC.md](SIMULATOR_SPEC.md) · [EXERCISE_ENGINE.md](EXERCISE_ENGINE.md)

## Project control

[REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md) · [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) · [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) · [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) · [CHANGELOG.md](CHANGELOG.md) · [docs/DECISIONS.md](docs/DECISIONS.md)
