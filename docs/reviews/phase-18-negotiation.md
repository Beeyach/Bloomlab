# Phase 18 — Negotiation

Base verified on 2026-09-07: `c6897e3e5a6640e9d70f392a05636e8279f3464b`.
Fetched `origin`; current `main` matched the handoff. The latest completed push CI was
`34051734165`, conclusion `success`. Branch: `codex/phase-18-negotiation`.

## What the learner can do

The existing Summit NEGOTIATE IT seed is now a conversation with a standalone starting agreement:
$2,400 project fee, 50% deposit, $150 separate monthly support, 21 days, zero revision rounds,
seven named scope lines and explicit exclusions. It reads no previous PRICE IT attempt.

Six actions execute: **clarify, hold price, reduce scope, phase, concession, walk away**.
The learner writes a reply, chooses a move, configures the applicable terms, sends it, reads an
authored client reaction and continues to a decision. The agreement changes alongside the thread.
Reload restores the draft, action, terms, node, hidden state, history and deal. The completed
transcript lives with the saved result. Try again creates an independent starting relationship.

The seven classifier strategies are **discount, hold, clarify, reduce_scope, phase, walk_away,
defensive**. A concession is classified from its actual kind: an extra revision, deposit change or
later balance is not a fee discount. Defensive response framing has its own authored branch.

Every node has seven authored strategy reactions and a fallback. The ten reachable objections are:

| Objection | Executable situation |
|---|---|
| Competitor price | Compare the booking connection against qualification and follow-up. |
| Budget | Separate the total commitment from cash available at the start. |
| Discount request | Same scope for a smaller first-project fee. |
| Scope reduction | Marcus offers to move questions and maintain the system himself. |
| Phased project | Applications and booking first; migration, recovery and handover second. |
| Payment terms | Balance thirty days after delivery. |
| Deposit | Prior delivery trouble makes upfront payment uncomfortable. |
| Concessions | Another revision round, and what is offered in return. |
| Silence | A week without a reply; no agreement inferred from silence. |
| Walking away | Full original scope demanded for the competitor's fee. |

## One transition and one projection

`apps/web/src/exercise/negotiation/engine.ts` is the pure transition layer:

`NegotiationState + NegotiationAction + NegotiationConfig + scenario economics → NegotiationState`

The state owns hidden client values, current node, status, current deal, draft and turn history.
Each turn retains the action and exact message, classifier strategy/confidence/source, authored
reply, diagnosis/ignored-objection signals, fallback flag and the economic offer if one was made.
The transition has no clock, randomness, network, React or persistence dependency. Content lookup
is isolated in `context.ts`; persistence stays in the existing attempt service.

`negotiationProjection` is the authoritative `negotiation.*` grading contract. The UI reads its
completion/status contract and the grader reads the same projection through `learnerState`.
No fake `ExerciseRuntime` is registered. The old seed's nonexistent paths are replaced by real
metrics, including `discount_below_cost`. Unknown or hidden negotiation paths fail content validation.

Offers are retained. Grading evaluates every offered commitment, so a later walk-away cannot
launder an earlier below-cost promise. Required negotiation constraints are gates, as PRICE IT
constraints became in Phase 17. Critical cost failures still override every numeric score.

## Hidden state is behavior

Initial state is the client's eleven-field `hidden_state` merged with typed scenario overrides.
`HiddenStateSchema.partial()` rejects unknown keys, invalid percentages, negative budgets and
numeric decision authority. Authored deltas accept only named percentage fields and bounded
changes; transitions clamp those values to 0–100. Budgets remain amounts and authority remains
`sole`, `shared` or `none`.

Tests and the real-app probe pin the three required examples against Summit's starting state:

- Supported structured diagnosis: trust 55 → 65, exactly **+10**.
- A pitch before diagnosis: trust 55 → 47, exactly **−8**.
- Moving past the objection: frustration 30 → 45, exactly **+15**.

Diagnosis here means selecting the supported distinction behind the current objection. It does
not claim to understand or judge the accompanying prose. The unsupported assumption earns no
trust increase. Later prose evaluation remains pending.

Trust changes the next budget reaction and whether the client considers the actual spending
ceiling beyond the stated opening anchor. Price sensitivity also affects that decision.
Frustration changes a later objection reply and can end the negotiation. Technical sophistication,
provider strength, urgency, fear and previous bad experience select authored reactions. Actual and
stated budgets independently affect acceptance. Shared authority produces `approval_needed`, never
an accepted deal on someone else's behalf. Tests vary each field and exercise these differences.

The component renders only authored dialogue, learner messages and the agreement's own terms.
There are no trust meters, hidden numeric markup, budget gauges, debug attributes or hidden-state
values in tooltips or aria labels. The renderer test seeds distinct numeric canaries in every
numeric field and scans complete HTML before and after completion. The browser probe checks the
real DOM at all five widths and after completed-attempt reload. Hidden state remains simulation
internals in local data/bundled content, not a security secret protected from developer tools.

## Economics reuse Phase 17

`evaluateNegotiatedDeal` calls the existing `pricing/evaluate.ts`, which uses `dealBasis`,
`quoteOf`, exact margin policy and scenario risk. There is no second hourly-cost or margin engine.
The pricing evaluator's argument type was narrowed to the `pricing` property it actually needs;
its calculations were not changed. Negotiation scope hours are checked against the scenario's
estimated hours at content build time.

- **Scope reduction** removes named deliverables and their hours, records their consequences as
  exclusions, and checks dependencies. Removing migration and handover leaves 17 hours: cost $935;
  $1,600 meets the same 40% policy that governs the full deal. Removing the calendar while keeping
  dependent recovery fails structurally, regardless of price.
- **Phasing** assigns actual scope to Phase 1 and Phase 2, two separately priced deliveries and a
  second delivery duration after first-stage acceptance. The authored plan divides 15 and 7 hours.
  $1,650 / $750 is defensible. A lucrative first stage cannot hide a below-cost second stage.
- **Concessions** create extra revision work, later collection of the balance, a smaller deposit
  or a lower fee. Trades change concrete deposit or timeline obligations. A revision raises cost
  from $1,210 to $1,320. Thirty-day payment terms carry explicit financing exposure and require a
  deposit that covers first-stage delivery cost for economic soundness. A gift without a trade
  fails the required trade check. Later concessions cannot undo an earlier reciprocal commitment.

A diagnosed professional walk-away scores **100**, with `rubric_pending`, despite losing the deal.
A client can accept a $900 offer for all seven scope lines; the learner still fails critically
because the retained work costs $1,210. Neither value is a hardcoded grading target: scope, rates,
revisions, risk and stage structure determine the boundaries.

## Interpretation and grading boundary

Confidence is explicit internally. A selected structured move has confidence 1 and source
`explicit_move`. Unselected/free-form language has confidence 0, no strategy and source
`needs_interpretation`; it follows the authored fallback without changing the deal or hidden state.
Incomplete terms also take the fallback. Fallback loops end after the authored turn limit.

This is a deterministic action protocol, not a keyword language model. No AI is called, and no
optional interpreter exists yet. **NEG-003 remains PARTIAL** for actual language interpretation.
The mixed exercise keeps `PRICING_REASONING_RUBRIC_V1` unchanged and returns `rubric_pending` after
successful deterministic checks. Written quality is not scored from length, keywords or strategy
recognition. A recorded 100 does not award a fabricated full pass or independent mastery.

## Persistence and review findings

Negotiation draft edits and turn submission share Phase 16's per-attempt queue. Sending reads the
latest persisted draft inside the queue; finalization waits for that same queue and reloads the
attempt. Opening now writes the actual initial negotiation state. Old attempts lacking the new
property still resolve to the authored starting state. Finalization of an open conversation is
refused without deleting the attempt.

Regressions cover latest text and latest selected action followed immediately by Send and Run it,
midway reload with an unfinished message and selected action, completed reload, fresh retry, and
old saves without negotiation fields. A failed draft write cannot be swallowed before sending a
stale turn: turn submission preserves the preceding queue rejection until a real edit retry.

Bugs caught during implementation/review and pinned by regression coverage:

1. The seed asserted negotiation state that did not exist: replaced with the real projection and
   schema checks on its vocabulary.
2. Later deposit concessions could cancel a prior upfront-payment trade: every retained reciprocal
   commitment is now checked against the current offer, as well as its prior history.
3. A send queued after a failed draft write could recover the queue and send stale work: turn
   submission preserves that failure; a retried edit can recover normally.
4. Required constraints could be outweighed by quality rows: NEGOTIATE IT explicitly joins the
   existing hard-gate families; a score above 70 with a free concession still fails.
5. The runner's desktop sticky brief overlapped the newly widened conversation on scroll: its
   negotiation layout now uses a non-sticky brief. The browser probe checks rectangle overlap at
   every width. Scope disclosure keeps the phone conversation within reach.
6. A reduced-scope move could restore old exclusions or offer the same work for less under the
   wrong strategy: it now requires a strict additional removal and retains existing exclusions in
   the next draft. Discounting unchanged scope belongs to concession/discount instead.
7. Reusing an already-granted deadline could masquerade as a new reciprocal trade: concessions
   now record whether the trade actually improved the existing term.
8. Running out of fallback turns could satisfy completion without making a decision: lifecycle
   completion and the graded decision are separate. Exhausted ambiguity fails the required gate.

A learner can configure Phase 1's delivery duration. A client accepting an impossible one-day
launch still produces required_failure; an accepted deal does not waive timeline obligations.

## Verification

- Full suite: **1,570 passing tests across 93 files** on the repository's Node 22 runtime.
- Typecheck, format, docs validation, content validation and production build: pass. Lint: zero errors; the existing runner effect dependency warning remains.
- Content build/lock: strict validation passed; the existing 31 curriculum warnings remain.
- `review:negotiation`: **PASS, 39 sections**, against the final built app in real Chromium, all actions/strategies/objections, economics, hidden deltas,
  reloads, immediate submit, keyboard, touch and reduced motion; all five widths without horizontal
  overflow. Artifacts: `.review/negotiation-probe.json` and `negotiation-*.png`.
- `review:pricing`: PASS, 17 sections. `review:sales`: PASS, 24 sections.
- `review:exercise`: PASS against the built app, including offline submission and reload.
- `review:academy`, `review:keyboard`, `review:touch`: completed; measured behavior reviewed.
- Final remote CI identifiers are recorded in the PR handoff after the checks finish.

The host initially used Node 26, whose experimental localStorage behavior failed the existing
`db.test.ts`. The unchanged full suite passes under Node 22.22.0, matching `.nvmrc` and CI.
The offline exercise probe must use the built app's service worker, not the Vite development server.
The existing learning-probe second-device sync limitation remains documented and was not weakened.

## Scope and versions

| Requirement | Status |
|---|---|
| EXR-017 | PASSED |
| NEG-001 | PASSED |
| NEG-002 | PASSED |
| NEG-003 | PARTIAL — real free-form interpretation awaits Phase 19 |
| NEG-004 | PASSED |
| NEG-005 | PASSED |

Content version: `2026.09.15` → `2026.09.16`, lock regenerated with the repository command.
Exercise grader: `2026.09.15` → `2026.09.16`. Simulator `2026.09.11-r2` and mastery
`2026.09.03-r4` are unchanged. The pricing rubric is unchanged.

One authored client and ten situations demonstrate the engine, not broad negotiation-language
coverage. Phase 1/2 choices come from authored dependency-valid plans; later stage restructuring
is not an unrestricted project planner. Review on physical devices and independent review remain
human gates. No Phase 19 AI Gateway/router/governor/grading, Phase 20 voice assets, Phase 21 Call
Room/STT/TTS, or Phase 24 Boss Client continuity was started. This PR must not be merged by this task.
