# Phase 23 — Portfolio review

This implementation is stacked on Phase 22 `fa53d72ecdd9cdb276338d4abd2c1d699ab37ff5`. Its draft PR targets `codex/phase-22-fieldwork`. PR #24 remains open and unmerged. Independent audit is required; no Phase 22 human acceptance is substituted by these checks. The immutable head, CI run and deployed Worker identity are recorded in the draft PR after verification.

## Implemented behavior

`/portfolio` is a real shell destination. Completing an exercise with saved evidence makes an item eligible when the exercise explicitly references the authored template or belongs to its project's authored stages. Retrieval work, deleted attempts, orphan attempts and foreign-learner evidence do not create items. A failed or partial submitted attempt can contribute genuine written work while passing skills and real-GHL proof remain missing.

Dexie v7 adds `portfolio_projects` and `portfolio_assets`; the existing D1 domains store their JSON metadata through the existing authenticated sync protocol. Every project persists all ten enum-defined artifact slots. Brief/business problem reference the authored project; the remaining slots reference an append-only set of saved-attempt contributions. Neither static YAML nor media bytes are copied into D1. The view resolves only existing, owned source rows. Stable IDs make collection idempotent, explicit tombstones are preserved, and simultaneous reflection edits use the existing conflict chooser. Migration preserves earlier stores and resets the pull cursor to retrieve portfolio changes previously skipped by an older client.

New completed attempts capture a bounded allowlist of the exact architecture supplied to grading, including workflow trigger/step definitions and funnel step/block connections. Rubric retry keeps the capture with its submitted checkpoint. Mutable account configuration, webhook headers and execution state are not included. Structures outside the bounded capture contract are omitted without blocking submission, and the archive reports no preserved build. Earlier attempts without a capture are shown as missing rather than reconstructed from today's simulator. These are submitted structures, not full editable workflows or execution traces.

The two current templates each specify ten categories. The consultation funnel exercise now references its existing consultation template. No additional project or progression is manufactured. List and detail display the authored `Simulation Project` or `Demonstration Build` label. There is no outcome-claim field. Details use editorial brief/problem text, structure lists, private screenshot controls, saved reasoning and learner reflections, skill/assistance evidence and a separate manual real-GHL statement.

Portfolio never displays a local image Blob as proof of current remote availability. Opening a referenced screenshot uses Phase 22's authenticated, redirect-refusing, no-store metadata and image endpoints; attempt/exercise/item association is checked. Deleted local assets remain visibly deleted. Missing, revoked or unreachable images show a recoverable unavailable state. Previously delivered bytes cannot be recalled; an open image is checked again on explicit retry, not by a realtime deletion subscription. Historical manual proof is explicitly separate from current image availability.

## Export contract

`Export Bloomlab Data` is available at `/sync`, with AI Off and without any export service. The local JSON has `format: bloomlab-data`, `schema_version: 1`, export time, app/content/hash/simulator/rules versions, and exactly six data groups:

| Group | Canonical local records |
|---|---|
| `progress` | `skill_progress`, `campaign_progress`, `review_queue` |
| `evidence` | `skill_evidence`, finalized `exercise_attempts`, safe `private_assets` references from `evidence_assets` belonging to those attempts |
| `projects` | `sim_projects` |
| `notes` | `notes` |
| `simulator_saves` | `sim_events`, `sim_snapshots` |
| `portfolio_metadata` | `portfolio_projects`, `portfolio_assets` |

Rows are owner-filtered, sorted by stable ID and read in one consistent transaction. Sync envelopes and tombstones are preserved. Explicit per-table columns and recursive sanitization remove known credential/header/token/provider fields, private URL forms, object keys and binary values. Device/workspace/session/sync-queue stores, raw call recordings, image Blobs and unrelated provider caches are excluded. User-authored prose remains private learner data; users are told to keep the file private. This is a local snapshot: sync first to obtain another device's newer work. Unfinished workspace drafts are not finalized evidence. Media bytes, provider history and restore are outside this contract; DATA-009 remains NOT_STARTED.

## Reproduction and evidence

Use the pinned Node 22 from `.nvmrc`:

```sh
npm run ci
BASE=http://127.0.0.1:5174 npm run review:portfolio
BASE=https://bloomlab-preview.cool-sunset-2169.workers.dev REVIEW_HEAD=<full-head> npm run review:portfolio
BASE=https://bloomlab-preview.cool-sunset-2169.workers.dev REVIEW_HEAD=<full-head> node scripts/review/portfolio-sync-probe.mjs
```

Set `CHROME` and `CHROME_FLAGS` for the host browser as with existing review scripts. Reports and screenshots are written to ignored `.review/phase-23-portfolio/`; no session keys are printed or committed. The browser probe holds automatic sync and seeds explicitly controlled completed evidence in real IndexedDB. The product's collection, reads, reflection writes, outbox, routes and actual local JSON downloads are exercised. This fixture is not real-GHL work. The separate live sync probe uses disposable linked identities, verifies deployed D1 metadata roundtrip and isolation, tests conflict/rejection, then tombstones its controlled project.

Focused tests cover ten-category persistence and schema enforcement, missing/orphan/foreign/tombstoned sources, evidence-derived facts, both truth labels/content boundaries, migration/reopen, two-device sync and reflection conflicts, submitted runtime capture, recoverable reads, validated exports, local download failure/retry, private media and credential canaries. Worker tests cover owner-scoped D1 pull, anonymous refusal and strict metadata rejection. Existing Phase 22 private asset tests remain in the full suite.

Five real browser-saved JSON files are validated using Chromium’s GUID download naming to prevent same-name collisions. The browser matrix is exactly 1440 / 1024 / 768 / 390 / 320. It captures empty/populated/detail/missing-artifact/manual-GHL/deleted/unavailable-image and export success/error states, tests visible keyboard focus and touch activation, reduces motion, checks horizontal overflow, validates saved reflections after reload, checks downloaded six-group JSON and asserts app-origin-only egress. On built Preview it also saves a reflection, reloads and exports with the browser network offline. These are Chromium viewport/touch emulations, not physical Safari acceptance.

## Review boundary

PORT-001, PORT-002 and DATA-008 are the only requirement promotions in this slice. Direct local persistence/UI/export checks pass; full checks and deployed exact-head evidence are attached to the draft PR before the audit stop. PORT-003 remains Phase 24. FLD-001 and EXR-020 remain IMPLEMENTED_UNVERIFIED; FLD-002/004 and deferred FLD-003 are unchanged. Seven Phase 21 human-unverified rows and all unrelated cross-cutting statuses remain unchanged. No GHL API verification, public sharing, restore, production deployment or merge is part of this work.
