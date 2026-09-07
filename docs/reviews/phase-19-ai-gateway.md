# Phase 19 — AI Gateway

Verified base: `154a00a73d659b92f0cc871f636462a9cb094f4b`, fetched from origin before edits. Branch: `codex/phase-19-ai-gateway`. PR #21 remains open for independent exact-head audit. Phase 18 closure correction is a separate first commit; its historical review report was not rewritten.

## Implementation

Browser → Worker authentication → canonical learner policy → budget reservation/routing → bounded normalized input → injectable Anthropic HTTP provider → structured validation → D1 execution/usage/feedback → response. No provider key or SDK enters the browser. Missing configuration affects only AI routes.

`0002_ai_gateway.sql` extends `learners`, `ai_usage`, `ai_feedback` and `rubric_runs`; no parallel database or speculative tables. Learner mode defaults to Limited and monthly limit to $20. Off blocks provider requests server-side and suppresses local evaluation requests after being selected. Limited permits assessment and language classification; Full permits optional work without inventing coaching buttons. Unlinked devices retain all non-AI functionality.

Model catalog `2026-09-07.1` was checked against [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) and the [Sonnet 5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5/migration-guide) on 2026-09-07:

| Class | Model | Input / output USD per MTok | 5m write / read |
|---|---|---|---|
| cheap | claude-haiku-4-5-20251001 | 1 / 5 | 1.25 / 0.10 |
| strong | claude-sonnet-5 | 2 / 10 | 2.50 / 0.20 |

The authored rubric model_class controls normal routing. At $12 the governor prefers cheap; at $16 ordinary nonessential tasks are refused; $19+ allows only essentials, subject to the hard limit. Custom limits scale those boundaries. Optional work is reduced by refusing it at the first pressure band. Atomic D1 reservations cover initial evaluation and one repair; remaining balance can cause a cheap downgrade or refusal. Input is bounded, output is capped at 2048 tokens, and the conservative reservation includes the whole model input-context ceiling at cache-write rates. This may refuse a small request despite some remaining displayed balance. Actual input/output/cache-write/cache-read usage is recorded separately. Uncertain outcomes retain a reservation; limits cannot be lowered below committed spend.

Anthropic receives `output_config.format` with `type: json_schema`, never an assistant prefill. The provider schema removes unsupported numeric/string/array constraints as [Anthropic documents](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations); local validation retains them and checks exact authored item identities and critical consistency. One malformed or invalid rubric response produces one repair request; a second invalid response fails evaluation. Stable philosophy and exact rubric context precede variable work; the whole bundle is not sent.

D-171–D-175 record the combination, submission, persistence, provider and classification decisions. `gradeExercise()` stays deterministic. Critical failures, established required gates and missing runtime assertions remain authoritative. The combination reapplies the objective threshold before evaluating a pending rubric, recomputes rubric score from weighted required/quality items, keeps critical as a gate and bonus outside the denominator, and uses the lower of the independently passing halves. Model aggregate score is advisory.

Submitted work, hints, deterministic report and exact rubric ID are checkpointed through the existing attempt write queue. Failed AI evaluation leaves the submission recoverable and offers Retry after reload; successful evaluation writes finalized history/evidence once. Finalized historical rubric_pending attempts are not rewritten.

All 18 current rubric references are exercised in Worker tests, including WRITTEN_COMMUNICATION_RUBRIC_V2, SALES_DISCOVERY_RUBRIC_V2, PRICING_REASONING_RUBRIC_V1, AUDIT_EVIDENCE_RUBRIC_V1 and SYSTEM_DESIGN_RUBRIC_V1. The runnable written, prospecting, audit, architecture, pricing and negotiation exercises now execute their exact rubric. The SAY IT V1 reference resolves, but its voice runtime remains a later-phase boundary. An older written V1 submission is tested separately.

Negotiation classification returns only one of seven existing strategies and confidence. At ≥0.8, valid language classification can select an authored reaction; explicit structured actions always win. Low confidence, Off, unlinked devices, provider failure and budget refusal use fallback. Classification creates no price, scope line, concession or client text. The pure engine owns consequences.

## Verification

- Node 22.22.1 local runtime. Typecheck, lint (one pre-existing hook warning), format check, docs validation, content check and production build pass. Full suite: 1,632 tests passed across 95 files (62 new tests in two new files and expanded existing suites).
- Worker AI suite: 46 tests, including every current rubric reference, old rubric version, canonical settings, all usage price categories, budget race, idempotency, Off/missing secret, malformed/semantic validation, repair success/failure, HTTP 429/5xx and timeout.
- New exercise integration: four tests for saved failure/reload/retry, one historical finalization, deterministic critical authority, objective threshold, missing assertions and rubric scoring.
- Negotiation engine: 12 new strategy/confidence/explicit-action boundary tests.
- AI probe: all five project widths (1440/1024/768/390/320), settings controls ≥44px and input text ≥16px, no horizontal overflow, preserved failed submission/reload and successful one-time fixture retry. Successful browser feedback uses an explicitly labelled transport fixture; it is not live Anthropic evidence.
- Existing sales, pricing, negotiation, keyboard and touch probes pass. Exercise probe preserves offline result/history/outbox/reload/retry coverage using an objective failure that needs no AI; correct rubric work and its retry/result states are covered by the AI probe. Negotiation's successful deterministic work now checks the recoverable pending checkpoint; fresh historical retry remains checked after a finalized critical failure.
- Chromium initially lacked system libraries; they were installed. An initial preview command supplied a positional root by mistake and was corrected. Neither setup issue is claimed as an unrelated baseline failure.

## Open boundaries

AI-009 remains PARTIAL: no Anthropic key exists in this process or local Worker variable files, and no real Anthropic call was made. Preview secret configuration must be checked/configured securely before a tiny live verification. Do not infer production secret state from local absence.

NEG-003 remains PARTIAL pending live language-quality verification, though classification routing and deterministic fallback are implemented. PRI-001, PRI-002, EXR-009 and product-wide PRD-004 retain their existing statuses. No adjacent requirement is automatically promoted.

An abrupt Worker termination while a rubric run is active needs operational reconciliation; caught provider failures support retry. Uncertain billed outcomes retain reservations through the UTC month. Historical finalized attempts stay immutable. Full adds no optional product feature. No voice, Boss Client continuity or new content was introduced.

Grader changed to `2026.09.17`. App, content (`2026.09.16`), rubric, simulator (`2026.09.11-r2`), mastery and IndexedDB versions deliberately remain unchanged.

## Preview evidence

CI run `34097678637` at code/document head `a394f446b6bfb78002122a3efdc15fc343898b31`: Checks SUCCESS, preview deploy SUCCESS (including the preview D1 migration step), production correctly skipped. Final documentation cleanup does not alter executable code. The PR handoff reports its final exact-head CI separately. No live Anthropic call was made.
