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

The authored rubric model_class controls normal routing. At $12 the governor prefers cheap; at $16 ordinary nonessential tasks are refused; $19+ allows only essentials, subject to the hard limit. Custom limits scale those boundaries. Optional work is reduced by refusing it at the first pressure band. Atomic D1 reservations cover initial evaluation and one repair; remaining balance can cause a cheap downgrade or refusal. Input is bounded, output is capped at 2048 tokens, and the conservative reservation includes the whole model input-context ceiling at cache-write rates. This may refuse a small request despite some remaining displayed balance. Actual input/output/cache-write/cache-read usage is recorded separately. Uncertain outcomes retain a reservation; limits cannot be lowered below committed spend. Usage insertion and reservation reduction commit atomically. Failure of either initial or repair accounting retains the unaccounted maximum, proven with injected D1 transaction failures.

Anthropic receives `output_config.format` with `type: json_schema`, never an assistant prefill. The provider schema removes unsupported numeric/string/array constraints as [Anthropic documents](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations); local validation retains them and checks exact authored item identities and critical consistency. One malformed or invalid rubric response produces one repair request; a second invalid response fails evaluation. Stable philosophy and exact rubric context precede variable work; the whole bundle is not sent.

D-171–D-175 record the combination, submission, persistence, provider and classification decisions. `gradeExercise()` stays deterministic. Critical failures, established required gates and missing runtime assertions remain authoritative. The combination reapplies the objective threshold before evaluating a pending rubric, recomputes rubric score from weighted required/quality items, keeps critical as a gate and bonus outside the denominator, and uses the lower of the independently passing halves. Model aggregate score is advisory.

Submitted work, hints, deterministic report and exact rubric ID are checkpointed through the existing attempt write queue. Failed AI evaluation leaves the submission recoverable and offers Retry after reload; successful evaluation writes finalized history/evidence once. Finalized historical rubric_pending attempts are not rewritten.

All 18 current rubric references are exercised in Worker tests, including WRITTEN_COMMUNICATION_RUBRIC_V2, SALES_DISCOVERY_RUBRIC_V2, PRICING_REASONING_RUBRIC_V1, AUDIT_EVIDENCE_RUBRIC_V1 and SYSTEM_DESIGN_RUBRIC_V1. The runnable written, prospecting, audit, architecture, pricing and negotiation exercises now execute their exact rubric. The SAY IT V1 reference resolves, but its voice runtime remains a later-phase boundary. An older written V1 submission is tested separately.

Negotiation classification returns only one of seven existing strategies and confidence. At ≥0.8, valid language classification can select an authored reaction; explicit structured actions always win. Low confidence, Off, unlinked devices, provider failure and budget refusal use fallback. Classification creates no price, scope line, concession or client text. The pure engine owns consequences.

## Verification

- Node 22.22.1 local runtime. Typecheck, lint (one pre-existing hook warning), format check, docs validation, content check and production build pass. Latest full suite after audit fixes: 1,642 tests passed across 97 files. The original implementation run had 1,634 tests across 95 files.
- Worker AI suite: 49 tests after the added provider fixture test, including every current rubric reference, old rubric version, canonical settings, all usage price categories, budget race, idempotency, Off/missing secret, malformed/semantic validation, repair success/failure, HTTP 429/5xx and timeout.
- New exercise integration: four tests for saved failure/reload/retry, one historical finalization, deterministic critical authority, objective threshold, missing assertions and rubric scoring.
- Negotiation engine: 12 new strategy/confidence/explicit-action boundary tests.
- AI probe: all five project widths (1440/1024/768/390/320), settings controls ≥44px and input text ≥16px, no horizontal overflow, preserved failed submission/reload and successful one-time fixture retry. Successful browser feedback uses an explicitly labelled transport fixture; it is not live Anthropic evidence.
- Existing sales, pricing, negotiation, keyboard and touch probes pass. Exercise probe preserves offline result/history/outbox/reload/retry coverage using an objective failure that needs no AI; correct rubric work and its retry/result states are covered by the AI probe. Negotiation's successful deterministic work now checks the recoverable pending checkpoint; fresh historical retry remains checked after a finalized critical failure.
- Chromium initially lacked system libraries; they were installed. An initial preview command supplied a positional root by mistake and was corrected. Neither setup issue is claimed as an unrelated baseline failure.

## Open boundaries

AI-009 is PASSED after the real deployed-preview verification recorded below. Production required-secret readiness is a separate pre-merge gate: the user is configuring it independently, and the final ChatGPT audit must confirm it. No merge is authorized by this closeout.

NEG-003 remains PARTIAL: one real hold classification at confidence 0.95 verifies the runtime path, but broad language interpretation quality is not established. PRI-001, PRI-002, EXR-009 and product-wide PRD-004 retain their existing statuses. No adjacent requirement is automatically promoted.

An abrupt Worker termination while a rubric run is active needs operational reconciliation; caught provider failures support retry. Uncertain billed outcomes retain reservations through the UTC month. Historical finalized attempts stay immutable. Full adds no optional product feature. No voice, Boss Client continuity or new content was introduced.

Grader changed to `2026.09.17`. App, content (`2026.09.16`), rubric, simulator (`2026.09.11-r2`), mastery and IndexedDB versions deliberately remain unchanged.

## Preview evidence

CI run `34097678637` at code/document head `a394f446b6bfb78002122a3efdc15fc343898b31`: Checks SUCCESS, preview deploy SUCCESS (including the preview D1 migration step), production correctly skipped. Final documentation cleanup does not alter executable code. The PR handoff reports its final exact-head CI separately. That historical run did not include a live Anthropic call; the later live verification is recorded below.

## Independent audit fixes — 2026-09-07

Executed `docs/handoffs/phase-19-independent-audit-fixes.md` from branch head `4e33835c8a9f9071e8d8edaee9216e07233eb2ae` on the existing PR #21 branch. The Sonnet/Haiku fixture now creates a fresh Response per transport call; provider implementation is unchanged.

AI-002 / D-176: `getAiSettings` reconciles the canonical Worker mode into the existing `ai.mode` workspace cache before returning the effective mode to Settings. Local Off takes effect synchronously on selection and persists before the PUT, including offline failures. Transient revision/write guards prevent older reads and reads started during a write from re-enabling AI. A later successful canonical Limited/Full refresh replaces stale Off without another Save. Settings uses the reconciled mode for refresh and successful writes. No second persistent settings store, server gate change, or changes to attempt queues, grading, classification authority, reservations or required-secret declarations.

Observed local verification on Node 22.22.1:

- Focused AI client + Worker suites: 60 tests across four files, including seven new client/UI cases and the corrected provider test.
- Full suite: 1,642 tests across 97 files pass. Typecheck, lint (one existing hook warning), format, docs validation, content check and production build pass; an explicit `CLOUDFLARE_ENV=production npm run build` also passes.
- AI probe passes Settings and failed-submission/reload/successful-fixture retry at 1440/1024/768/390/320. Exercise, negotiation (zero failures), keyboard and touch probes pass. Local artifacts: `.review/phase19-audit/` plus keyboard/touch probe output. These use fixture Anthropic responses, not live provider evidence.
- Initial browser runs hit blank pages/timeouts. Rerunning with Chromium container flags `--no-sandbox --disable-dev-shm-usage` passed all five probes; the failed initial runs are not counted as passes.

At the audit-fix stage, live verification was still pending. The subsequent live evidence below closes AI-009 as PASSED; NEG-003 remains PARTIAL. Required preview and production secrets remain declared. PR #21 remains open for independent final audit and must not be merged by this task.

## Live-provider closeout — 2026-09-07

Verified implementation head: `264794eb8f2cf9efec252f782394c951c9a004d0`. CI run [34105051578](https://github.com/Beeyach/Bloomlab/actions/runs/34105051578), attempt 3: Checks SUCCESS, Preview deploy SUCCESS; production correctly skipped. The deployed [preview](https://bloomlab-preview.cool-sunset-2169.workers.dev) listed version `ac1be646-557e-4ee4-9e43-71992461cf58` at 100%. Live verification ran 09:47:14–09:48:14 UTC. Health returned HTTP 200 with environment preview. This evidence used real Anthropic through the deployed Worker, not the browser probe's fixture transport.

A disposable linked learner began in Limited mode with a $20 monthly limit, $0 spent and $0 reserved. One minimal rubric-backed evaluation of `EX-WRITE_IT-northwind-cold-email` returned HTTP 200 with exact `WRITTEN_COMMUNICATION_RUBRIC_V2`, version 2, run `f42afee3-8c59-41fc-a75d-c3f115b985ff`. Bloomlab's actual structured-output validator accepted all 11 authored item identities and critical consistency. D1 contained the matching completed `rubric_runs` response, matching `ai_feedback` result/rubric/version/model/cost and non-zero provider usage. The evaluation used exactly one permitted repair retry. The initial invalid response was not persisted, so its precise validation failure is not claimed.

All charged rows used cheap model `claude-haiku-4-5-20251001` and persisted the associated exercise ID, request category and timestamp:

| Timestamp (UTC, 2026-09-07) | Category | Input tokens | Cached input tokens | Cache creation tokens | Output tokens | Cost USD |
|---|---|---|---|---|---|---|
| 09:47:45.266 | written_coaching | 1,584 | 0 | 0 | 1,037 | 0.006769 |
| 09:48:08.977 | written_coaching | 1,609 | 0 | 0 | 989 | 0.006554 |
| 09:48:10.921 | negotiation | 366 | 0 | 0 | 17 | 0.000451 |

After evaluation, settings showed **$0.013323 spent and $0 reserved**. A single real free-form classification for `EX-NEGOTIATE_IT-summit-freelancer-quote` returned HTTP 200 with only authored strategy `hold` and confidence `0.95`; matching classification feedback and usage were persisted. Feeding that actual result into the existing pure engine selected an authored conditional reply and next node `budget`, kept deal terms and hidden state unchanged, preserved the input and produced the same result on repeated execution. An explicit walk-away action overrode the language classification.

The verification script initially expected only the default reply and rejected a legitimate authored conditional variant. Correcting that assertion offline confirmed the boundary without another provider call. Its cleanup revoked the disposable device; subsequent authenticated settings access returned HTTP 401 and D1 confirmed revocation and cleared session credentials. Final totals were therefore verified directly from D1: **$0.013774 spent, $0 reserved**. Historical usage and feedback were preserved.

**AI-009 is PASSED. NEG-003 remains PARTIAL:** the single live hold sample proves the path, not broad language quality. The rubric sample returned score 58 with a critical issue; structured success is not a passing learner grade or proof of general judgment quality. Its critique mischaracterized qualified “may” wording as “will”, a remaining quality limitation. PRI-001, PRI-002, EXR-008, EXR-009, PRD-004, voice/Call Room and later Boss Client statuses are unchanged.

Detailed local evidence remains under `.review/phase19-live/report.md` and `.review/phase19-live/evidence.json`; only this sanitized summary is committed. No keys, tokens, raw auth headers or disposable sync keys are included. Production secret configuration is being handled separately by the user and must be checked by the independent final audit before merge. This documentation closeout changes no runtime behavior or grader/content/simulator/mastery/app versions. Its final commit and CI run are reported in the PR body after push; the implementation CI above is not claimed as verification of that later documentation head.
