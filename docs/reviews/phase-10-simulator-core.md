# Phase 10 review — Simulator Core

What was built, what it does, what it deliberately does not do, and what remains. Written against
the code as merged, not against the plan.

---

## 1. Package architecture

`packages/simulator-core` is the authoritative engine. Pure TypeScript, importing nothing outside
its own modules — proved by a source-level test (`test/purity.test.ts`) that strips comments and
then scans every file for React, the DOM, IndexedDB or Dexie, Cloudflare or the network, Claude,
`Math.random()`, `Date.now()` / argless `new Date()`, and `Intl…resolvedOptions()`.

| Module | Owns |
|---|---|
| `version.ts` | `SIMULATOR_VERSION` |
| `errors.ts` | `SimulatorError` and the thirteen refusal codes |
| `time.ts` | simulator instants, zone arithmetic, calendar days |
| `random.ts` | the seeded generator and its resumable position |
| `events.ts` | the catalogue, the envelope, name translation, envelope validation |
| `state.ts` | the account and the run |
| `execution.ts` | the execution-record model |
| `scheduler.ts` | the queue and its ordering rule |
| `reducers/` | per-domain transitions (contacts, appointments, opportunities, conversations, payments, intake, workflows) |
| `apply.ts` | the one dispatch from event type to reducer |
| `run.ts` | processing, cascade safety, the clock, the Time Machine, the injector |
| `scenario.ts` | scenario input, validation, compilation to an initial state |
| `snapshot.ts` | checkpoints and their policy |
| `replay.ts` | replay and rewind |
| `reset.ts` | reset |
| `hash.ts` | canonical comparison |
| `workflow.ts` | behaviour separated from layout |

Outside the package, in the app: `apps/web/src/simulator/grading.ts` (the grader adapter),
`apps/web/src/simulator/store.ts` (persistence), `apps/web/src/screens/SimulatorHarness.tsx`
(the internal harness).

## 2. State schema

One `AccountState` with twenty-one id-addressed collections: `account`, `users`, `contacts`,
`companies`, `tags`, `custom_fields`, `custom_values`, `pipelines`, `opportunities`, `calendars`,
`appointments`, `forms`, `surveys`, `products`, `payments`, `conversations`, `workflows`,
`workflow_runs`, `tasks`, `notes`, `analytics`. The run adds the twenty-second domain §43 names —
the event log — plus the scheduled queue, the execution records, the clock, the generator state,
the sequence counters and the diagnostics.

Everything is plain data: no class instances, nothing non-serializable, so the whole state
survives `structuredClone` and could move into a Worker unchanged (SIM-014, Phase 12).

References are explicit and checked. An event naming a contact, calendar, pipeline, workflow or
node that does not exist is refused with `UNKNOWN_ENTITY` — the engine does not invent an entity
to make an event succeed. The one exception is a form or survey submission, which creates or
updates the contact it names, because that is what the event means in GoHighLevel; it does so by
generating a real `CONTACT_CREATED` / `CONTACT_UPDATED` event that travels the ordinary path.

## 3. Transition contract

```
State + Event + Configuration → Transition → New State + Generated Events + Execution Records
```

`applyEvent(account, event, state)` returns `{ account, records, generated }` and never mutates
its input. Generated events are *returned*, not applied: `processEvent` pushes them onto the same
frontier as the event that caused them and processes them breadth-first, so a consequence is
logged, ordered, recorded and replayed exactly like anything else. There is no hidden mutation
route.

Immutability is proved three ways: the state hash is unchanged after a transition, a
`structuredClone` taken before still deep-equals the original after, and a tag added to a contact
appears on the new state's contact and not on the old one's.

## 4. Event catalogue

All 26 types from §44, unchanged in name. A test asserts the reducer map covers the catalogue
exactly, so a new type cannot be added without a transition.

Content and the grader address the same events in the dotted lower-case form
(`appointment.status_changed`), which is one deterministic transformation from the catalogue name
— lower-case, first underscore to a dot — round-tripped over the whole catalogue in a test
(D-076). No lookup table to drift.

What each transition does today:

| Event | Effect |
|---|---|
| `CONTACT_CREATED` / `CONTACT_UPDATED` | the contact exists / the named fields change; a custom field the account never defined is refused |
| `TAG_ADDED` / `TAG_REMOVED` | the association exists / is gone; a duplicate add and a removal of an absent tag are recorded as skipped, not failed |
| `FORM_SUBMITTED` / `SURVEY_SUBMITTED` | recorded, counted, and generates the contact create or update it implies; a field the form does not have is refused |
| `APPOINTMENT_BOOKED` / `RESCHEDULED` / `CANCELLED` / `STATUS_CHANGED` | the appointment appears / moves / is cancelled / changes status; rescheduling a cancelled appointment is refused; a cancellation counts once |
| `SMS_SENT` / `EMAIL_SENT` | the message lands in the contact's conversation — unless the contact has no phone or email, or is on do-not-disturb, in which case it is a recorded skipped action with the reason |
| `SMS_RECEIVED` | the inbound message lands in the same conversation, in order |
| `EMAIL_OPENED` | stamps the open on the message it belongs to; a second open is skipped; an open of an email never sent is refused |
| `OPPORTUNITY_CREATED` / `UPDATED` / `PIPELINE_STAGE_CHANGED` | the opportunity appears / changes / moves; a stage the pipeline does not have is refused |
| `PAYMENT_RECEIVED` / `FAILED` / `REFUND_ISSUED` | payment state and revenue move; refunding a payment that never succeeded is refused |
| `TIME_ADVANCED` | records the clock's move |
| `WORKFLOW_ENROLLED` / `STEP_COMPLETED` / `EXITED` | the run entity is created / advances / ends; a second active enrolment with re-entry off is refused with `duplicate_enrolment` |
| `WEBHOOK_RECEIVED` / `RESPONSE` | recorded with the payload; a 4xx or 5xx is a failure record |

## 5. Generated-event behaviour

A reducer returns pending events; the runner mints their identity and order and processes them
through `processEvent`. They carry `origin: 'generated'` and a `source.caused_by` pointing at the
event that produced them, which is what lets replay leave them out and regenerate them (§9).

## 6. Clock

Per scenario: `simulation_time` and `timezone`, both authored. Instants are ISO strings carrying
their offset. A minute and an hour are absolute durations; **a day is a calendar day in the
scenario's zone**, so 09:00 on 31 October 2026 becomes 09:00 on 1 November across the US
daylight-saving change — which is how a business experiences "tomorrow" and how GoHighLevel's
day-based waits behave.

Nothing reads the machine. The same scenario run with `timezone: Asia/Tokyo` keeps the same
instant and renders it as `2026-09-03T23:00:00+09:00`. An unknown zone is refused rather than
falling back to the device.

## 7. Scheduler ordering

1. scheduled timestamp
2. insertion sequence — so a consequence follows its cause at the same instant
3. stable scheduled id

`compareScheduled` is the single implementation (D-077). The queue's insertion counter is separate
from the event sequence, so queuing something never shifts the identity of the events around it —
which is what makes replay reproduce ids exactly.

Tested: empty queue, one event, several times, several events at one instant, an event that
schedules another, events before / exactly on / after the target, Next Event, and Next Event with
nothing queued.

## 8. Time Machine

+1 minute, +1 hour, +1 day and Next Event. An advance moves to the target, running everything due
on the way in queue order, including what those events generate, and finishes exactly at the
target. Next Event moves to the earliest queued entry and runs it with its same-instant
consequences, leaving other entries at that timestamp queued so a run can be stepped one cause at
a time. With nothing queued, Next Event does nothing at all.

The clock never runs backwards: `advanceTo` a past instant is refused.

## 9. Event Injector

The scenario decides. `allowedActions(scenario)` resolves the authored list; `injectAction`
refuses an action the scenario does not offer (naming what it does offer), validates the payload,
and refuses a malformed override rather than coercing it. An action authored relative to "now"
(`minutes_from_now`) resolves against the **simulator** clock.

All seven §47 action kinds — contact reply, tag added, appointment cancellation, appointment
reschedule, payment, form submission, opportunity movement — are proved injectable in
`test/coverage.test.ts`.

## 10. Execution log

`ExecutionRecord`: stable id (`xr-<run>-<sequence>`), run, simulator time, the sequence it shares
with the event log so a timeline can merge the two, a `kind` from nine categories, workflow / run
/ node / contact / event references, structured `data`, and a machine `reason` token. No display
strings: the harness turns `missing_phone` into words, and a later wording change cannot rewrite
history.

Produced today: `trigger`, `input`, `step_completed`, `action_skipped`, `failure`, `exit`.
Defined but not yet produced: `step_started`, `branch_result`, `waiting` — all three need a
workflow to execute. This is why SIM-010 is PARTIAL.

## 11. Seeded randomness

mulberry32: one 32-bit word, exact integer arithmetic, identical on every engine. Draws are pure —
`nextRandom(state)` returns the value and the next state. The live word and the draw count travel
in the run and are persisted, so a snapshot resumes the sequence rather than restarting it, proved
against an uninterrupted sequence of the same length (D-081).

No scenario currently needs a draw, so a Phase 10 run ends with `draws: 0`. The mechanism is
tested directly rather than incidentally.

## 12. Snapshot policy

Authored scenario + append-only event log + a checkpoint every **25** processed events, plus any
the caller takes deliberately (D-080). A checkpoint carries the whole state and a hash of it;
`assertCheckpoint` refuses one from another run, one that disagrees with its own log length, and
one whose state has been tampered with. Tested that fewer than 25 events produce no checkpoint at
all.

## 13. Replay

Given the scenario and the event log, replay rebuilds the run — re-running **only root events**
(scenario, injected, clock) and letting the reducers regenerate every consequence. That is what
guarantees no duplicate ids: identity is `ev-<run>-<sequence>` and the sequence is rebuilt from
zero. Replay always builds a fresh state, so it can never append to the run it is reproducing.

Supports replay to the end, to an index, and from the nearest checkpoint — all three proved to
agree. A replay that cannot reproduce an event raises `REPLAY_FAILED` rather than inventing a
different run.

`rewind(scenario, state, n)` is replay to `log.length − n`; stepping back past the beginning lands
on the authored initial state.

The scheduled queue is deliberately **not** reconstructed from the log: it is forward-looking
state, not history, and is persisted with the run (D-079).

## 14. Reset

`resetRun(scenario, runId)` rebuilds from the authored scenario: initial account, the scenario's
clock, its queue as written, the seed at position zero, no history. The content object is never
mutated — proved by JSON-comparing the scenario before and after a run plus a reset.

## 15. Simulator version

`2026.09.05-r1`, the project's date-plus-revision convention. Carried on every run and every saved
run, reported by the Worker's health endpoint, and stamped on evidence and attempt rows — the
Phase 9 `simulator_version` stamp is no longer `0.0.0`.

## 16. Scenario validation

The engine never branches on a scenario's identity: there is no `if (scenario.id === …)` anywhere
in the package. `validateScenario` rejects duplicate entity ids, dangling references (contact,
calendar, pipeline), a stage the pipeline lacks, impossible timestamps, an invalid timezone, an
invalid seed, an event type outside the catalogue, a scheduled or injectable event naming an
entity that does not exist, duplicate node ids, dangling workflow edges, a node with no feature,
and — when a registry is supplied — an unknown GHL feature or one marked `REAL_GHL`.
`assertRunnableScenario` throws with every problem listed rather than the first.

The content compiler now validates event names at build time. That caught three real authored
bugs: `enquiry.response` and two `client.message` events, which are **roleplay** events (a client
speaking in a discovery call; a prospect's business answering a test enquiry), not GHL account
events. Rather than loosen the check or invent GHL semantics for them, the scenario schema names
them explicitly as a small roleplay vocabulary the simulator refuses to run, and the harness only
offers scenarios that validate.

## 17. GHL registry relationship

The simulator holds no hardcoded list of actions. Feature ids travel as data on workflow triggers
and nodes; the validator takes the registry as an argument, so the engine has no opinion about
which features exist. Fidelity is preserved: a node whose feature is `REAL_GHL` is rejected, because
REAL_GHL is practised in the real product and never simulated as if it were native.

## 18. Simulator → grader adapter

`apps/web/src/simulator/grading.ts`, in the app, outside both engines. It supplies:

- `state` — the shared account, merged with the learner's `prediction` / `decision` / `answer`
  roots when the runner has them
- `events` — the log in the dotted names, `index` being the simulator's own sequence, `fields`
  being the scalar payload entries plus origin and source
- `references` — every appointment by id, plus the bare `appointment.start` only when the exercise
  names the contact it is about, plus `simulation.start` and `simulation.now`

It never supplies `architecture`. The workflows a scenario authored are its starting conditions,
not the learner's answer (D-083).

## 19. Phase 9 exercise integration

**No authored exercise became gradable, and `EXERCISE_RUNTIMES` is still empty on purpose.**

| Family | Status | Why |
|---|---|---|
| BUILD IT (EXR-004) | PARTIAL, unchanged | needs a construction surface — Workflow Lab, Phase 12 |
| FIX IT (EXR-005) | PARTIAL, unchanged | needs an execution log from a running workflow, and a repair surface |
| RUN THE LEAD (EXR-006) | PARTIAL, unchanged | its assertions expect `sms.sent` and `tag.added` produced by the booking-confirmation workflow; Phase 10 does not execute it, so a run would produce none of them |
| EDGE CASE (EXR-007) | PARTIAL, unchanged | expects `email.sent` with `purpose: rebooking` and `notification.sent` from a learner's workflow |
| REBUILD BLIND (EXR-019) | PARTIAL, unchanged | same construction surface as BUILD IT |

Registering a runtime that claimed to handle these would have graded a learner against a run that
never produced the expected events — a false failure for a phase that has not shipped. The
runner's copy for a missing source now names the Workflow Lab running the scenario, rather than
"the simulator core (Phase 10)", which would be misleading now that the core exists.

The adapter is nevertheless proved end to end against real simulator output, in
`apps/web/src/simulator/simulator.test.ts`, using the authored `SC-glowhaus-no-show` scenario:

- a **state** assertion reads `contacts.maria.tags` and `appointments.appt-maria.status` from the
  simulated account and passes
- an **event** assertion counts `sms.sent where contact_id=maria` from the simulator log
- a **sequence** assertion orders `sms.sent` before `tag.added`
- a **timing** assertion measures `appointment.status_changed` at +35 minutes from
  `appointment.start`, an instant derived from the run
- equal-timestamp events are ordered by the simulator's own sequence
- an **architecture** assertion is reported `unevaluated` with `missing_source: architecture`, and
  the report is `partial` — never a pass, and never a failure blamed on the learner

## 20. Academy simulation

`<Simulation>` no longer says "arrives with Phase 10", which is now both false and confusing. It
shows the account the simulator actually compiles from the scenario — the contact as the engine
loads it, its tags, whether a phone is on file, do-not-disturb, the appointment instant, and the
run's clock and zone — and then says plainly that stepping a contact through the workflow node by
node needs the Workflow Lab in Phase 12. No canned animation, and no expected events rendered as
though they had executed. **CUR-036 stays PARTIAL.**

## 21. Persistence

`sim_projects` (run header: account, clock, queue, generator position, execution records,
diagnostics), `sim_events` (append-only log) and `sim_snapshots` (checkpoints) — all three already
declared in `SYNC_ENTITY_KINDS` and already present as D1 tables from the Phase 4 migration, so
this phase added the Dexie v4 tables, the record types and three entries to
`LOCAL_SYNC_ENTITIES`. Push and pull are generic over `SyncEntity` and needed no change; **no D1
migration was required**.

Run ids are minted by the app (`sr-<uuid>`), not the engine. Event rows are `se:<run>:<sequence>`
and snapshot rows `ss:<run>:<log length>`, so saving the same log twice writes the same rows —
tested.

Verified, in tests and again in the browser against the built preview: the run, its event log, its
scheduled queue, its simulator time and its generator position all survive a reload; execution
continues from there; replay after a reload equals the live run; a reset persists; and **no event
fires twice because the page reloaded** — the two scheduled status changes in the authored
scenario each fire exactly once across a reload.

**Cross-device:** simulator saves do sync, by the existing path. Two devices that each start the
same scenario produce two runs, not a merge — which is what actually happened. One run edited on
two devices raises a `sim_projects` conflict through the existing chooser; that path is covered by
the merge unit tests but has not been exercised on a live second device.

## 22. Offline

The core needs nothing: no Worker API, no Cloudflare, no Claude, no internet, no server time, no
GHL. The browser probe switches the page **and the service worker** offline and then advances the
clock: the run continues, no error is shown, and an offline reload returns the same instant, log,
execution records and checkpoints. Reconnecting does not disturb local state; queued writes drain
through the existing outbox.

## 23. Error handling

Thirteen refusal codes, each carrying structured detail: `MALFORMED_EVENT`, `UNKNOWN_EVENT_TYPE`,
`INVALID_PAYLOAD`, `UNKNOWN_ENTITY`, `DUPLICATE_ENTITY`, `INVALID_TIMEZONE`, `INVALID_TIME`,
`CASCADE_LIMIT`, `INVALID_SNAPSHOT`, `REPLAY_FAILED`, `INVALID_RANDOM_STATE`, `INVALID_SCENARIO`,
`ACTION_NOT_ALLOWED`.

Nothing is silently repaired. `tryProcessEvent` keeps a run alive after a refusal by recording a
diagnostic rather than swallowing it, and the harness shows the refusal in plain words with its
code. Cascade protection stops at 500 events per operation with the trail that caused it, rather
than dropping the event or hanging the browser.

Every route already sits inside `ScreenErrorBoundary` (D-059), so a simulator failure cannot take
Academy, the Exercise Runner, the Command Center or the Skill Map with it.

## 24. Fixture registry (SIM-017)

Stable ids, never renumbered, never reused. Each implemented fixture executes real engine
behaviour and asserts an outcome; each reserved fixture names the phase that owns it, has no
`run` and no `expect`, and can never be reported as passing.

| Fixture | Behaviour | Status |
|---|---|---|
| CLOCK-001 | a run starts at the scenario's authored time and zone | implemented |
| CLOCK-002 | a calendar day holds the wall-clock reading across a DST change | implemented |
| QUEUE-001 | queued events run chronologically however they were authored | implemented |
| QUEUE-002 | events sharing an instant run in insertion order | implemented |
| TAG-001 | adding a tag a contact already carries does not duplicate it | implemented |
| FORM-001 | a form submission creates the contact it names, through the one event path | implemented |
| MSG-001 | an SMS to a contact with no phone is skipped and recorded | implemented |
| MSG-002 | a contact on do-not-disturb receives nothing | implemented |
| ENROLL-001 | re-entry off refuses a second active enrolment | implemented |
| REM-001 | a cancelled appointment is cancelled in the shared account | implemented |
| REPLAY-001 | replay from scenario + log reproduces a run exactly | implemented |
| WAIT-001 … WAIT-004 | fixed, appointment-relative, late-enrolment and cancelled-during-wait behaviour | reserved — Phase 12 |
| BRANCH-001 | If/Else with AND and OR | reserved — Phase 12 |
| REM-002 | a cancelled appointment receives no reminder | reserved — Phase 12, with Phase 15 |

## 25. Test table

679 tests in 57 files across the workspace, up from 453 in 47 at the start of the phase.

| Suite | Tests | Covers |
|---|---|---|
| `simulator-core/test/purity.test.ts` | 19 | package purity, catalogue coverage, name round-trip, immutability, determinism |
| `simulator-core/test/reducers.test.ts` | 52 | contacts, tags, opportunities, appointments, conversations, payments, forms, surveys, workflow runs, webhooks, malformed input |
| `simulator-core/test/clock.test.ts` | 30 | clock, Time Machine, Next Event, queue ordering, cascade protection, injector |
| `simulator-core/test/determinism.test.ts` | 23 | seeded randomness, snapshots, replay, reset |
| `simulator-core/test/workflow.test.ts` | 21 | layout-versus-behaviour, scenario validation |
| `simulator-core/test/regression.test.ts` | 15 | the fixture registry |
| `simulator-core/test/integration.test.ts` | 5 | one shared account across every domain |
| `simulator-core/test/coverage.test.ts` | 34 | all account domains, all seven injectable actions, rewind |
| `apps/web/src/simulator/simulator.test.ts` | 14 | the grader adapter and persistence across a reload |
| `apps/web/src/styles/designRules.test.ts` | 13 | no eyebrows, no monospace, rings that follow the shape |

Verified as more than green: reverting the global focus rule and the `code` inherit rule makes
three design-rule tests fail; the replay id test caught the shared-counter bug before it could
reach a saved run.

## 26. Requirement statuses

**PASSED:** SIM-002, SIM-003, SIM-004, SIM-005, SIM-006, SIM-007, SIM-008, SIM-009, SIM-012,
SIM-013, SIM-016, SIM-017, SIM-018, SIM-019, DES-021, DES-022.

**PARTIAL:**

- **SIM-001** — one shared account exists and every domain writes into it; the integration test
  drives form → contact → tag → opportunity → SMS → reply → appointment → attendance → stage move
  → payment → reporting counters through one state and one ordered history. The "fire a workflow"
  link of the §41 chain needs a workflow to execute (Phase 12).
- **SIM-010** — the structured log exists with stable ids and deterministic order and records
  trigger, input, step completion, skipped action, failure and exit for behaviour that exists.
  `branch_result` and `waiting` have no producer until Phase 12.
- **EXR-004, EXR-005, EXR-006, EXR-007, EXR-019** — unchanged; see §19.
- **CUR-036** — unchanged; see §20.
- **EXR-024** — still spans the product.
- **A11Y-001** — still PARTIAL globally. Phase 10 adds evidence only for the UI it introduced.

**Untouched, later phases:** SIM-011 (Phase 15), SIM-014 (Phase 12), SIM-015 (Phase 12).

## 27. Phase 11 / 12 boundary

Phase 10 owns the account, the clock, the queue, the catalogue, the log, the run and the harness.

Phase 11 (CRM Lab) gets a learner-facing surface over the account that already exists — contacts,
fields, tags, opportunities, pipelines, activity — and adds no new state model.

Phase 12 (Workflow Lab) owns execution: walking a contact node to node, waits, branches,
re-entry beyond the enrolment rule, the canvas, the inspector, the execution timeline, the mobile
editor, the Playground (SIM-015) and the Web Worker (SIM-014). Everything this review marks
PARTIAL for want of a running workflow resolves there.

## 28. Tablet holographic investigation

### What was done

The user reported that the D-074 fix was incomplete: tapping a rounded holographic card on a real
tablet still showed a sharp rectangular shape. That report was treated as authoritative and the
whole interactive stack was re-measured under **real touch**, not hover, with a new probe
(`scripts/review/holo-touch-probe.mjs`) that:

- drives `Input.dispatchTouchEvent` through touchStart → hold → move → touchEnd, then keyboard
  focus, at 1024 px and 768 px with touch emulation on
- samples computed style **at every stage while the pointer state is live** — radius, appearance,
  tap-highlight colour, background, border, outline, box-shadow, overflow, clip-path, isolation,
  contain, touch-action, user-select, touch-callout, transform, the material's own radius and
  transform-style, `:active` / `:focus-visible` matching, and `aria-pressed`
- decodes the actual screenshot pixels (a small PNG reader, `scripts/review/png.mjs`) at each
  corner of the card's painted box — grown by any ring — and compares them against the local
  backdrop sampled at the same instant
- records which stages were occluded by what the tap itself opened, so a covered stage can never
  be read as a clean corner

### Real root cause

Three separate causes, **none of them the layer clipping D-074 fixed**:

1. **The global focus rule was reshaping the card.** `:focus-visible` in `global.css` set
   `border-radius: var(--bl-radius-sm)`, and that applied to whatever was focused. The probe
   measured a territory card's radius collapsing **24 px → 6 px** for as long as it held focus,
   while the material inside kept 24 px — a pointed corner appearing exactly during the
   interaction. Desktop hover could never show this: Chrome suppresses `:focus-visible` for a
   mouse click, which is why the check that cleared D-074 missed it.
2. **The rings were offset outlines around a transformed element.**
   `.territory[aria-pressed='true']` and the focus rules used `outline` with `outline-offset`,
   which WebKit before 16.4 paints as a hard rectangle.
3. **The platform tap highlight was never disabled.** The probe measured
   `-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4)` on every control — a translucent
   rectangle the OS paints over the touched element's box.

### Exact fix

- `global.css`: the `:focus-visible` rule no longer sets `border-radius`. A ring follows the
  radius the element already has.
- `HoloTerritory`, `SkillCard` and `ClientCaseCover` each draw their focus ring as a spread
  `box-shadow`, which follows `border-radius` on every engine, plus `outline: Npx solid
  transparent` so forced-colours mode still paints one.
- `HoloTerritory` composes selection and focus (`0 0 0 2px ink, 0 0 0 5px focus`) so focus stays
  distinguishable from selection instead of one replacing the other.
- Skill Map's selected-territory ring became a `box-shadow`; its duplicate focus rule was removed
  so selection and focus can never disagree about the shape.
- `global.css`: `-webkit-tap-highlight-color: transparent` on `button`, `summary`,
  `[role="button"]` and `[role="tab"]` — the controls that answer a touch with their own feedback
  — and `appearance: none` on `button`. Anchors in body copy keep the platform highlight, which is
  their only touch affordance.
- The outer interactive shape is deliberately **not** clipped. `overflow: hidden` or `clip-path`
  on the wrapper would cut off the card's own drop shadow, and the reproduction showed the
  rectangles came from the ring and the highlight, not from a descendant escaping the wrapper.

Keyboard focus visibility is untouched, and is now shape-correct as well.

### Automated evidence

Before the fix, 57 failures across the two widths, including
`radius collapsed 24px -> 6px`, `rectangular-risk outline 2px solid rgb(24, 21, 43) offset 3px`
and `native tap highlight rgba(51, 181, 229, 0.4)` at every stage of the gesture.

After the fix, at 1024 px and 768 px, across idle, touch-down, hold, drag, release, after release
and keyboard focus, for HoloTerritory, SkillCard and the Command Center continuation object:

**AUTOMATED TABLET CHECK: PASS** — 0 failures. No corner of any card's painted box moves from its
local backdrop during the gesture, no radius collapses, no opaque offset outline is used on a
holographic card, no native tap highlight is live on an element that could receive one, and every
focused card still shows a visible ring.

**REAL TABLET USER CHECK: PENDING.** This must be confirmed by the user on their own tablet
against the deployed preview. Automation cannot reproduce an older iPadOS WebKit's outline
behaviour, which is precisely why the fix does not rely on outlines following the radius.

D-074 is left in the ledger as written. D-075 records that real-tablet testing proved it
incomplete, and documents the three causes and the fix.

## 29. Eyebrow removal audit

Thirty-nine tiny-uppercase rules were de-eyebrowed and thirteen labels recomposed rather than
deleted:

| Where | Was | Now |
|---|---|---|
| Skill Map header | "Nine territories · judgment at the centre" above the H1 | the first sentence of the lead |
| Skill Map panel | the territory's scope above the H2 | the panel's subtitle, below the heading |
| Skill Map capability sheet | "BUILD · Your focus" | a normal metadata line |
| Skill Map / Academy next panel | "Next · verb" above the title | folded into the metadata row under the title |
| Command Center | campaign · gate · focus above the H2 | the continuation object's subtitle |
| Command Center | "Next · verb" in the step row | folded into the step's metadata |
| Command Center | tiny-uppercase block headings, item verbs, the session legend | normal small headings and labels |
| Campaign | "&lt;Title&gt; campaign" above the H1 | removed — it repeated the heading; "Campaign · " now leads the pace line |
| Campaign | "Gate N" above the gate name | merged into the heading: "Gate 1 · Funnel Thinking" |
| Academy unit | "Academy · Territory · N min read" above the H1 | the unit's metadata row, under the lede |
| Academy embeds | inline simulation label, callout/depth/path labels, legends, result headings | normal labels and small headings |
| Exercise Runner | "Family · Mode · N min" above the H1 | the exercise's metadata row, under the stance |
| Exercise Runner | scenario context, feature titles, assistance, hint level, critical label, tier titles, diff terms | normal small headings and labels |
| Skill card | the territory above the card title | the card's own metadata row |
| Exercise prompt | the family label above the title | below the title |
| Client case cover | the industry above the business name | the name's subtitle |
| Sync, System, Device, Conflict chooser, Tool panel, Workflow node, Design gallery | tiny-uppercase section labels | sentence-case small headings |

The `--bl-font-tracking-eyebrow` token is removed, and no `.eyebrow`, `.kicker` or `.overline`
class remains anywhere.

**Proof:** `designRules.test.ts` fails any rule combining a tiny font size with
`text-transform: uppercase` outside the navigation rail, fails on the tracking token, and fails on
the class names. The simulator probe reports zero tiny-uppercase elements on the rendered harness.
The five-width capture covers every learner-facing route.

**Deliberate exception:** the primary navigation rail keeps its small-caps labels and wordmark.
Those are navigation, not a pre-heading strip.

## 30. Monospace removal audit

Forty-seven `font-family: var(--bl-font-mono)` declarations removed across twenty stylesheets:

- **Numeric intent → `font-variant-numeric: tabular-nums`** (nineteen sites): territory capability
  counts, funnel counts and rates, slider outputs, lever results, result metadata, exercise
  scores and diff values, learning-diagnostics rows and gates, the sync key, system-diagnostics
  values and operations, call elapsed time, contact activity, execution event time, pipeline
  values, pricing.
- **Code treatment → inherit** (`.code`, `.pre`, `.mono`, workflow node config, gallery code): the
  tinted background and padding stay; the family is gone.
- **Decorative** (the rest): removed with the eyebrow treatment they belonged to.

The `--bl-font-mono` token, the `typography.mono` entry, the two IBM Plex Mono `@import`s and the
`@fontsource/ibm-plex-mono` dependency are all removed. `code`, `pre`, `kbd` and `samp` are told
explicitly to inherit, because the user agent gives them a monospace family by default and
deleting our declaration alone would have fallen back to the browser's own — the regression test
catches exactly that.

**Proof:** no `font-family` declaration in the app or design system names a monospace family;
`designRules.test.ts` enforces it; the simulator probe reports zero monospace elements on the
rendered page.

## 31. Five-width review

Reviewed at 1440, 1024, 768, 390 and 320 across the Command Center, Campaign, Skill Map, the
capability sheet, three Academy units, four Exercise Runner screens, Sync, System diagnostics, the
Simulator harness, the design gallery sections and the not-found screen.

The harness recomposes on small screens: the run bar stacks, the scenario select goes full width,
metadata wraps rather than scrolling, and every list row wraps its detail under its name. No
horizontal overflow at any width.

## 32. Accessibility

Only for the UI Phase 10 introduced. **A11Y-001 remains PARTIAL globally.**

- Keyboard: 18 focusable controls on the harness, all reachable and operable — the scenario
  select, the four Time Machine controls, every injector action, step back, checkpoint, replay,
  reset, and the back link.
- Focus is visible on every one of them, and now follows the rounded shape on holographic cards.
- Controls are ≥ 44 px, including the back link. The one exception on the page is the global
  skip-to-content link (125 × 37), which predates this phase and is shared by every screen.
- No status is conveyed by colour alone: an event's origin is a word ("Injected", "Generated by
  the engine"), a skipped action states its reason in words, and a refusal is a bordered panel
  with a sentence.
- No hover-only information.
- No monospace, no eyebrows.

## 33. Performance

`packages/simulator-core` compiles to roughly 26 KB of source across 17 modules and has no
dependencies. The harness route is lazy like every other route, so the engine is not in the
initial bundle; the Academy's simulation embed pulls in only `initialAccount` and `toZone`. The
preview build reports 59 precached entries at 1,481 KiB, which the removed IBM Plex Mono weights
reduced. No Web Worker: nothing measured in this phase blocks — the heaviest operation exercised
is an advance across a two-event queue. SIM-014 stays with Phase 12, where heavy execution
actually appears.

## 34. Known limitations

Recorded in full in `KNOWN_LIMITATIONS.md` under "Phase 10 — simulator core". In short: no
workflow executes; the Academy simulation still cannot step a contact through one; simulator runs
sync but two devices make two runs and the conflict path is untested on live hardware; the queue
is reachable only from a scenario or the API, not from a control in the harness; two failure
conditions rather than nine; the harness is a developer surface; the clock depends on the
runtime's `Intl` zone database; and the tablet holographic fix awaits the user's own check.
