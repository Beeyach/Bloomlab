# Phase 26 - Polish, recovery, accessibility, adversarial closeout

## Branch and stacking

Work only on `codex/phase-26-polish`.

This branch starts from independently audited Phase 25 head:

`ad54be84999c263f5ebe5a293528a85614bd20d6`

Open the Phase 26 PR as a **draft against `codex/phase-25-advanced-curriculum`**, never against `main` while PR #24/#25/#26/#27 remain parked.

Do not merge any stacked PR. Do not retarget earlier PRs. Do not promote human-acceptance rows just because automated checks pass.

Read before implementation:

- `BLOOMLAB_MASTER_SPEC.md`
- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGELOG.md`
- `docs/handoffs/phase-25-advanced-curriculum.md`
- `docs/reviews/phase-25-advanced-curriculum.md`

## Goal

Phase 26 is the product closeout and hardening phase. It is not permission to rewrite working Labs or blur unresolved human evidence. Preserve the deterministic learning/simulator architecture, local-first persistence, private learner data boundaries, and truthful GHL fidelity model.

Primary Phase 26 requirements currently assigned by the matrix:

- `PRD-015` - heavily polish the six signature moments: Holo Skill Interaction, First Workflow Execution, Client Case Reveal, Failed Test reveal, Independent Pass recognition, Field Ready restrained cinematic.
- `PRD-016` - optional subtle sound for snap/connect/execution/selection/completion, always mutable/muteable, never constant.
- `HOL-005` - Holo Skill Interaction signature moment polished for pointer/touch.
- `A11Y-010` - automated accessibility checks in CI plus manual review record for keyboard, focus flow, touch, reduced motion, holographic contrast, drag alternatives.
- `DATA-009` - Restore Backup validates version/schema, requires explicit confirmation, never silently overwrites.
- `INF-016` - adversarial audit cases have recorded test results.
- `INF-017` - client-side global search over skills, GHL features, lessons, glossary, clients and past exercises. No external search service.
- `GHL-008` - registry freshness maintenance generates a review list for stale feature verification.

Also examine overdue or cross-cutting rows that Phase 26 directly touches, including `PORT-003`, `CNT-010`, `A11Y-001`, `DES-017`, `DES-018`, `RSP-001..004`, `PERF-001`, `INF-015`, `GHL-005`, `GHL-009`, `GHL-010`, `SEC-002`, `SEC-003`, `PRD-001`, `PRD-004`, `PRD-009`, and `EXR-024`. Do **not** promote any of them merely because this phase exists. Close only those with direct requirement-level evidence. `INF-015` specifically requires an independent audit, so implementation may prepare evidence and an audit surface, but the implementation agent must not self-certify it PASSED.

Human-acceptance statuses remain parked unless Ary personally completes the required work. In particular preserve `FLD-001`, `EXR-020`, `PRD-005`, `CUR-015`, `CUR-031`, and the Phase 21 human-unverified rows. Preserve `PRI-001`, `PRI-002`, and `NEG-003` unless this phase produces new direct evidence for their full stated requirement.

## Checkpoint A - baseline and requirement ledger

Before coding, produce a Phase 26 baseline in `docs/reviews/phase-26-polish.md`.

Inventory every Phase 26 assigned row and every cross-cutting P0/P1 row still `NOT_STARTED`, `PARTIAL`, `IN_PROGRESS`, `IMPLEMENTED_UNVERIFIED`, `BLOCKED`, or `FAILED`.

Classify each as one of:

- implement now
- verify now
- independent-audit only
- human acceptance required
- intentionally deferred/out of v1

Do not use this classification to silently change statuses. It is a work plan.

Run focused baseline checks and record current counts/versions before modifications.

## Checkpoint B - DATA-009 safe restore

Implement Restore Backup against the Phase 23 versioned export format.

Required behavior:

- parse and validate the file before any write
- validate format and schema version
- reject malformed/unsupported backups without changing local data
- show a clear summary of what will be restored
- require explicit confirmation before writes
- never silently overwrite existing local data
- define and test conflict behavior for existing records
- preserve learner ownership boundaries
- never import secrets, session tokens, raw media bytes, provider credentials, unsafe prototype keys, or fields excluded by export
- make interruption/failure recoverable and truthful
- no network dependency for local restore
- no restore action should silently create false synced/server state

Prefer a staged/transactional restore design over row-by-row destructive mutation. If exact atomic replacement is not possible across all Dexie tables, design an explicit safe merge/staging flow and document the limitation.

Add direct tests for unsupported version, malformed schema, duplicate/existing data, confirmation cancellation, partial failure, malicious keys, foreign learner rows, and successful reopen after restore.

## Checkpoint C - INF-017 global search and glossary integration

Implement one client-side search surface over the compiled/local data model, not a remote service.

Search must cover:

- skills
- GHL features
- Academy lessons
- glossary
- clients
- past exercises/attempts

Requirements:

- keyboard operable
- useful ranking/grouping and empty state
- result type and destination are clear
- no fake results
- past exercises come from actual learner history
- works offline for locally available data
- responsive at 1440/1024/768/390/320
- no invasive indexing service or new backend

If `CNT-010` is still missing because glossary search/content is incomplete, implement the smallest correct glossary integration required to make this real. Do not manufacture a huge glossary just to flip the row. Promote `CNT-010` only if its full requirement is actually met.

## Checkpoint D - GHL-008 freshness maintenance

Implement a deterministic maintenance script/report for `content/ghl-features/`.

It must:

- flag records older than the defined freshness threshold
- distinguish `current`, `needs_review`, `deprecated`, `removed`
- produce a stable review list suitable for maintenance
- never automatically mark a feature current from a stale source
- never scrape or call providers during normal app runtime
- preserve source URL, verification date and limitation metadata
- fail or warn in the appropriate build/maintenance path according to the repository's established content rules

Add regressions for stale current features, recently verified features, deprecated/removed records and malformed dates.

Do not re-research every GHL feature unless necessary. This checkpoint builds the maintenance mechanism. Any feature whose current status is objectively contradicted by known evidence should be corrected with source evidence and narrowly documented.

## Checkpoint E - accessibility closeout

Implement `A11Y-010` as a real CI gate plus a committed manual-review record.

Automated accessibility checks should cover major learner-facing routes, not one token demo page. Use an established browser accessibility engine if appropriate and keep the configuration transparent.

The manual/controlled review record must cover all six required areas:

1. keyboard
2. focus flow
3. touch
4. reduced motion
5. holographic contrast
6. drag alternatives

Also explicitly audit the independently scrolling rail at short viewport height.

Where automated or controlled evidence proves existing accessibility partials such as `A11Y-001`, update them only if the whole requirement is now supported. Do not treat Chromium emulation as physical-device proof.

CI should fail on newly introduced serious accessibility violations. Avoid brittle snapshot-only assertions.

## Checkpoint F - signature moments and optional sound

Polish, do not redesign, the six moments named by `PRD-015`.

Each moment must remain restrained and meaningful:

- Holo Skill Interaction
- First Workflow Execution
- Client Case Reveal
- Failed Test reveal
- Independent Pass recognition
- Field Ready achievement

Rules:

- no confetti/trophy spam/neon/generic game celebration
- major accomplishment motion approximately follows the existing 1.5-3s/skippable rule
- reduced motion must provide an equivalent non-motion state
- Holo remains the existing reusable material, not a second effect system
- interactions must remain keyboard/touch accessible
- do not obscure results or delay the learner unnecessarily

For `HOL-005`, verify pointer/touch physical response, settle behavior, focus usability and reduced-motion behavior on the real reusable Holo material.

For `PRD-016`, add only subtle optional cues if they improve the named interactions. Sound must default to a responsible product behavior, expose an easy mute/disable control, persist preference locally, never autoplay constant ambience, and never block or alter learning logic if audio fails. Do not spend provider credits or add generated voice/audio dependencies.

## Checkpoint G - INF-016 adversarial audit

Create a reproducible adversarial harness and a recorded result for every authoritative adversarial case in `ACCEPTANCE_TESTS.md` / spec §142.

The current list covers:

- offline mid-exercise
- refresh mid-simulation
- duplicate events
- missing phone/email boundary
- cancelled appointment during wait
- timezone change
- AI timeout
- AI budget exhausted
- ElevenLabs failure
- transcription failure
- sync conflict
- second device
- extreme values
- malformed scenario data

Respect the authoritative count and wording in the repo. If the prose list and count are inconsistent, document the discrepancy instead of silently redefining the requirement.

Each case needs:

- setup
- expected safe behavior
- observed result
- PASS/FAIL
- regression identifier/test or browser probe reference
- any limitation

Fix genuine product bugs discovered by the adversarial run and add a regression for each fix. Do not rewrite tests to bless unsafe behavior.

External-provider failures should be simulated/controlled unless a real paid/provider call is specifically necessary. No provider spend is authorized for this phase by default.

## Checkpoint H - final responsive/design/performance sweep

Run the full screen coverage matrix at 1440/1024/768/390/320 plus short-height cases where relevant.

Audit:

- no critical feature disappears on mobile
- no page-level horizontal overflow
- tablet remains first-class
- keyboard focus remains visible
- touch targets and input sizing hold
- independently scrolling rail remains usable
- no new AI-slop patterns, eyebrows or user-facing monospace
- heavy simulators remain route-lazy and Academy reading does not eagerly load Workflow Lab
- no constant off-screen holo animation
- no fake analytics, fake success, static replacement or nonfunctional modal

Inspect `DES-017`, `DES-018`, `RSP-001..004`, `PERF-001`, `DES-006`, `DES-008..012`, and `EXR-024` against full current product evidence. Promote only where the full requirement is actually closed.

## Checkpoint I - final system readiness evidence, no self-merge

Run complete pinned Node 22 CI and all relevant focused suites.

Required final verification:

- exact-head GitHub CI green
- Preview deploy green, Production skipped
- browser and Worker build IDs match exact source head
- content validation green
- simulator regressions green
- sync regressions green
- AI Off core path green
- AI failure/fallback checks green
- accessibility CI green
- responsive matrix green
- GHL freshness report generated
- restore tests green
- global search tests/probe green
- adversarial record complete
- signature moments/reduced-motion checks green
- browser/provider secret scans green

Update:

- `REQUIREMENTS_MATRIX.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGELOG.md`
- `ACCEPTANCE_TESTS.md` only where evidence belongs there
- `docs/reviews/phase-26-polish.md`

Do not claim the Field-Ready Complete gate if unresolved P0/P1 rows or required human acceptance still prevent it. Explicitly list what remains after automated Phase 26 closeout.

Do not mark `INF-015` PASSED yourself. Stop for an independent no-coding audit after final exact-head verification. The independent auditor will produce or update `AUDIT_REPORT.md` and decide which remaining cross-cutting statuses are actually supported.

## PR and stop condition

Open one draft Phase 26 PR against `codex/phase-25-advanced-curriculum`.

Keep PR #24/#25/#26/#27 and the Phase 26 PR draft/unmerged.

At the end report:

- final head SHA
- exact-head CI run ID and job conclusions
- test count/files
- Preview Worker version and build identity
- requirements promoted, unchanged and still blocked on human acceptance
- adversarial result summary
- accessibility result summary
- restore/search/freshness verification
- provider spend
- migrations, if any
- known limitations

Then stop for independent audit. Do not merge.