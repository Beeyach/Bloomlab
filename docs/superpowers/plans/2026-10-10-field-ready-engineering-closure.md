# Field-Ready engineering acceptance closure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Resolve the bounded sync timing failure and replace the 216 family-only screen/state/input references with justified exact evidence.

**Architecture:** Preserve the existing sync engine, native browser probes and router-derived screen inventory. Diagnose with a localhost-only synthetic API and real built UI, changing production code only for a demonstrated defect. Exact-cell evidence must contain screen identity, state, native input where applicable, assertions and artifacts; source reasoning alone cannot become a browser PASS.

**Tech Stack:** Node 22.23.3, npm 10.9.9, TypeScript, Vitest, Chromium/CDP, React/Vite, Dexie.

**Spec:** `ACCEPTANCE_TESTS.md`, `REQUIREMENTS_MATRIX.md`, `docs/reviews/field-ready-v1-independent-audit.md`.

## Global constraints

- Preserve all nine stacked PR bases; no merge, Production deployment or repository visibility change.
- No provider credits, real GHL or human-acceptance substitutions; use isolated synthetic browser data.
- No assertion/deadline weakening, preparatory waits that conceal latency, new dependencies or migration/seed changes.
- Keep original and unrelated worktrees intact. Baseline published source: `6b0226eb35d83b96f442b26c97495385b43de33c`.
- No requirement promotion without its complete acceptance evidence. Human visual and real-device/provider rows remain parked.
- Prepare and verify a reviewable result before requesting any additional push authorization.

## Review focus

- A manual request during an earlier pull must include newer local work and preserve its completion callback.
- A delayed request must not be confused with a lost callback or a database/lock deadlock.
- Reload during push must retain pending writes and preserve newer local edits.
- Controlled reports must exclude keys, tokens, payloads, headers, private URLs and raw body text.
- State-cell attribution must match the exact screen, head and input; empty/error/N/A decisions require actual lifecycle evidence.

## Task 1: Bound sync timing causality

**Files:** inspect `apps/web/src/data/sync/engine.ts`, `scheduler.ts`, `api.ts`, `apps/web/src/screens/LocalDataDiagnostics.tsx`, `scripts/review/probe-lib.mjs`; create local scratch experiment and output report. Confirmed fixes, if any, belong with focused regressions in the owning module.

- [x] Trace startup scheduling, manual request, lock, push, pull and completion paths.
- [x] Run real built UI against controlled local responses with baseline, delayed background pull and delayed push cases. Record safe timings, queue/lock counts and completion; preserve the existing manual gate.
- [x] Compare delayed completion with permanent callback loss, queue abandonment and cross-document interruption.
- [x] Implement only a confirmed cause, with a failing regression before implementation; otherwise record the precise environmental/protocol limit without claiming the historical CI root cause.
- [x] Run targeted sync/learning/queue checks, appropriate static checks and native UI verification for any change.

## Task 2: Exact screen/state/input evidence

**Files:** `scripts/review/screen-matrix.mjs`, `screen-state-matrix.mjs`, existing family probes and narrowly scoped exact-state probes/tests; authoritative control docs only when supported.

- [x] Inventory all 216 cells with exact screen/state IDs and existing assertion sources.
- [x] Reuse existing assertions where they prove the exact cell; cite their identity and artifact rather than a family label.
- [x] Add controlled state fixtures and native keyboard/touch checks where evidence is missing; document justified N/A with source and lifecycle rationale.
- [x] Reject missing, wrong-head, wrong-screen and failed assertions in the evidence joiner with meaningful tests.
- [x] Run the complete local evidence suite and update counts honestly; retain all 43 human visual rows and twelve human/GHL rows.

## Task 3: Independent review and publication handoff

- [x] Complete independent material/security/evidence review, frozen Node22 verification and privacy scans.
- [x] Save the finished report, exact source/diff and remaining blockers in outputs.
- [ ] Request approval only for a concrete additional push/Preview CI result; preserve the current verified remote source until approved.

## User-directed visual fix round

The subsequent pasted ten-item specification adds presentation corrections while preserving the existing holo, colors, type and overall layout. The user clarified item 1: retain 56px rows and make all fifteen learner destinations scrollable. Preview also exposes two developer destinations; those remain reachable.

- [x] Implement rail, territory fill/scrim/singular wording, Calendar, measured Workflow layout/date-time/help, shared tables, scenario selection, outlined actions, links and metadata corrections.
- [x] Independently review the whole source delta, including subsequent browser-confirmed fixes.
- [x] Verify the frozen combined source: full Node22 checks, both requested windows at genuine 90%/125% browser zoom, five-width polish, accessibility and exact-state probes.
- [x] Publish the numbered done/not-done report with exact source and verification limits.

Rulings: render authored title facts through `ContentTitle` without changing content, saved identities or seeds. Preserve manual graph coordinates and existing offsets in repeated daylight-saving hours. The explicit 11.5px/600 Home campaign eyebrow supersedes the older generic small-uppercase prohibition only for that named continuation-context element; the gate verifies its exact size, weight and dark color and retains the prohibition elsewhere. Touch help controls retain the existing 44px minimum on phones.
