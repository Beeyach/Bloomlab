# CLAUDE.md — Bloomlab Operating Principles

This file governs every Claude Code session in this repository. It implements spec §0, §103, §125–§131, §163–§166.

## Source of truth

1. `BLOOMLAB_MASTER_SPEC.md` — authoritative. Where any other document disagrees with it, the master spec wins.
2. `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md` — architecture rationale (input reference, preserved verbatim).
3. Root working specs derived from the above: `PRODUCT_VISION.md`, `CURRICULUM_MASTER_MAP.md`, `DESIGN_SYSTEM.md`, `TECH_ARCHITECTURE.md`, `CONTENT_ARCHITECTURE.md`, `SIMULATOR_SPEC.md`, `EXERCISE_ENGINE.md`.
4. Project control: `REQUIREMENTS_MATRIX.md`, `ACCEPTANCE_TESTS.md`, `IMPLEMENTATION_STATUS.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md`, `docs/DECISIONS.md`.

## Mission

Build Bloomlab according to the authoritative specs: a premium, interactive, mastery-based learning simulator that makes one learner (Ary) independently capable of diagnosing, architecting, building, troubleshooting, explaining, pricing, pitching, negotiating and delivering real funnel and GoHighLevel systems. Not a course website. Not an LMS. Not a dashboard with placeholder cards.

## Requirements

Requirements are authoritative. Difficulty is not permission to weaken them. Every requirement has a stable ID in `REQUIREMENTS_MATRIX.md`; never reuse or silently downgrade an ID, priority, or scope. If a requirement cannot currently be completed, mark it `PARTIAL` or `BLOCKED` and explain why.

## Interaction

Never replace requested interactive behavior with a static approximation unless the spec explicitly allows it. Interactive workflow simulation is not a diagram. Negotiation practice is not an article. Funnel Autopsy is not a quiz. The interaction itself is part of the requirement (§130).

## No stubs

A requirement is not implemented if the feature logs to console, shows fake hardcoded success, is a static placeholder, says "coming soon", only works for a canned screenshot, or opens a nonfunctional modal. Leave it `PARTIAL` (§129).

## GHL accuracy

Do not invent native GHL features. Every simulated or taught feature maps to a record in `content/ghl-features/` with fidelity A / B / C / REAL_GHL. Verify trigger, action and product names against current official GHL documentation before adding them. Label approximations. Use exact real GHL terminology in UI for real features.

## Design

Follow `DESIGN_SYSTEM.md` (the Bloomlab Design Bible). The interface is quiet; the objects are magical. Reject generic SaaS/LMS patterns and every item on the §70 no-slop list. Use semantic components sharing tokens, never one universal Card. The visual language exists from Phase 2 onward — never build with temporary generic UI "to style later".

## Responsive

Mobile and tablet are product surfaces, not afterthoughts. Required review widths: 1440, 1024, 768, 390, 320. Recompose on mobile; never remove core functionality (§131).

## Testing

Critical logic requires tests: simulator transitions, grading, mastery, session builder, sync, pricing math. Every bug fix adds a regression test. Simulator behaviors get fixture IDs in the regression suite. CI must pass before merge or deploy.

## Content

Do not hardcode normal curriculum content in React. Curriculum lives in `content/` as YAML + Markdown/MDX, validated by schemas, compiled at build time.

## AI

Do not use AI where code can decide reliably. Order of preference: code → deterministic rules → authored branches → lightweight classifier → full LLM judgment. AI never overrides a deterministic failure. Claude is only called through the Worker.

## Safety

Never expose secrets to the browser bundle, commits, Vite client variables, curriculum files, or D1. Never store the raw sync secret server-side. Never publish learner screenshots or recordings.

## Preservation

Do not rewrite unrelated working features while implementing a scoped task. Preserve existing user data, contracts and behavior outside the task's scope.

## Operating rule (§0)

Before changing code:

1. Read `BLOOMLAB_MASTER_SPEC.md`.
2. Read this file.
3. Read the relevant product specification files.
4. Read the active requirement IDs in `REQUIREMENTS_MATRIX.md` / `IMPLEMENTATION_STATUS.md`.
5. Inspect the existing implementation.
6. Inspect related tests.
7. Preserve working functionality.

After changing code:

1. Run type checking.
2. Run relevant unit tests.
3. Run simulator regression tests.
4. Run content validation.
5. Build the app.
6. Inspect affected responsive widths.
7. Compare against `ACCEPTANCE_TESTS.md`.
8. Update requirement statuses in `REQUIREMENTS_MATRIX.md`.
9. Update `IMPLEMENTATION_STATUS.md`.
10. Report anything incomplete plainly.

Until application code exists, the mandatory check is `node scripts/validate-requirements.mjs`.

## Definition of done (§128)

A major feature is complete only when required behavior passes: behavior, edge cases, error state, loading state, persistence, responsiveness, accessibility, touch, keyboard, tests, design review, requirement update. A page existing is not completion. Do not call a phase complete until its required acceptance criteria pass.

## Statuses and priorities (§126, §127)

Status: `NOT_STARTED` · `IN_PROGRESS` · `IMPLEMENTED_UNVERIFIED` · `PASSED` · `PARTIAL` · `BLOCKED` · `DEFERRED` · `FAILED`. Never mark `PASSED` without evidence.

Priority: `P0` Blocking · `P1` Required · `P2` Important · `P3` Enhancement.

## Phases (§163)

Work proceeds through the numbered phases in `IMPLEMENTATION_STATUS.md`. Do not attempt to generate the entire product in one pass. Do not jump ahead into building random screens. Within the active phase, continue while requirements are clear.

## Git (§103)

- `main` plus short-lived feature branches (`feat/workflow-lab`, `fix/mobile-call-room`).
- Focused commits in conventional format: `feat:`, `fix:`, `content:`, `design:`, `docs:`, `test:`, `chore:`, `refactor:`, `perf:`, `ci:`. Reference requirement IDs where relevant, e.g. `feat(WFL-008): add appointment-relative wait execution`.
- Never `updates`, `stuff`, `final fixes`.
- Line endings are LF (enforced by `.gitattributes`).

## Reporting

Always state: passed, partial, blocked, failed, tests run, known limitations. Report incomplete work plainly. Never claim something works because the code looks right.

## Clarification (§164, §166)

Do not repeatedly ask for details already supplied by the specification. Make reasonable implementation decisions where the spec leaves a noncritical choice open and record them in `docs/DECISIONS.md`. Do not stop after every small feature asking "Should I continue?". Stop only for: a genuinely destructive operation needing user choice, a missing secret/credential that blocks execution, a requirement conflict that cannot be resolved reasonably, or external service setup requiring the user.
