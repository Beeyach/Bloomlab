# Phase 23 — Portfolio

## Operating state

This is a stacked implementation phase.

- Repository: `Beeyach/Bloomlab`
- Branch: `codex/phase-23-portfolio`
- This branch starts from Phase 22 head `fa53d72ecdd9cdb276338d4abd2c1d699ab37ff5`.
- Phase 22 PR #24 remains draft/open because its real-GHL human acceptance is intentionally deferred. Do not alter that fact or promote `FLD-001` / `EXR-020` without the human run.
- Open Phase 23 as a draft PR **against `codex/phase-22-fieldwork`**, not `main`, while PR #24 is unmerged. This keeps the Phase 23 diff focused. After PR #24 eventually merges, rebase/retarget Phase 23 to `main` and re-run exact-head CI before independent merge review.
- Do not self-merge.

Read completely before coding:

1. `CLAUDE.md`
2. `BLOOMLAB_MASTER_SPEC.md`, especially §35, §36, §150 and the product-control sections
3. `REQUIREMENTS_MATRIX.md`
4. `ACCEPTANCE_TESTS.md`
5. `IMPLEMENTATION_STATUS.md`
6. `KNOWN_LIMITATIONS.md`
7. `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md`, especially portfolio/data domains and backup/export
8. Phase 22 Fieldwork implementation and evidence model, because portfolio may reference real-GHL proof but must not weaken its privacy boundary
9. Existing content schemas, sync architecture, IndexedDB/D1/R2 patterns, app shell/navigation and responsive review tooling

## Phase 23 requirements in scope

### PORT-001 — portfolio item stores all ten artifacts

A portfolio item must store:

1. brief
2. business problem
3. architecture
4. funnel
5. workflows
6. screenshots
7. learner reasoning
8. skills demonstrated
9. assistance level
10. real-GHL evidence where applicable

The content schema already defines these ten `PORTFOLIO_ARTIFACT_KINDS`. Use that contract rather than inventing a second one.

### PORT-002 — truthful fictional-work labeling

Every fictional/simulated portfolio item must visibly use one of the authored labels:

- `Simulation Project`
- `Demonstration Build`

There must be no client outcome/results claim field and no UI wording that implies fictional work produced real business outcomes.

Do not add fake ROI, fake revenue, fake conversion lift, testimonial language, or invented client results.

### DATA-008 — Export Bloomlab Data

Implement a versioned backup/export containing exactly these data groups:

- progress
- evidence
- projects
- notes
- simulator saves
- portfolio metadata

This phase is **export only**. `DATA-009` Restore Backup remains Phase 26 and must not be quietly implemented here.

The export must not include secrets, session tokens, raw call audio, private screenshot/image bytes, provider credentials or other binary media. Portfolio/fieldwork media should be represented by safe metadata/references only where appropriate.

### Cross-cutting work touched by the phase

Maintain existing design, responsive, accessibility, offline/local-first, sync, privacy, build/version and no-stub rules. Do not mark cross-cutting requirements PASSED unless this phase supplies the missing evidence for their full scope.

`PORT-003` portfolio progression counts (Field Ready 1–5, Practitioner 6–10, Advanced 11–15, Specialist 16–20) is Phase 24. The content schema's `progression_number` remains valid, but do not claim PORT-003 complete in Phase 23.

## Product goal

Build the first real learner-facing Portfolio environment, not a gallery mockup.

The learner should be able to open Portfolio and see real portfolio items derived from Bloomlab work/evidence, inspect what is available versus still missing, and preserve the artifacts that legitimately exist. The environment should feel like a premium project archive rather than a generic SaaS card grid.

The phase should work with AI completely Off.

## Architecture rules

### One canonical learner-data path

Do not create a parallel portfolio truth inside React state or localStorage.

Use the existing local-first architecture:

- Dexie / IndexedDB for immediate learner state
- existing sync/outbox patterns for synced metadata
- D1 for learner-specific synced metadata
- private R2 only for binary media if this phase genuinely needs new uploaded media

Prefer references to existing exercise/fieldwork evidence where possible instead of copying blobs or duplicating screenshots.

If a portfolio item references a Phase 22 fieldwork screenshot, keep the screenshot private and owner-authorized. Do not make portfolio presentation a public asset route.

### Data model

The technical architecture already reserves conceptual `portfolio_projects` and `portfolio_assets` domains. Implement the smallest durable model that satisfies PORT-001/002 and has a clear Phase 24 path without forcing a rewrite.

Portfolio records should be versioned/syncable metadata, with stable IDs, learner ownership, created/updated timestamps/revisions/deletion semantics consistent with the existing sync model.

Do not store large binary blobs or giant serialized app state in D1.

### Derived versus authored data

Use authored portfolio templates from `content/portfolio/*.yaml` as the project/template contract. Learner portfolio records are learner state.

`Git = what Bloomlab teaches/templates`
`D1/IndexedDB = what the learner has actually assembled/completed`

Do not mirror static portfolio YAML wholesale into D1.

## Portfolio item behavior

### Creation / eligibility

Inspect existing exercise `portfolio:` references and project/portfolio content. Choose a deterministic rule for when a learner portfolio record becomes available, based on actual completed work/evidence, not arbitrary unlock buttons.

A portfolio item must never claim an artifact exists when the underlying evidence does not exist.

Examples:

- if there is no funnel artifact for a project yet, show it as missing/not supplied rather than fabricating one
- if no real-GHL evidence exists, state that clearly
- if a fieldwork screenshot was deleted, preserve truthful historical metadata but do not pretend the image remains available

Avoid a generic manual text form that lets the learner invent all ten artifacts from scratch just to satisfy the schema. The portfolio should primarily collect/assemble defensible evidence from Bloomlab work and allow learner-authored explanation/reasoning where the contract calls for it.

### Artifact presentation

The item detail should make the ten artifact categories legible without turning everything into ten identical cards.

Use hierarchy appropriate to the content:

- strong title + authored truth label
- business problem / brief as editorial text
- architecture/funnel/workflow representations from actual saved evidence where available
- screenshots/media as private evidence
- learner reasoning as learner-authored text
- skills demonstrated and assistance as evidence-derived facts
- real-GHL evidence as clearly distinguished from simulation

Do not expose internal learner IDs, sync IDs, provider IDs, object keys or raw JSON in normal product UI.

### Labels

The authored `PortfolioSchema.label` is the authoritative display label. It must be visible on list/detail views where the nature of the work could otherwise be misunderstood.

No wording such as "client result", "generated X leads", "increased conversion" or equivalent unless a future requirement introduces verified real-world outcomes. Phase 23 does not.

## Portfolio screen

Add Portfolio to the real application shell in the location already anticipated by the design/control docs.

Requirements:

- real route, not diagnostics-only
- empty state that explains how portfolio work appears
- populated state
- item detail
- loading/error/offline-safe states
- keyboard and touch operability
- deliberate desktop/tablet/mobile compositions at 1440 / 1024 / 768 / 390 / 320
- no page-level horizontal overflow
- no generic dashboard KPI strip
- no endless identical card layout
- no eyebrows/kickers/overlines
- no user-facing monospace
- status never conveyed by color alone
- touch targets approximately 44 px

Use existing visual primitives/tokens. Portfolio projects are an allowed place for restrained collectible/holographic material, but follow the core rule: interface quiet, objects magical. Do not turn the entire screen into animated holo.

## Data export — DATA-008

Add a learner-facing `Export Bloomlab Data` action in a sensible system/settings location.

The produced file must be:

- downloadable locally without an external export service
- explicitly versioned
- schema/version identified
- deterministic enough to validate in tests
- safe to create with AI/providers offline

It must contain the six required groups:

1. progress
2. evidence
3. projects
4. notes
5. simulator saves
6. portfolio metadata

Define/document exactly which existing tables/records map into each group.

Do not include:

- sync/session secrets or auth tokens
- Anthropic/ElevenLabs/Google credentials
- raw call recordings
- screenshot binary bytes
- R2 object internals that would expose storage implementation unnecessarily
- cached provider responses unrelated to the six required groups

A future restore process must be able to validate the export, but do not implement restore in this phase.

Add tests that fail if one of the six groups is missing or if sensitive fields leak into the export.

## Sync/offline expectations

Portfolio metadata should follow the same local-first expectation as other learner work:

- local write first
- reload-safe
- offline-safe where the action does not intrinsically require fetching a remote private asset
- sync metadata via existing queue/pull architecture
- no binary media in sync JSON

Do not make creating/viewing portfolio metadata dependent on AI or a live provider.

## Privacy/security

Portfolio must not weaken Phase 22's evidence privacy.

- Private learner screenshots remain private.
- Do not introduce public media URLs.
- Never publish fieldwork screenshots.
- Never include auth/session secrets in portfolio records or exports.
- Cross-learner access must remain impossible.
- If media is deleted, UI must be truthful about deletion/unavailability.

Run/extend browser-secret and provider-boundary checks as appropriate.

## Content

Use the existing portfolio templates under `content/portfolio/` and existing exercise `portfolio:` references.

Do not manufacture twenty projects in this phase just to fill the screen. Phase 24 owns broader Field Ready portfolio progression/content completion.

If the existing two templates expose schema/content gaps that prevent PORT-001, fix the content contract minimally and compatibly.

Do not alter Phase 22 Fieldwork acceptance status merely because Portfolio can reference fieldwork evidence.

## Acceptance tests

At minimum add direct tests for:

### PORT-001

- a persisted portfolio item carries all ten artifact categories in the canonical model
- required artifact categories cannot silently disappear
- missing source evidence remains visibly missing rather than fabricated
- skills/assistance/real-GHL fields are derived from real saved evidence where applicable
- reload and sync preserve the same portfolio metadata

### PORT-002

- every fictional item visibly displays exactly an allowed truth label
- schema/UI refuse or omit outcome/result claim fields
- source-level/content tests catch invented client-outcome fields or forbidden copy patterns where practical

### DATA-008

- export has an explicit format/schema version
- all six required top-level data groups exist
- expected learner records are included in their correct groups
- secret/session/provider fields are absent
- raw audio and image bytes are absent
- portfolio metadata is present
- export works locally/offline with providers unavailable

### UI / responsive

Review exactly:

- 1440
- 1024
- 768
- 390
- 320

Cover:

- empty portfolio
- populated portfolio
- item detail
- missing artifact state
- real-GHL indicator state
- deleted/unavailable private image state if relevant
- export success/error
- keyboard
- touch
- reduced motion
- offline/reload persistence

Do not call a desktop-only implementation complete.

## Verification workflow

Run the complete pinned Node 22 validation used by the repository:

- typecheck
- lint
- format check
- tests
- docs validation
- content check
- voice check
- build/browser-secret scan

Run focused portfolio/export tests and browser probes.

Create/update reproducible review scripts under `scripts/review/` rather than relying on screenshots alone.

Preview deployment must be inspectable at all five widths.

## Status handling

Expected successful Phase 23 outcomes:

- PORT-001 -> PASSED only with direct persistence + UI evidence for all ten fields
- PORT-002 -> PASSED only with truthful labeling and no outcome-claim model/UI
- DATA-008 -> PASSED only with validated versioned six-group export
- PORT-003 remains NOT_STARTED / Phase 24
- FLD-001 and EXR-020 remain IMPLEMENTED_UNVERIFIED until Ary later performs the real-GHL Phase 22 run
- FLD-002 and FLD-004 retain their Phase 22 supported status
- FLD-003 remains DEFERRED

Do not silently promote unrelated cross-cutting rows.

## PR / stacked-branch workflow

1. Implement on `codex/phase-23-portfolio`.
2. Open a draft PR with base `codex/phase-22-fieldwork` while PR #24 remains open.
3. Keep the PR focused to Phase 23 changes relative to Phase 22.
4. Do not merge PR #24 or Phase 23.
5. Stop for independent audit after exact-head CI + Preview are green.
6. When Phase 22 human acceptance is eventually completed and #24 is merged, Phase 23 will be rebased/retargeted to `main`, reverified, independently audited, then merged if objectively ready.

## Explicit non-goals

Do not implement in Phase 23:

- GHL API verification
- Phase 22 human acceptance substitution
- backup restore (DATA-009)
- public portfolio profiles or public sharing
- client outcome claims
- portfolio progression completion through all 20 projects (PORT-003)
- commercial multi-user/instructor features
- Phase 24 Field Ready capstone/content completion
- Phase 25 advanced curriculum

## Stop condition

Stop when:

- Phase 23 implementation is complete on the stacked branch
- focused and full checks pass
- Preview browser review passes at all five widths
- the draft stacked PR is open
- evidence/docs/statuses are updated honestly

Then report:

- exact head SHA
- PR number and base branch
- test count
- Preview verification result
- requirement status changes
- any known limitations

Do not self-merge.