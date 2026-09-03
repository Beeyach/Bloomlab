# Phase 9 review — Exercise Runner

Date: 2026-09-04 · Branch `feat/exercise-runner` · Spec §27–§35, §76, §84, §98–§102, §119–§130, §158–§164; TA§31–§34. Requirements EXR-001 … EXR-009, EXR-019, EXR-022, EXR-024, MAS-004.

Phase 9 builds the machinery, not one page. The grader is a pure package that any later runtime can feed; the runner is one route that plays any authored family; the attempt lifecycle, hint ladder, evidence write and idempotency are shared. Where a family needs a simulator that does not exist, the runner says which one and grades nothing.

## Package boundaries

| Package | Depends on | Holds |
|---|---|---|
| `@bloomlab/exercise-engine` | `@bloomlab/mastery-engine` (assistance rules only) | The grading contract and the six assertion evaluators. No React, DOM, IndexedDB, network, AI, randomness or `Date.now()`. |
| `@bloomlab/content-schema` | zod | The authored exercise, its assertions, tiers, response markers and decision options, and the compile-time checks the runtime depends on. |
| `apps/web/src/exercise` | both, plus the Phase 3–6 data layer | The route, the family treatments, the attempt lifecycle, the learner-side grading context, and finalization through `recordEvidence`. |

```
packages/exercise-engine/src
├── types.ts        GradingContext · GradingEvent · GradingArchitecture · AssertionResult · GradeReport
├── rules.ts        EXERCISE_GRADER_VERSION · SCORING_RULES · TIMING_RULES · SEQUENCE_RULES
├── path.ts         safe dotted-path resolution (no eval, no prototype chain)
├── assertions.ts   the six evaluators + sourcesFor()
├── grade.ts        gradeExercise() · requiredSources() · isFullyGradable()
└── index.ts

apps/web/src/exercise
├── ExerciseRunner.tsx   the route: brief · work area · assistance · submit · result
├── HintDrawer.tsx       the authored hint ladder and the assistance line
├── ResultView.tsx       outcome · critical · tiers · assistance · next step · try again
├── runnerCopy.ts        family treatments, keyed by exercise.type
├── attempt.ts           the active attempt in the local workspace
├── response.ts          learner state tree, response markers, prediction fields
├── runtime.ts           the runtime registry (empty in Phase 9) and what is missing
├── finalize.ts          grade → recordEvidence, once per attempt
├── markdown.tsx         authored prose, small subset, never HTML
└── useAttemptHistory.ts
```

## Runner routes

| Route | Query | Behaviour |
|---|---|---|
| `/exercise/:exerciseId` | — | Any authored exercise, resolved from the compiled bundle. |
| `/exercise/:exerciseId` | `?skill=` | The capability the learner arrived from; ignored unless the exercise teaches it. |
| `/exercise/:exerciseId` | `?run=retrieval` | The same exercise as a review vehicle (D-072). |
| unknown id | — | "No exercise at this address." with a link to the Skill Map. No crash, no blank page. |

Deep links work and survive a reload, including the retrieval context, which is stored on the attempt.

## The deterministic grading contract

```ts
gradeExercise({ exercise, context, hints_used, assistance }) -> GradeReport
```

`GradingContext` is what a runtime must produce, and nothing in it names the simulator package:

| Field | Meaning |
|---|---|
| `state` | The state tree assertions address by path. A runtime merges its own state with the learner's `prediction` / `decision` / `answer` roots. |
| `events` | `{ type, at, index, fields }` — simulator time, a stable emitted index for ties, and the flat fields `where` matches. |
| `references` | Named instants timing measures against (`appointment.start`, `appointment.no_show`). |
| `architecture` | Normalized workflows: trigger feature, nodes with type and feature, re-entry setting. **No coordinates.** |
| `provides` | Which of those the run actually supplies. |

`GradeReport`: `exercise_id`, `grader_version`, `outcome` (`passed` / `failed` / `partial`), `reason`, `score`, `pass_threshold`, `assistance`, `hints_used`, `failed_critical[]`, `tiers` (critical / required / quality / bonus, each an `AssertionResult` with `id`, `description`, `type`, `tier`, `passed`, `expected`, `observed`, `detail`, `unevaluated`, `missing_source`), `counts`, `rubric_pending`.

## The six assertion semantics

| Type | Reads | Rule | Reports |
|---|---|---|---|
| **state** | `state` (or `learner` for the three learner roots) | `equals` · `contains` (arrays and text) · `not_contains` (passes when absent or the path is missing) · `exists` / `absent` (a null counts as absent) · `gte` / `lte` (numbers only) over a dotted path resolved by own properties, never through `__proto__`, `constructor` or `prototype` | `opportunities.opp-maria.stage = "Won"` against `… = "Lost"`, or "… is not in the state" |
| **event** | `events` | Filter by type, narrow by `where` (exact field equality), then `exactly` / `min` / `max`; the compiler requires at least one bound | "exactly 1 sms.sent where contact_id=maria, purpose=rebooking" against "2 matching events" |
| **timing** | `events` + `references` | Target = reference + `offset_minutes`; the **closest** matching event is judged, ties broken by (timestamp, emitted index); passes when \|drift\| ≤ `tolerance_minutes`, boundary inclusive. Never the wall clock | "sms.sent 1440 min before appointment.start (±10 min)" against "sms.sent 11 min late" |
| **architecture** | `architecture` | `trigger_exists` · `action_exists` · `branch_exists` · `feature_used` / `feature_not_used` (trigger and nodes together) · `node_count_max` (total across the solution) · `reentry_disabled` (no workflow allows re-entry, and an empty solution fails) | "a workflow triggered by GHL-WF-APPOINTMENT-STATUS" against the triggers actually present |
| **negative** | `events` | Passes only when no event matches type and `where` | "no sms.sent where contact_id=lena" against "1 occurred (first at …)" |
| **sequence** | `events` | The **earliest** `before` must precede the **earliest** `after`; equal timestamps are ordered by emitted index; a missing event on either side fails and is named | "sms.sent before tag.added" against "tag.added at … came first" |

An assertion whose source the run does not provide is `unevaluated` — neither a pass nor a fail — and the report can then never be `passed`.

## Tiers, scoring and the critical gate

- **critical** — everything in `critical_failures`, always. Never scored.
- **required** — expected outcomes with no authored tier (every exercise written before Phase 9) or `tier: required`.
- **quality**, **bonus** — authored explicitly.

**Score** = round(100 × passed(required + quality) / total(required + quality)). Bonus is reported and excluded from the denominator. `null` when nothing is scorable (D-067).

**Outcome**, in order:

1. any evaluated critical assertion failed → `failed` / `critical_failure` — at 95%, at 100%, always (MAS-004);
2. any assertion unevaluated → `partial` / `unevaluated_assertions`;
3. a rubric is owed → `partial` / `rubric_pending`;
4. nothing scorable → `partial` / `nothing_to_grade`;
5. else `score >= pass_threshold` → `passed` / `threshold_met`, otherwise `failed` / `below_threshold`.

The per-dimension weights some exercises author (correctness, edge cases, architecture, maintainability, explanation) are deliberately not applied: no assertion says which dimension it belongs to. EXR-023 owns that with the Workflow Lab.

## Grader versioning

`EXERCISE_GRADER_VERSION` (`2026.09.04-r1`) is on every report, and the report is stored on the attempt row (`exercise_attempts.grade`). Evidence keeps the mastery fields and links to the attempt; `EvidenceVersions` is unchanged (D-069). Changing the grader later cannot rewrite an old attempt.

## Attempt lifecycle

```
none → active (draft in the local workspace) → finalized (exercise_attempts + skill_evidence)
                        ↑ reload resumes                    ↓ Try again
                        └──────────── new attempt id ───────┘
```

### Run context: the exercise is the vehicle, the skill is the capability (D-072)

A retrieval names two things, and both are part of the run's identity.

| | Normal run | Retrieval run |
|---|---|---|
| Draft key | `exercise.attempt.<exercise>` — the same key whatever capability the learner arrived from | `exercise.attempt.<exercise>:retrieval:<skill>` |
| Current result | attempts whose `source.type` is `exercise` | retrieval attempts whose `skill_ids` contains the reviewed capability |
| Evidence written for | every skill the exercise teaches | the reviewed capability, only |
| An invalid target | — | refused: `startAttempt` and `skillsForAttempt` throw, and the runner treats such a link as an ordinary run rather than reviewing everything |

So an unfinished normal attempt is never resumed as a review, a finished normal attempt is never shown as a review's result, and the inverse holds. `attemptHistory` still returns the exercise's complete history; only the *current* result is scoped. Try again stays inside its own context.

Scoping matters because retrieval evidence moves the review clock: reviewing one capability must never reset another's clock, clear its NEEDS_REFRESH, or force one, merely because the same exercise teaches both.

- The id is minted when the learner starts and lives in `workspace["exercise.attempt.<id>"]` with the start time, revealed hints and unfinished response.
- A reload resumes the same attempt: the probe shows the same `attempt_id`, the same hints and the same text after a reload.
- Finalizing passes the id to `recordEvidence` as `attempt_id`, with evidence ids `ea:<attempt id>:<skill id>`.
- Active drafts are device-local and do not sync. Finished attempts and evidence sync as before (D-068).

## Submission idempotency

| Situation | Result |
|---|---|
| Double submit | The second call finds the attempt row and writes nothing (`recorded: false`); one attempt, one evidence row per skill. |
| Retry after a failed write | Same id, same rows; the draft is only discarded once the attempt exists. |
| Reload after finalizing | The recorded attempt is shown; no second attempt. |
| Try again | New id, new attempt; the earlier attempt and its evidence are untouched and its score is unchanged. |
| Two devices attempting the same exercise | Two ids, two attempts, two evidence sets — separate facts, never de-duplicated. |

## Hints and assistance

The authored ladder reveals in order: Nudge → Concept Reminder → Worked Example. Each reveal is recorded on the attempt and survives a reload; revealing the same level twice is one use. Assistance is the mastery engine's own roll-up (`assistanceFromHints`), never a second table: none → Independent, one or two nudges → Light, three nudges or a concept reminder → Guided, a worked example → Heavy. A guided-mode exercise is guided at least, in both the report and the evidence. The line reads `Assistance / Light` and nothing more.

A pressure exercise authors no hints (the schema enforces it), the drawer says "No hints this time.", and there is no lesson link, no worked example and no other control offering help.

## Evidence-kind mapping

| Launch | Kind | Source | Mode recorded |
|---|---|---|---|
| guided exercise | `guided_practice` | `exercise` | `guided` |
| practice exercise | `deterministic_exercise` | `exercise` | `practice` |
| independent exercise | `independent_exercise` | `exercise` | `independent` |
| pressure exercise | `pressure_test` | `exercise` | `pressure` |
| any exercise with `?run=retrieval` | `retrieval` | `retrieval` | none (D-072) |

The outcome maps straight through: `passed` → passed, `failed` → failed, `partial` → partial. Every row carries the score, assistance, hints, difficulty, failed critical ids, the real start and completion times and the version stamps, then the Phase 6 engine recomputes. Nothing in the UI mutates mastery state.

## Retrieval behaviour

A retrieval session item opens the authored exercise with `?run=retrieval&skill=<capability>`. The evidence is `retrieval` from source `retrieval`, is written **for the reviewed capability only**, and carries no authored mode, so assistance comes only from hints actually taken: an unassisted pass clears NEEDS_REFRESH for that capability and advances its review clock, a guided or worked-example one does not, and none of it counts toward an independent demonstration (D-050 … D-052 unchanged). Reviewing one capability leaves every other capability the exercise teaches untouched — no evidence, no clock change, no state change. Where a due skill has no authored exercise, nothing is offered and no evidence is invented.

A retrieval that names no capability, or one the exercise does not teach, is never widened to every taught skill: `startAttempt` and `skillsForAttempt` refuse it, and the runner treats such a link as an ordinary run of that exercise.

## Phase 7 and 8 integration

- `stepDestination` now routes `unit` → Academy, `exercise` → `/exercise/<id>?skill=<skill>`, `retrieval` → `…&run=retrieval`.
- Command Center Continue and every session-plan item use it.
- The capability sheet's next-step block links "Run this exercise" / "Run this retrieval".
- The Academy `<Exercise>` embed links "Open this exercise", and the unit's finish panel offers "Run the exercise".
- Every "arrives with Phase 9" string is gone from the product.

## Family status

| Family | What works now | What is missing, exactly |
|---|---|---|
| **BUILD IT** (EXR-004, PARTIAL) | Objective, allowed features from the registry, hint ladder, attempt lifecycle, result presentation, and the deterministic grading proven against the authored exercise with fixture runs (architecture, event, timing, state, two critical negatives) | The construction surface: Workflow Lab (Phase 12) on the simulator core (Phase 10). No submit is offered. |
| **FIX IT** (EXR-005, PARTIAL) | Incident-toned brief with the symptom first, the faulty node never on the page until a hint is asked for, diagnosis captured | The execution logs the exercise tells the learner to read, and the repair: simulator core (Phase 10). |
| **RUN THE LEAD** (EXR-006, PARTIAL) | Prediction captured before any run, in fields derived from the exercise's assertion paths and labelled from the path so nothing leaks; locked into the attempt | The execution and its animation, and comparing prediction against actual: simulator core (Phase 10). |
| **EDGE CASE** (EXR-007, PARTIAL) | The changed variable, the verdict captured, pressure rules enforced (no hints, no lesson) | The run that decides the verdict: simulator core (Phase 10). |
| **ARCHITECTURE DECISION** (EXR-009, PARTIAL) | Fully runnable: authored options chosen, reasoning written and preserved, both authored checks evaluated, graded, recorded, learner state updated | Its `mixed` grading names `SYSTEM_DESIGN_RUBRIC_V1`, so the outcome is `partial` until the AI gateway (Phase 19). The later-level version with no options is unauthored content. |
| **REBUILD BLIND** (EXR-019, PARTIAL) | No hints, no lesson link, no worked example, no answer architecture revealed; attempt lifecycle and grading contract | The rebuilding surface: Workflow Lab (Phase 12). |
| **WHAT WOULD YOU BUILD** (EXR-008, PARTIAL) | Fully runnable capture: open prompt with no feature named anywhere on the page, free response, the one authored deterministic marker evaluated from the exercise's own vocabulary | Matching several valid architectures and judging open-ended reasoning: AI gateway (Phase 19). The build-order discrepancy is recorded in D-073. |

## Exact later-phase dependencies

**Phase 10 (simulator core)** must fill `GradingContext.state`, `.events` and `.references` and register a runtime in `EXERCISE_RUNTIMES` declaring those sources. That alone makes FIX IT, RUN THE LEAD and EDGE CASE runnable.

**Phase 12 (Workflow Lab)** must additionally produce `GradingContext.architecture` as normalized workflows (trigger feature, nodes with type and feature id, re-entry setting — no coordinates). That makes BUILD IT and REBUILD BLIND runnable. Neither phase needs to change the grader.

**Phase 19 (AI gateway)** owns rubric evaluation. Until it exists, an exercise naming a rubric ends `partial` and its written work is preserved.

## Tests

| Suite | Count | Covers |
|---|---|---|
| `packages/exercise-engine/test/assertions.test.ts` | 32 | Path resolution and prototype safety; every state operator including missing paths and nulls; event counts, `where` narrowing, zero events, multiple contacts, wrong purpose; timing exact, inside, exactly on and just outside tolerance, multiple candidates, positive offsets, missing reference, no event; architecture trigger/action/branch/feature/limit/re-entry and node order not mattering; negative present, absent and narrowed; sequence correct, reversed, missing, repeated and equal timestamps; source requirements and the unevaluated path. |
| `packages/exercise-engine/test/grade.test.ts` | 20 | Scoring and threshold including exactly on it; tier grouping and bonus exclusion; critical override at 95% and 100%; all failed critical ids; refusal to judge a missing source; rubric pending; deterministic failure beating a pending rubric; assistance roll-up and floors; grader version; byte-equal reports across repeats, a five-year clock jump and reordered assertions. |
| `apps/web/src/exercise/retrievalContext.test.tsx` | 20 | Run-context identity: the draft key per context; a retrieval honoured only for a capability the exercise teaches and refused otherwise; a normal draft not resumed as a review and the inverse; two reviews of two capabilities as two attempts; a review resuming across a deep-link reload; a finished normal attempt not becoming a review's result and the inverse; the complete history still queryable; Try again inside its own context; the skill scoping of `skillsForAttempt`; one retrieval row for the reviewed capability and none for the other; the other capability's state, clock, last demonstration and counts untouched; a normal run still crediting both; a failed review forcing NEEDS_REFRESH for one capability alone; a qualifying review clearing it for one alone; an assisted review not resetting the clock; and two devices keeping a scoped review and a normal run as separate facts. Ten of the twenty fail if either fix is reverted. |
| `packages/design-system/src/holo/HoloMaterial.test.ts` | 2 | The card flattens its transform style so `overflow: hidden` still clips, declares no `preserve-3d`, keeps its tilt, and gives every layer the card's radius (D-074). |
| `apps/web/src/exercise/exercise.test.tsx` | 31 | Data-driven resolution of four families through one route and a scan proving no exercise id appears in runner code; the unknown-id error state; brief content per family; FIX IT hiding the culprit; REBUILD BLIND with no hints or lesson; WHAT WOULD YOU BUILD naming no feature; the runtime refusal and `NotGradableError`; opening recording nothing; reload resuming; double finalize; real start and completion times; Try again as a second attempt; a persistence failure preserving the work; the hint ladder and its assistance; evidence-kind mapping; grading, evidence and mastery; divergence reporting; retrieval semantics; the result view and its reload; and routing from the Academy, the sheet and a retrieval deep link. |
| `apps/web/src/exercise/authoredGrading.test.ts` | 9 | The authored no-show recovery build graded against fixture runs: a full pass, the DND critical failure at 100%, the cancelled enrolment, a double text, a late text, the wrong trigger; the critical ids reaching the attempt and evidence; and the authored prose parsing. |
| `packages/content-schema/test/exerciseRuntime.test.ts` | 9 | A new BUILD IT file compiling into the bundle with assertions, tiers, grading and indexes; and the compiler rejecting seven classes of grading rule the runtime could not judge. |
| **Phase 9 total** | **123** | Whole suite: **453 tests in 47 files**. |

## Screen coverage (DES-018)

| Screen | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|
| Exercise runner | ✓ 1440 / 1024 | ✓ 768 | ✓ 390 / 320 | unknown id: "No exercise at this address."; no runtime: the dependency named, no submit | route chunk suspends behind the shell | screen boundary; a failed save shows `role="alert"` and keeps the work | ✓ probe | ✓ probe |
| Result view | ✓ | ✓ | ✓ | no critical section when there is none; empty tiers hidden | — | a missing grade falls back to the recorded attempt | ✓ | ✓ |

## Responsive review (1440 / 1024 / 768 / 390 / 320)

`PAGES=exercise,exercise-build,exercise-pressure,exercise-fixit npm run review:capture` — twenty page audits.

| Width | Composition |
|---|---|
| 1440 / 1024 | Brief in a sticky left column beside the work area, assistance and submit; the result replaces the work column. |
| 768 | One column: brief → work → assistance → submit → result, with the masthead on a 44 rem measure. |
| 390 / 320 | The same vertical flow; option rows and buttons 44 px, the response field 16 px, the expected/observed pairs stack at 320. |

No horizontal overflow, no off-viewport element, no input under 16 px and no text under 12 px at any width. One defect was found and fixed: the decision radios were 13 px, so the native input now covers the whole 44 px row and the ring is drawn in CSS.

## Keyboard, touch, reduced motion

**Keyboard** (`npm run review:keyboard` on the runner, Chrome, focus emulation): Skip to content → rail (Home, Campaign, Skill Map, and the flagged developer surfaces) → sync status → the capability link → the decision options as one tab stop with arrows moving inside → the response field → "Show the nudge" → "Run it" → the unit link. Every stop reports `:focus-visible` with a ring; buttons and the response field are 44 px or taller.

**Touch** (`npm run review:exercise`, 390 × 844, coarse pointer): option rows 350 × 44, response field 16 px, hint button 166 × 44, submit 350 × 44; tapping an option selects it, typing saves to the draft, the hint moves assistance to Light and is recorded, submitting produces the result with both checks held, the draft is cleared, a reload shows the same result and one attempt, and Try again returns an empty work area with a new attempt id while the earlier attempt stays. No horizontal overflow.

**Reduced motion**: the motion token reads `0s` and the option transition is effectively zero.

## Offline and sync

- Opening a runner offline works from the precache; the API is never served from cache.
- A deterministic submission finalizes offline: the attempt and evidence are written locally, six operations are queued, and the result survives an offline reload.
- Back online the API answers and the queue drains.
- Two devices: a device that finalizes offline syncs its attempt and evidence, the other receives both and evaluates the same skill state; two attempts made on two devices stay two attempts and two evidence sets.

## Requirement statuses

**PASSED**: EXR-001, EXR-002, EXR-003, EXR-022, MAS-004.
**PARTIAL**: EXR-004, EXR-005, EXR-006, EXR-007, EXR-019 (simulator core, Phase 10; Workflow Lab, Phase 12), EXR-008, EXR-009 (AI gateway, Phase 19), EXR-024 (product-wide, Phase 9 evidence added).
**BLOCKED**: none.
Phase 9 evidence added without changing status: PRD-003, DATA-001, PERF-001, RSP-002, RSP-003, DES-017, DES-018, A11Y-001 (still PARTIAL globally), MAS-007.
Decisions D-067 … D-073.

## Honest gaps

- Five of the seven families cannot be finished by a learner. Their briefs, work capture, hint ladders and grading contracts are real; their runtimes are not, and the runner says so.
- The two runnable families end `partial` because both name a rubric. No rubric result is fabricated.
- The authored per-dimension weights are not applied, and the runner does not pretend they are.
- Written work is read only through the authored marker vocabulary; the argument itself is not judged.
- Active attempts do not sync.
- The Markdown subset covers what the content uses; a heading or table in exercise instructions would render as plain text.
- Touch, offline and reduced motion were verified by Chrome emulation, not on a physical phone.
- `EX-EDGE_CASE-late-booking-reminder`'s critical check reads an event field named `after`, which the Phase 10 runtime will have to supply for that check to be judged; the content was left as authored.
- A retrieval through the runner can only end `partial` today, because both runnable families name a rubric, and a `partial` result is not a demonstration — so it cannot yet clear a NEEDS_REFRESH through the product. The scoping and the mastery consequences are proven with evidence written exactly as `finalizeAttempt` scopes it; a retrieval that can pass needs either a deterministic multi-skill exercise (content) or the rubric (Phase 19).
