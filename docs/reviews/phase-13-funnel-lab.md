# Phase 13 review — Funnel Lab

Date: 2026-09-08 · Branch: `claude/new-session-eq1u7a` · Base: `61b94c5` (Phase 12 on `main`)

What this phase had to be true for: FUN-001, FUN-002, FUN-003 and EXR-011. What it actually
does, what it refuses to do, and what is still missing.

## The shape of it

A funnel is part of the one simulated account, not a store beside it. `AccountState` gained
`funnels`, and a learner's funnel reaches the account the way a workflow definition does — as an
event the engine validates, logs, versions and can replay (D-118, D-119). Everything the Lab
needs from persistence, reset, replay and sync follows from that and cost nothing to build:
`sim_projects` already carries the account, so a reload comes back to the funnel, a reset takes it
away with everything else, and the CRM Lab and the Workflow Lab are looking at the same account.

The thinking is in `packages/simulator-core`. What is wrong with a funnel and where, what a
visitor meets in what order, where a completed step sends someone, and what a step actually offers
given the account behind it — all of it is pure functions there. `apps/web/src/funnel/` renders
what those produce and turns an intent into one event for the Phase 12 execution door. There is
no second engine path, no second account, no second persistence route and no simulation rule in a
component.

## FUN-001 — all eight capabilities

| Capability | What is real |
|---|---|
| Funnel steps | Added, renamed, given a purpose, reordered, removed. Removing a middle step joins the funnel back up rather than stranding what follows it. |
| Page structure blocks | Eleven roles, ordered within a step, added, configured, reordered and removed. |
| Forms | A form block connects to a real form from the account; the visitor fills that form's own fields. |
| Surveys | Same, on the account's surveys, through `SURVEY_SUBMITTED`. |
| Calendar | A calendar block connects to a real calendar; booking creates a real appointment. |
| Checkout concepts | A checkout block references a product the account holds, at that product's price, and completing it records one `PAYMENT_RECEIVED`. Everything beyond that is the Payments Lab, and the block says so (D-124). |
| Mobile / tablet / desktop preview | 1200 / 768 / 390, rendered by giving the page that width. It reflows; nothing is scaled. |
| Simulated visitor | Walks the learner's own architecture through the same renderer Preview uses. |

Two of these needed a decision rather than an implementation. **Checkout** could have been a
static label, which would have been a stub, or the Payments Lab three phases early. It is neither:
the account already models products and payments, so recording the one event it already
understands is real behaviour, and the boundary is stated in the interface and in the registry
record. **Calendar** is the same shape: enough for a funnel to book coherently, with the rule it
uses printed under the field, and everything else left to Phase 14.

The block vocabulary is Bloomlab's, and the Lab says so. Selecting a headline block shows
"HighLevel has no element with this name — you decide the section, this names its job"; selecting
a form block shows "A real HighLevel object. This block uses one from the training account." That
distinction is enforced by data (`BLOCK_ROLE_ORIGIN`), not by a habit of writing careful labels.

## FUN-002 — three modes that persist

The mode and the preview width are device preferences on the device record, like the run choice
(D-120). They survive a remount and a reload, and they do not travel to another device, because
which way this learner is looking at the account is not a fact about the funnel. The funnel and
the selection stay in the URL, so a link is a link.

## FUN-003 — the chain, proven rather than claimed

This is the P0, and it is the requirement easiest to fake, so the evidence is deliberately
awkward to fake: `chain.test.ts` and the probe both assert on **the run's own event log**.

```
FORM_SUBMITTED  (injected by the Lab, through execute())
  → intake reducer validates the form and every value against the account's form
  → CONTACT_CREATED  (generated, origin: generated, source.kind: reducer)
  → the ordinary processing path applies it
  → workflowReactions matches GHL-WF-FORM-SUBMITTED with its form filter
  → WORKFLOW_ENROLLED  (generated, source.kind: workflow_trigger)
  → the workflow's own nodes run: TAG_ADDED, SMS_SENT
```

Nothing in that chain is written by React. The tests assert the `origin` and `source` of the
generated events, so a hand-written contact would fail them, and no test anywhere injects
`WORKFLOW_ENROLLED`. The refusal paths are covered too: an unknown field, an unknown form, and a
submission that would create a nameless contact each refuse visibly and leave the run byte-for-byte
as it was.

**The bug this exposed.** For a contact the account already knew, the chain worked. For a brand-new
lead — which is the whole point of a capture funnel — nothing enrolled. `workflowReactions` asked
whether the contact existed, and at that moment the submission's own `CONTACT_CREATED` had been
queued but not processed. That is a Phase 12 behaviour and it is wrong against HighLevel, so it
was fixed rather than worked around (D-123): the matcher is told which contacts the event is about
to create, and the enrolment stays behind the creation on the same frontier, so the run never
walks a contact that is not there yet. Fixture `FORM-002` pins it by id. All 940 pre-existing
tests still pass, so the fix took nothing else with it.

## EXR-011 — more than one valid ordering

The requirement is a trap: it is easy to write an exercise that claims to accept several
architectures and in fact accepts one. So the grading vocabulary makes a positional rule
impossible to author. There are seven funnel requirements and none of them names an index; order
is only ever expressed as "this role before that role" (D-122).

One further rule is what actually makes several architectures pass. An order rule is about a
dependency, so it is judged only when the thing that depends on something is present: no `after`
means the rule does not apply and passes, an `after` with no `before` fails. Without that, "the
headline comes before the call to action" would fail a funnel whose ask is the form itself — a
sequence pinned by the back door.

`assembly.test.ts` grades two funnels against the same authored exercise:

- **A** — two steps. Capture (headline, problem, outcome, proof, benefits, form) then Booking
  (headline, calendar).
- **B** — three steps. Content that qualifies with the survey, then Capture ordered differently
  with objections and a call to action, then Booking with **proof on a different step**.

Both pass, with every check green. A third funnel that puts the form before the outcome and never
books fails on four checks. A fourth that is otherwise perfect but sells the membership fails on
the critical gate with all nine scored checks passing — the score cannot override it. The test
also asserts that the two orderings really are structurally different, and that the exercise
authors no positional assertion, so neither claim rests on reading the file.

## Verification

**Tests: 1036 passing in 75 files** (was 935 in 69 at the end of Phase 12; 940 after the count
assertions were updated for the new catalogue entries). 92 new:

| File | Tests | What it proves |
|---|---|---|
| `packages/simulator-core/test/funnel.test.ts` | 24 | Definitions as events, refusals, validation, reading order, progression, deterministic slots. |
| `apps/web/src/funnel/chain.test.ts` | 12 | FUN-003 end to end on the real scenario, both contact paths, every refusal. |
| `apps/web/src/funnel/assembly.test.ts` | 9 | EXR-011: two orderings pass, a wrong one fails, the critical gate holds. |
| `apps/web/src/funnel/edit.test.ts` | 21 | Every BUILD action, and the view preferences across a reload. |
| `apps/web/src/funnel/funnelScreen.test.tsx` | 16 | The Lab as a learner meets it, through the real `App`. |
| `apps/web/src/funnel/exerciseRuntime.test.ts` | 6 | One claimant per exercise; the context comes from the learner's run. |
| Regression fixtures | 4 | FORM-002 (the D-123 fix), FORM-003, FORM-004, FUNNEL-001. |

**Probe: `npm run review:funnel`, 16 sections, all PASS**, in headless Chromium against the
production build. It exercises behaviour rather than looking for selectors: it builds the funnel
through the Lab's own controls, tabs to the reorder button and presses Enter, reloads to check the
funnel came back, measures the three preview frames, submits the form as a visitor and reads the
resulting chain out of the page.

| Section | What it exercised |
|---|---|
| `route-opens` | The route, the account, three modes, no gamification, no eyebrow, no monospace. |
| `build-core-actions` | Two steps and four blocks added; all eleven roles offered; the form connected from the account's own list. |
| `keyboard-reorder` | Tab reaches Move down with a visible `:focus-visible` ring, Enter moves the block by one. No drag needed. |
| `validation` | The problem list clears once every reference is connected. |
| `persistence-reload` | Both steps, their names and the saved version come back after a reload. |
| `preview-device-switch` | 1200 > 768 > 390, the built funnel rendered with the form's own fields, real reflow. |
| `mode-persists` | The mode and the width survive a reload. |
| `simulate-form-chain` | `form.submitted` → `contact.created` (marked caused) → `workflow.enrolled` → New Lead Welcome → `sms.sent`, then the visitor moves to step 2. |
| `simulate-booking` | Slots offered, a real appointment booked, the funnel finished. |
| `refusal-is-visible` | A nameless submission is refused, says why, and claims no success. |
| `width-1440` / `1024` / `768` | Steps, blocks and the inspector as columns; no page overflow. |
| `width-390` / `320` | Steps and inspector as labelled sheets on tap, 44 px targets, every mode still operable, no page overflow. |
| `reduced-motion` | Nothing animating, no transition over 250 ms. |

**Other probes re-run:** `review:rail` PASS, `review:crm-review` PASS, `review:workflow` — one
section fails, see below.

**Typecheck, lint, format, content check and production build:** all clean. `/funnel` is its own
lazy chunk (38 kB, 11 kB gzipped), so PERF-001 holds.

## What did not pass

**`review:workflow` → `five-hundred-events` → `noFrameOver100ms`.** The 500-event responsiveness
run reports one frame over 100 ms (103–171 ms across runs) against a 100 ms threshold. Mean 17.8
ms and p95 46 ms are both comfortable, and the engine's own compute was 76 ms for all 504 events
in the worker.

This is not a Phase 13 regression, and that was checked rather than assumed: `main` at `61b94c5`
was built in a separate worktree and probed three times in the same container, producing max
frames of 104, 163 and 131 ms — indistinguishable from this branch's 103, 123, 108 and 171. The
threshold is being missed by the build environment, which is a shared, throttled container, not by
the code. On the reference desktop the acceptance names, this needs re-checking before PERF-002 is
claimed for this scenario.

## What needs the user's eyes

- The BUILD composition at 1440 on a real Mac. The first pass read as a card grid, which the
  design bible rejects, so the rows became hairline-separated with a left accent on the selected
  one and quieter row actions, and a live rendering of the step being built was put under the
  editor. Screenshots are in `.review/funnel-*.png`; whether it now reads as "quiet interface,
  magical object" is a judgment a screenshot cannot settle.
- The three panels side by side. That is the Lab language Phase 12 established, but the Funnel Lab
  has no canvas to anchor it, and a composition built around the page itself may be better. Worth
  a look before Phase 14 copies the pattern again.
- The phone composition at 390 and 320. The probe proves everything is reachable and 44 px; it
  cannot say whether the drill-down feels right in the hand.

## Not built, on purpose

Funnel Autopsy (FUN-004) is Phase 15 and nothing here approaches it — no traffic source, no
conversion rate, no scroll behaviour, no drop-off, and no number anywhere that could be mistaken
for one. Calendar configuration is Phase 14. Payments beyond a single recorded payment are Phase
18. Every one of those boundaries is stated in `KNOWN_LIMITATIONS.md` and, where a learner would
otherwise wonder, in the interface itself.

## Registry verification

`GHL-FUNNEL-FUNNELS`, `GHL-FORM-SURVEYS` and `GHL-PAY-PRODUCTS` were checked on 2026-09-04 against
search-result summaries of the official help-centre articles. The build environment's egress proxy
rejects `help.gohighlevel.com` with a 403 at the CONNECT, so the articles could not be opened
directly. Each record's `verification_note` says exactly that. This is the third phase running
under that constraint and it should be lifted before a phase depends on reading a page in full.

## Post-completion audit correction — D-125

A review after the first green PR head found two cases the original Phase 13 tests did not pin.

First, FUNNEL ASSEMBLY architecture was flattened across every learner funnel in the current account.
That could let one incomplete funnel supply the capture/form checks while another supplied the
booking/calendar checks. The grader now evaluates each funnel independently and keeps the strongest
complete report, so several saved drafts may coexist but two partial funnels can never become one
imaginary answer. Required FUNNEL ASSEMBLY constraints are also gates: a polished capture page that
omits the required booking step fails even when its weighted score would otherwise clear 70%.

Second, the SIMULATE activity panel used event-log length as a sequence watermark. Execution records
also consume simulator sequence numbers, so after several definition saves an older funnel event
could appear under a newly started visitor. The session boundary now uses the last actual event
sequence. Regression coverage pins both corrections.

Grader version after this correction: `2026.09.08-r2`.
Final expected suite on this PR head: 1036 tests in 75 files, subject to exact-head CI.
