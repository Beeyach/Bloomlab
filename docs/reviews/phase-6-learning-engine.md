# Phase 6 review — Learning Engine

Date: 2026-09-02 · Branch `feat/learning-engine` · Spec §28–§34, §143; TA§68–§70, §82.

The mastery engine is a domain package, not UI state and not a points system: pure functions over evidence, with every rule written down and versioned. Learner records use the Phase 3/4 local-first and sync architecture unchanged — Dexie first, outbox in the same transaction, Worker and D1 as they are. No new migration was needed.

## Where things are

| Layer | Where | What |
|---|---|---|
| Rules | `packages/mastery-engine/src/rules.ts` | `MASTERY_RULES_VERSION = 2026.09.02-r3`; states, ladder, assistance table, evidence kinds, ladder rules, confidence, review and session constants. Nothing else in the engine holds a number. |
| Evidence | `src/evidence.ts` | `SkillEvidenceSchema` (spec §30, every field required), `assistanceFromHints`, `effectiveAssistance`, the pass / independent / pressure / fieldwork / sales predicates. |
| Mastery | `src/mastery.ts` | `evaluateSkill` → state, ladder state, refresh overlay, confidence, missing requirements, review due and priority, counts. |
| Review | `src/review.ts` | importance, failure rate, intervals, due dates, NEEDS_REFRESH overlay, priority, `scheduleReviews`. |
| Campaign | `src/campaign.ts` | prerequisite satisfaction, gate pass criteria, `evaluateCampaign` (current gate, next required, work ahead, unlocked). No clock input. |
| Session | `src/session.ts` | `buildSession`, `nextStepFor`, `assistanceDependence`. |
| Records | `apps/web/src/data/learning/` | `recordEvidence`, `recomputeProgress` / `evaluateLearner`, `buildLearnerSession`, stores, hooks, learner-scoped ids, `currentVersions`. Dexie v3: `skill_evidence`, `exercise_attempts`, `skill_progress`, `campaign_progress`, `review_queue`. |
| Sync | `apps/web/src/data/types.ts`, `sync/link.ts`, `sync/scheduler.ts`, `app/RootLayout.tsx` | the five entities join `LOCAL_SYNC_ENTITIES`; derived rows are purged at link time and recomputed; the scheduler recomputes after any sync that pulled. |
| UI | `apps/web/src/screens/LearningDiagnostics.tsx` | diagnostic only: skills with evidence, campaign gates, review queue (pass / fail retrieval), record-evidence form, Build my session + Continue, evidence stamp. |
| Probe | `scripts/review/learning-probe.mjs`, `probe-lib.mjs` | two-device check; the sync probe now shares the helpers. |

## Mastery transition rules (exact)

A skill's **earned ladder state** is the highest rung whose rule holds over its evidence history. "Pass" means `result: passed` **and** no critical failure (a critical failure is never a pass, spec §31).

| State | Rule |
|---|---|
| UNSEEN | no evidence |
| LEARNING | any evidence at all — exposure and quizzes never reach further (MAS-002) |
| GUIDED | ≥ 1 pass of a practice kind, with any assistance (a worked-example pass lands here) |
| PRACTICED | ≥ 1 pass of an independent-capable kind with effective assistance ≤ light |
| INDEPENDENT | ≥ 1 pass of an independent-capable kind with effective assistance = independent |
| PRESSURE_TESTED | INDEPENDENT rule met by a pass whose kind is `pressure_test` or whose exercise mode is `pressure` |
| MASTERED | unassisted passes ≥ max(2, skill `independent_evidence`), over ≥ 2 distinct demonstrations (different exercise or different day), **and** every declared requirement: pressure test if `pressure_test`, provided real-GHL fieldwork if `fieldwork_required`, a sales-use pass if `sales_use` |

**NEEDS_REFRESH** is an overlay on any earned state ≥ PRACTICED (`refresh_from` keeps the rung): it applies when the review is overdue by more than 14 days, or the latest attempt is a failed retrieval. A retrieval passed with at most light assistance clears it and advances `review_due` from that pass, because the evaluation is recomputed from the whole history; a guided or worked-example retrieval pass neither clears it nor moves the review date (MAS-011). Nothing is deleted or rewritten.

Evidence kinds: `exposure`, `quiz` (exposure-only); `guided_practice` (guided at least, never independent); `deterministic_exercise`, `independent_exercise`, `pressure_test`, `explanation`, `sales_use`, `fieldwork`, `real_ghl`, `retrieval` (independent-capable).

## Evidence schema (spec §30, MAS-003)

```
id, learner_id, skill_id, kind, source {type, id}, exercise_id, exercise_type, attempt_id,
result (passed | failed | partial | exposed), score (0–100 | null), assistance,
hints_used[], difficulty (1–5), critical_failures[], occurred_at,
versions {app, content, content_hash, simulator, rules}, real_ghl {required, provided, evidence[]} | null,
mode (guided | practice | independent | pressure | null)
```

Records are validated inside the write transaction; an incomplete record aborts the attempt and its evidence together. Each attempt (`exercise_attempts`) is the parent of one evidence row per skill it demonstrated and carries the same version stamp.

## Assistance semantics (spec §28, §34; MAS-007, MAS-011)

| Hints used | Assistance |
|---|---|
| none | independent |
| 1–2 nudges | light |
| a concept reminder, or ≥ 3 nudges | guided |
| any worked example | heavy |

Effective assistance is the maximum of the recorded level, the hint roll-up, and the exercise floor (guided practice or a `guided`-mode exercise is guided at least). Only **independent** passes count as independent demonstrations; light-assisted passes count toward PRACTICED; guided and heavy passes toward GUIDED only. Assistance dependence (share of recent passes at guided or heavy) is computed for every session plan.

## Review scheduling algorithm (spec §32, TA§69; MAS-005, MAS-009)

- importance = 1 + 0.5·pressure_test + 0.5·fieldwork_required + 0.25·sales_use (from the skill)
- failure_rate = failures ÷ attempts over the last 5 attempts
- interval_days = base(state) ÷ importance × (1 − 0.5 × failure_rate), min 3; base: PRACTICED 10, INDEPENDENT 21, PRESSURE_TESTED 35, MASTERED 60; states below PRACTICED are progression, not review
- review_due = last_demonstrated + interval
- NEEDS_REFRESH when now > review_due + 14 days, or the latest attempt is a failed retrieval
- priority = importance × (1 + overdue_days ÷ 7) + 2 × failure_rate + 3 if NEEDS_REFRESH
- queue: due items by priority desc, upcoming by due date; the queue never blocks anything

## What resets the review clock (`DEMONSTRATION_RULES`, D-051)

`last_demonstrated` — the anchor of every review interval and of the NEEDS_REFRESH overlay — moves only on a **demonstration**: `isDemonstration(evidence)` in `packages/mastery-engine/src/evidence.ts`, whose terms are the constant `DEMONSTRATION_RULES` in `rules.ts`.

| Evidence | Resets the clock? |
|---|---|
| independent exercise, deterministic exercise, pressure test, explanation, sales use, retrieval — `passed`, no critical failure, at most light assistance | yes |
| fieldwork, real-GHL — as above **and** `real_ghl.provided: true` | yes |
| fieldwork or real-GHL without the proof provided | no (not a pass at all) |
| exposure, quiz (any result), guided practice | never |
| any kind with `failed` or `partial`, or a `passed` result carrying a critical failure | no |
| any kind done with a concept reminder, three or more nudges, or a worked example (guided / heavy) | no |
| a failed retrieval | no — it forces NEEDS_REFRESH |

Tested kind by kind, result by result, assistance level by assistance level and with and without proof in `test/demonstration.test.ts` (27 cases); the test also asserts that every declared evidence kind is classified.

## Session-builder algorithm (spec §33, TA§70; MAS-006)

Budgets: 30m → 30, 1h → 60, 2h → 120, deep → 240 minutes. Decisions, in order:

1. **Retrieval** — due reviews by priority, 5 min each, up to 20 % of the budget.
2. **Repair** — up to 25 %: weak prerequisites (< INDEPENDENT) of the next required skills and the focus skill, in path order; skills failed in the last 14 days; when assistance dependence ≥ 0.5, skills passed with guided / heavy help ("try it without hints").
3. **Focus** — the learner's chosen skill or territory.
4. **Campaign** — the current gate's available, not-yet-passing skills, then available work-ahead skills, until the budget is used.
5. **Fieldwork and project** — pending fieldwork the gate requires; the active project's next exercises.

For each skill `nextStepFor` picks: the unit if never exposed and below PRACTICED → a guided exercise if below GUIDED → a practice exercise if below PRACTICED → an independent exercise until the independent count is met → the pressure test → fieldwork → a sales-family exercise, preferring exercises not yet passed, then the shortest. Every item carries a reason; the plan carries its notes and `rules_version`; **Continue** rebuilds with the finished item ids excluded.

## Prerequisite and gate behaviour (spec §7, §11, §143; PRD-002, PRD-003, CUR-002)

- A prerequisite is satisfied when its **ladder** state is ≥ INDEPENDENT — a NEEDS_REFRESH prerequisite still satisfies (review never blocks).
- A skill is available when all prerequisites are satisfied, wherever it sits in the campaign; `work_ahead` lists available skills in later gates.
- A gate passes when every skill meets its pass criteria: independent passes ≥ `independent_evidence_per_skill` and ladder ≥ INDEPENDENT, plus a pressure pass / fieldwork pass where the gate requires them. Status: `locked` (nothing available), `available`, `in_progress` (any evidence), `passed`; placement gates are `optional` and list the assessed skills already cleared.
- No function in `campaign.ts` takes a clock; the test evaluates the same history two years apart and gets identical gate statuses.

## Local-first and sync verification

- Web tests (fake-indexeddb + `FakeSyncServer`): evidence, attempt and derived rows persist with outbox entries; version stamp on every record; content change never rewrites evidence; prerequisite unlock and gate status from the real content; session from the real content; two devices converge on the same evidence and the same derived rows; provisional derived rows are dropped at link time and rebuilt.
- `npm run review:learning` (local preview, real Worker + local D1, two headless Chrome profiles):

```
A linked and recorded independent evidence locally, then synced
  message "Recorded 1 evidence row(s) for SK-STRATEGIZE-funnel-math (independent)."
  skill row: Independent · confidence 0.6 · independent 1/2 · pressure 0 · fieldwork 0 · attempts 1 · review 2026-09-15 · missing: independent_evidence, pressure_test, sales_use
  campaign row: current gate GATE-1 · passed 0/12 · next SK-STRATEGIZE-funnel-math, SK-STRATEGIZE-bottleneck-diagnosis · work ahead SK-BUILD-lead-capture-form, SK-ARCHITECT-tags-vs-custom-fields, SK-AUTOMATE-workflow-foundations, SK-SELL-evidence-based-audit
B linked and received the evidence and the same derived rows
  sameSkillRow true · sameCampaignRow true · recent evidence on B shows A's row with its version stamp
B recorded a heavily assisted pass offline; after reconnect both devices agree
  bOfflineIndicator "Offline · saved on this device" · 4 operations queued while offline
  aGuided true · 4 derived rows compared · differences [] · workedExampleNotIndependent true
phone width  overflow390 false · capture .review/learning-b-390.png
ok: true
```

- The Phase 4 sync probe still passes after the helper extraction (all nine steps, `ok: true`).

## Version stamping

`currentVersions()` = `{ app: 0.1.0 (@bloomlab/shared), content: 2026.09.02 and content_hash e15441abc7fc (compiled bundle), simulator: 0.0.0 (@bloomlab/simulator-core), rules: 2026.09.02-r3 }`, written on every attempt and evidence row at write time and never rewritten. Derived rows record the content version and rules version they were computed under. The Learning section shows the stamp on each recent evidence row; `/api/health` and `/system` show the triplet.

## Migrations

None. `skill_evidence`, `exercise_attempts`, `skill_progress`, `campaign_progress` and `review_queue` exist since Phase 4 (`migrations/0001_init.sql`), each as the envelope columns plus a JSON `payload`; the Worker's push / pull handlers are entity-generic. No production schema change.

## Tests

| Suite | Count | What |
|---|---|---|
| `packages/mastery-engine/test/evidence.test.ts` | 18 | the §30 field set (each field required, each version key required), unknown keys, the assistance table, worked example never independent, guided practice floor, nudge = practice, critical failure never a pass |
| `test/mastery.test.ts` | 10 | scenarios 1–7, fieldwork and sales-use requirements, eight states only, rules version (16) |
| `test/review.test.ts` | 9 | scenarios 12–14, interval arithmetic, failed retrieval, queue ordering, and the explicit refresh round trip: MASTERED → NEEDS_REFRESH → unassisted retrieval → MASTERED preserved with `review_due` advanced by the MASTERED interval; the INDEPENDENT variant with a requirement still missing; an assisted retrieval does not restore |
| `test/campaign.test.ts` | 7 | scenarios 8–11, refresh never locks, completion |
| `test/demonstration.test.ts` | 27 | what resets `last_demonstrated`: every kind, failed / partial / critical results, light vs guided vs heavy assistance, fieldwork with and without proof, failed retrieval forces refresh, unverified fieldwork is never a pass |
| `test/session.test.ts` | 7 | scenario 15, first-session behaviour, determinism, four lengths + Continue, focus and weak-prerequisite repair, pressure/fieldwork steps, assistance-dependence retries |
| `apps/web/src/data/learning/learning.test.ts` | 10 | scenarios 16–18, incomplete record rejected, content-change safety (DATA-011), exposure = LEARNING, unlock + gate, session from real content, link-time re-key |

Engine total 81; web total 49 (10 new); repository total 292 tests in 36 files. Typecheck (8 workspaces), lint, Prettier, docs validator, `content:check` and the production build are green (`npm run ci`).

## Requirement statuses

- PASSED: MAS-001, MAS-002, MAS-003, MAS-005, MAS-006, MAS-007, MAS-008, MAS-009, MAS-011, PRD-002, PRD-003, CNT-007, DATA-011, INF-013.
- PARTIAL: CUR-002 — thirteen competency gates exist and resolve on evidence; gates 6 and 12 have no authored skills yet (Phase 24).
- NOT_STARTED, by design: INF-018 (P2 learning-event analytics); MAS-004 belongs to Phase 9, though the engine already refuses to count a critical-failure pass.
- BLOCKED / FAILED: none.

## Not done / honest gaps

- Evidence is recorded by hand on `/system`; units and exercises that produce it are Phases 8–9.
- The rules are v1 (strict on hints, uncalibrated intervals); every number is in one file under a version, and stored evaluations keep the version they were computed under.
- The quiet assistance meter and every learner-facing view of these rows are Phase 7.
- Convergence assumes each device recomputes after pulling (the scheduler and the manual Sync now both do); a device that has not pulled shows its own older derived rows, never wrong evidence.
