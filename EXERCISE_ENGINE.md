# EXERCISE ENGINE

Derived from `BLOOMLAB_MASTER_SPEC.md` §27–§35, §39–§40, §110–§111, §119–§122 and TA§31–§34, §40, §50–§51, §68–§70. Requirement IDs: EXR-*, MAS-*, NEG-*, PRI-*, CALL-003, SAL-001, PORT-*.

## 1. Data-driven exercises (EXR-001)

```text
exercise_id, type, title, skills, scenario, instructions, allowed_features,
starting_state, expected_outcomes, critical_failures, grading, hints, fieldwork, portfolio
```

A new exercise usually requires adding content, not a new React page. `packages/exercise-engine` runs any exercise from its definition against `simulator-core` and the content bundle.

## 2. Exercise families (EXR-004 … EXR-021)

| Family | Input | Learner does | Grading |
|---|---|---|---|
| BUILD IT | objective ("Build a no-show recovery workflow.") | constructs the solution with real GHL concepts | deterministic where possible |
| FIX IT | broken system; symptoms only ("Maria received two reminder messages. Expected one.") | diagnoses and repairs; faulty node not revealed immediately | deterministic |
| RUN THE LEAD | contact + workflow | predicts execution, then watches actual execution animate | deterministic |
| EDGE CASE | one important variable changed (late booking, cancelled, missing phone, different timezone, second location, duplicate entry) | judges whether the system still works | deterministic |
| WHAT WOULD YOU BUILD? | business problem without naming the feature under test | designs the system; multiple valid architectures | rules + AI only when open-ended reasoning requires |
| ARCHITECTURE DECISION | tag vs custom field vs custom value vs opportunity field vs custom object | decides; multiple-choice removed at later levels | deterministic / rubric |
| FUNNEL AUTOPSY | simulated page + data (traffic source, conversion rate, scroll behavior, form completion, booking rate, drop-off) | distinguishes problem from hypothesis | rubric |
| FUNNEL ASSEMBLY | blocks or blank architecture | creates page/funnel information structure; no forced universal order | rules |
| PROSPECT IT | multiple fake businesses | decides Contact / Maybe / Skip with reasoning | rules + rubric |
| AUDIT IT | prospect evidence | forces findings into Verified / Likely / Unknown | rules (unsupported claims penalised) |
| WRITE IT | cold email, follow-up, interested reply, discovery recap, proposal explanation, client update, scope response, payment reminder, upsell, breakup email | writes | AI rubric where needed |
| SAY IT | cold call, discovery, proposal presentation, negotiation, client explanation | speaks (Call Room) | call grading (§4.6) |
| PRICE IT | project scope | chooses project price, deposit, recurring, rush fee, timeline, revisions, inclusions, exclusions | pricing engine; hidden economics and risk revealed after submission |
| NEGOTIATE IT | client push-back | clarify · hold price · reduce scope · phase · concession · walk away | scenario engine; winning is not the only success |
| EXPLAIN IT | system | explains for a business owner and for another GHL builder | rubric |
| REBUILD BLIND | no lesson, no step-by-step support | rebuilds; hints reduce independence evidence | deterministic |
| FIELDWORK | real GHL task | performs real work; submits screenshots, configuration answers, explanation, test results | reasoning questions + deterministic checks on answers |
| BOSS CLIENT | persistent multi-stage engagement: audit → discovery → architecture → pricing → negotiation → proposal → implementation → QA → launch → reporting → change request | earlier decisions affect later consequences | mixed |

No family may be replaced by a static approximation (EXR-024): interactive simulation is not a diagram; negotiation is not an article; Funnel Autopsy is not a quiz.

## 3. Hints and assistance (EXR-022, MAS-007, MAS-011)

Hint levels: **Nudge** (small directional clue) · **Concept Reminder** (principle) · **Worked Example** (high assistance). Assistance is tracked per attempt and rolled up quietly as Independent · Light Assistance · Guided · Heavy Assistance. The learner is never shamed. A heavily assisted pass is not independent mastery evidence.

## 4. Grading

### 4.1 Deterministic assertions (EXR-002)

| Type | Example |
|---|---|
| State | `contact.tags contains "Qualified"` |
| Event | exactly one SMS sent |
| Timing | reminder occurred 24 h before appointment |
| Architecture | required trigger exists |
| Negative | cancelled contact received no reminder |
| Sequence | opportunity created before assignment notification |

### 4.2 Rubric tiers (EXR-003)

**critical** (e.g. cancelled appointment must not receive reminder) · **required** (confirmation sent; 24-hour reminder sent; opportunity created) · **quality** (naming, modularity, no duplicate actions) · **bonus** (graceful handling of missing phone number).

### 4.3 Critical failure system (MAS-004, EXR-023)

A high numeric score cannot override a dangerous failure. Example workflow weighting: correctness 45% · edge cases 20% · architecture 15% · maintainability 10% · explanation 10% — but "canceled appointments receive reminders" still fails the attempt.

### 4.4 AI boundary (AI-006, AI-007)

AI grades only where several defensible answers exist. It never overrides deterministic failure: expected SMS 1, actual SMS 2 → failed, regardless of what Claude says. AI results are schema-driven — `score, rubric_results[], critical_issue, strengths[], improvements[], next_probe, confidence` — validated before acceptance; one repair retry; then the learner's work is saved and evaluation failure reported.

### 4.5 Pricing engine (PRI-002, PRI-003)

No single universally correct price. Scenario stores baseline complexity · estimated labor · risk · migration · locations · integrations · custom development · rush · recurring support. Evaluation covers price · margin · scope · risk · reasoning.

### 4.6 Call grading (CALL-003)

Questions · listening · diagnosis · clarity · jargon · pitch timing · objection handling · next step. Accent is not graded. Excessive talking and premature pitching are penalised (SAL-005).

### 4.7 Audit classification (SAL-001)

Every finding is VERIFIED (directly observed) / LIKELY (evidence suggests) / UNKNOWN (needs confirmation). Unsupported claims are penalised.

## 5. Mastery (MAS-001 … MAS-011)

States: **UNSEEN · LEARNING · GUIDED · PRACTICED · INDEPENDENT · PRESSURE_TESTED · MASTERED · NEEDS_REFRESH**. Quizzes alone never award mastery.

Evidence record: skill · exercise · result · score · assistance · difficulty · critical failures · date · simulator version · content version · real-GHL evidence where required.

`packages/mastery-engine` (no AI) — inputs: skill definition, evidence history, assistance, difficulty, recency, critical failures, fieldwork requirement. Outputs: `state`, `confidence`, `missing_requirements` (e.g. `pressure_test`, `real_ghl_fieldwork`), `review_priority`.

Field Ready pass requires sufficient evidence across funnel strategy, GHL implementation, automation, CRM architecture, troubleshooting, sales, pricing, negotiation, fieldwork, client explanation — never one overall percentage.

**Implementation (Phase 6, `packages/mastery-engine`, rules `2026.09.02-r1`):** the ladder is earned from evidence kinds and assistance — LEARNING on any evidence; GUIDED on a pass with any help; PRACTICED on a pass of an independent-capable kind with at most light help; INDEPENDENT on an unassisted pass; PRESSURE_TESTED on an unassisted pressure pass; MASTERED on the skill's declared count of unassisted passes (never fewer than two, over two distinct demonstrations) plus its declared pressure / fieldwork / sales-use requirements. Exposure and quizzes never leave LEARNING. A pass with a critical failure is not a pass. NEEDS_REFRESH overlays the earned state (`refresh_from`) when review is overdue by more than 14 days or the latest attempt is a failed retrieval. Assistance: worked example → heavy; concept reminder or three nudges → guided; one or two nudges → light; none → independent (D-044 … D-046).

## 6. Review and sessions (MAS-005, MAS-006, MAS-009)

Review scheduler is evidence-based — per skill: `last_demonstrated`, `failure_rate`, `mastery_level`, `importance`, `review_due`. Not an Anki clone. Old skills reappear as short retrieval challenges injected into later sessions; review-due never blocks forward progress; a failed retrieval re-queues the skill.

Session Builder (deterministic, no AI): options 30 min · 1 hour · 2 hours · Deep Session. Inputs: available time, active campaign, current gate, weak skills, review due, recent failures, active boss client / project, fieldwork, assistance dependence. The learner can always **Continue** after the generated session ends. No calendar lock.

**Implementation (Phase 6):** review interval by earned state 10 / 21 / 35 / 60 days (PRACTICED … MASTERED), divided by importance (1 + 0.5 pressure + 0.5 fieldwork + 0.25 sales use) and shortened by half the recent failure rate, never below 3 days; priority = importance × (1 + overdue days / 7) + 2 × failure rate + 3 if NEEDS_REFRESH. Session builder order: due retrieval (≤ 20 % of the budget, 5 min each) → repair (weak prerequisites of the next work, recent failures, assisted passes when assistance dependence ≥ 0.5; ≤ 25 %) → learner focus → current gate's required skills, then work-ahead skills → pending fieldwork and the active project; every item carries its reason; Continue rebuilds without finished items (D-048).

## 7. Scenario engine and hidden state (NEG-001 … NEG-005)

```text
current state + learner action + rules → updated scenario
```

Authored branching where practical; AI only when free-form language needs interpretation. Hidden client state (trust, urgency, price sensitivity, frustration, technical sophistication, actual budget, stated budget, decision authority, fear, previous bad experience, alternative provider strength) is modified by dialogue actions — strong diagnosis trust +10; premature pitch trust −8; ignoring objection frustration +15 — and never shown to the learner.

Negotiation responses are first classified into strategies (discount · hold · clarify · reduce_scope · phase · walk_away · defensive) with pre-authored client reactions covering common paths. A lost deal can receive a high score.

Written sales simulation (CONV-002) is a persistent inbox where client messages react to the learner's answer and the conversation continues naturally instead of always showing "Correct."

## 8. Portfolio (PORT-001, PORT-002)

Major projects become portfolio items storing brief · business problem · architecture · funnel · workflows · screenshots · learner reasoning · skills demonstrated · assistance level · real-GHL evidence where applicable. Fictional work is labelled **Simulation Project** or **Demonstration Build**. Client outcomes are never fabricated.

## 9. Rubric versioning (AI-011)

Every rubric has a version (`SALES_DISCOVERY_RUBRIC_V3`). Changing a rubric creates a new version; old attempts remain associated with the original.
