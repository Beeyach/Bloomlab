# Phase 12 review — Workflow Lab

What was built, what it does, what it deliberately does not do, and what remains. Written against
the code on the branch, not against the plan.

---

## 1. Base commit

`52c9215e332168ea14ce041281bb13bfdce9f5cd`, `main` after the Phase 11 merge. Branch `feat/workflow-lab`, one pull
request. Phase 13 was not started.

## 2. Phase 12 scope

Spec Phase 12 is the flagship Workflow Lab with extensive testing. The requirement rows are
WFL-001 to WFL-012, SIM-014, SIM-015, EXR-023, CONV-001, A11Y-006, PERF-002 and the workflow half
of RSP-004. The phase also re-evaluates SIM-001, SIM-010, EXR-004 to EXR-007, EXR-019, EXR-024
and CUR-036 against what now runs, and corrects the app rail (DES-009) to the 80 px the spec
names. The Funnel Lab, Calendar Lab, realistic-failure library, AI grading and every later phase
were out of scope and none were touched.

## 3. Requirement status

| ID | Status | Evidence |
|---|---|---|
| WFL-001 | PASSED | Canvas, toolbar, inspector and execution timeline at `/workflow` from 1024 px up. Probe section `desktop-present` (12 checks) and `width-1024`. |
| WFL-002 | PASSED | Add trigger, filter, action, Wait, If/Else, branches, reorder, connect, undo, redo, run test and inspect history all work by pointer and keyboard. `graphEdit.test.ts` (9), `workflow.test.ts` (18), probe sections `desktop-edit-undo-redo-save`, `keyboard-move`, `drag-move`, `run-and-replay`. |
| WFL-003 | PASSED | Every palette item is a registry record. Fidelity C records (Goal Event, Inbound Webhook, Payment Received) are shown as not runnable and refuse to run. Probe checks `realFeatureNames` and `nonRunnableMarked`. All 21 runnable records re-verified 2026-09-04 (§46). |
| WFL-004 | PASSED | Existing or generated test contact runs visibly with the current node lit, the travelling dot, current values in the inspector, branch result and the timeline. Probe `run-and-replay` (14 rows, node lit, dot travelled). |
| WFL-005 | PASSED | A node shows feature name, one line of configuration and status. Settings open only in the inspector. `workflowScreen.test.tsx`, probe `desktop-present`. |
| WFL-006 | PASSED | At 390 and 320 px the Lab is a vertical step editor with a sheet inspector, add-from-sheet, branch paths and a Timeline tab. Probe `width-390` and `width-320` (8 checks each). |
| WFL-007 | PASSED | Ink workspace luminance 0.06, node luminance 1.0, aqua for the active run. No neon, no eyebrow, no monospace (`designRules.test.ts`). |
| WFL-008 | PASSED | Fixtures WAIT-001 to WAIT-004, TIME-001, TIME-002, REPLY-001, REPLY-002 and the wait tests in `workflow-engine.test.ts`: fixed, appointment-relative, date, time window, reply, condition, timezone, late enrolment, cancellation during a wait. |
| WFL-009 | PASSED | Fixtures BRANCH-001 to BRANCH-005 and the dynamic-value test: AND within a group, OR between groups, seven comparisons, dynamic values from the run, None fallback, multiple paths. |
| WFL-010 | PASSED | Fixtures ENROLL-001, ENROLL-002, OVERLAP-001, MSG-003, EXIT-001, EXIT-002, REM-002, TRIGGER-001, TRIGGER-002: re-entry allowed and refused, repeated triggers, overlapping workflows, duplicate messages, exits. |
| WFL-011 | PASSED | `palette.ts` derives everything from `content.ghl_features`; a source-level test refuses `const ACTIONS` or `const TRIGGERS` in the Lab, and a registry record added in a test appears in the palette without code change. |
| WFL-012 | PASSED | The first run animates the contact travelling the graph, the timeline fills in order, and Replay walks it again. Probe `run-and-replay` and `reduced-motion`. |
| SIM-014 | PASSED | The engine runs in a Web Worker through one door. 504 events added in the probe at p95 43.5 ms per frame, no frame over 100 ms, no long task over 100 ms, main thread responsive. Parity and crash tests in `workflow.test.ts`. |
| SIM-015 | PASSED | `/playground` lists every unlocked feature by the D-111 rule with no exercise attached. `unlocks.test.ts` (4), `playgroundScreen.test.tsx`, probe `playground`. |
| EXR-023 | PASSED | Weighted dimensions 45/20/15/10/10 with critical override in `packages/exercise-engine` (`grade.test.ts`, 24 tests) and applied to the authored workflow exercises (`authoredGrading.test.ts`). |
| CONV-001 | PASSED | `/conversations` shows simulated SMS and email; an injected reply releases a reply wait and enrols Customer Replied. `conversationsScreen.test.tsx`, REPLY-001, REPLY-002, probe `conversations`. |
| A11Y-006 | PASSED | Every drag (move a node, connect, reorder, drop from the palette) has a keyboard and menu path: arrow keys and the inspector's Move, Connect and Reorder controls. Probe `keyboard-move`. |
| PERF-002 | PASSED | Drag at mean 16.5 ms per frame (p95 17, max 17), execution playback at mean 16.7 ms per frame over 221 frames. Transforms and opacity only. |
| RSP-004 | PARTIAL | Workflow → vertical step editor now holds. CRM, Academy and Skill Map held before. Call Room and Inbox recompositions belong to Phases 21 and later. |
| SIM-001 | PASSED | The chain form → contact → tag → workflow → SMS → appointment → opportunity now runs through one account: a booking fires Booking Confirmation and a no-show fires the recovery in the same state and log (`integration.test.ts`, `exerciseRuntime.test.ts`). |
| SIM-010 | PASSED | `branch_result` and `waiting` now have producers. Every record kind in the requirement is emitted by the engine and read by the timeline. |
| EXR-004 | PASSED | BUILD IT is built in the Lab and graded from the learner's run with architecture from their definition (`exerciseRuntime.test.ts`). |
| EXR-005 | PASSED | FIX IT: the double reminder is reproduced from the broken account, the learner reads the logs in the Lab, and the grade fails before the fix and passes after. |
| EXR-006 | PARTIAL | The prediction is captured and the real run is graded. The animation of the run lives in the Lab's Replay, not inside the runner page. |
| EXR-007 | PARTIAL | Cancelled and missing-phone edge cases are judged from real runs. The late-booking exercise's `after:` where-clause is not evaluable by the grader (KNOWN_LIMITATIONS). |
| EXR-019 | PASSED | REBUILD BLIND: a reminder system built through the command layer and graded from the two texts the engine sent 24 h and 2 h before the appointment. |
| EXR-024 | PARTIAL | No stub was added. The requirement spans the product and stays open. |
| CUR-036 | PASSED | The Academy's inline simulation runs the engine in memory and lists its execution records; a test asserts the rows are engine output (`academy.test.tsx`). |
| DES-009 | PARTIAL | The rail is 80 px from one token at 768 px and up with the page starting beside it, verified at five widths. Clients and Portfolio join with Phases 23 and 24. |

## 4. Architecture

```
Workflow Lab (React)
  → apps/web/src/workflow/commands.ts      intent → one pending simulator event
    → apps/web/src/workflow/execution.ts   the one door: direct or Web Worker, same handler
      → apps/web/src/workflow/engineOps.ts   runOp: processEvent / advance / replay
        → @bloomlab/simulator-core           validate, traverse, reduce, log, record
          → apps/web/src/simulator/store.ts  persist the run
            → UI reads the new StoredRun
```

There is no workflow store in React. The canvas holds a draft of the definition and its undo
history. Everything that runs, waits, branches, matches or exits happens in
`packages/simulator-core`.

## 5. What React never decides

React edits definitions, starts tests, renders execution and animates trace playback. It does not
decide which branch matches, when a wait completes, whether a trigger matches, mutate CRM records,
decide re-entry, or emit timeline events. A source-level test in `workflow.test.ts` fails if any
screen file imports `processEvent` or writes to `sim_events` directly, and the timeline is derived
from `state.execution` alone.

## 6. New simulator events

| Event | Origin | Meaning |
|---|---|---|
| `WORKFLOW_CREATED` | injected | A definition saved for the first time (version 1). |
| `WORKFLOW_UPDATED` | injected | A definition saved again (version + 1). |
| `WORKFLOW_ADVANCED` | generated | The run moves to one node. |
| `WORKFLOW_RESUMED` | scheduled or generated | A wait ends: due, released by a reply, condition met, or timed out. |
| `NOTIFICATION_SENT` | generated | Send Internal Notification ran. |
| `EMAIL_RECEIVED` | injected | An inbound email, the email twin of `SMS_RECEIVED`. |

The catalogue is 42 events. None of the six is presented as a GHL trigger; the registry names
the real triggers and the engine maps them (§12).

## 7. Event origins and scheduled wakes

A new origin `scheduled` marks an event the engine queued for a future instant. Replay re-runs
root events (every origin except `generated`) and the reducers re-queue the identical scheduled
entries, so a replayed run has the same queue as the original. Queue ids are `sc-<run>-<n>`. A
wait's wake can be withdrawn by `unschedule` on its resume token, which is how an exit during a
wait removes the pending wake (D-101).

## 8. Workflow definition model and versioning

`Workflow` gains `version`, `settings.time_window` and typed configs for Wait and If/Else.
`WorkflowRun` gains `wait`, `context`, `definition_version` and `definition_hash`, so a run knows
which version it started under and a timeline row can say "v2". Editing a definition never
rewrites a run that already used the old one (D-104).

## 9. Definition events and commit boundaries

Saving the draft appends `WORKFLOW_CREATED` or `WORKFLOW_UPDATED` with the whole definition. Moving
a node, typing in the inspector or dragging a connection edits the draft only. One event per save,
never one per pointer pixel (D-107). The probe's `drag-move` section drags a node across 90 frames
and asserts exactly one draft edit and zero events.

## 10. Undo and redo

`draft.ts` keeps a bounded history (200 entries) of definition snapshots. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
and the toolbar buttons move through it. Undo never touches the append-only event log: an undone
change that was already saved is undone as a new save (D-110). Probe `desktop-edit-undo-redo-save`
asserts add → dirty → undone → redone → saved clean → version 2.

## 11. Graph validation

`validateWorkflowGraph` refuses a definition with: no trigger, an unknown or unsupported feature,
an unknown or invalid filter, no nodes, a duplicate node id, a dangling edge, no entry, several
entries, an ambiguous next step, a cycle, a branch edge that names no branch, a branch with no
fallback path, an invalid node config, an unreachable node, or invalid settings (D-106). The
content compiler runs the same validation over authored scenarios, so a broken workflow fails the
build rather than the learner.

## 12. Capability adapters and the palette (WFL-011)

Every runnable trigger and action is an adapter keyed by `ghl_feature_id` in
`workflow/capabilities.ts`: a trigger adapter names the internal events it listens to, its filter
fields and a `match` function; an action adapter validates its config and produces effect events
(D-105). The palette is built from `content.ghl_features` filtered by area and feature type, with
runnable status read from the adapter table. A record without an adapter, or with fidelity C, is
listed as not runnable and cannot be added as a runnable step. The Lab contains no literal list of
actions or triggers, and a test proves a registry addition appears without code.

## 13. Trigger matching and filters

`workflowReactions` runs after every processed event. For each published workflow whose trigger
adapter listens to the event type, the adapter's `match` reads the event and the account and
returns the values a filter can see (form, calendar, tag, appointment status, pipeline, stage,
channel). Filters use the same `compareValues` as conditions: a missing value fails every
comparison except `not_exists`. A matched trigger enrols the contact with `trigger_values` and a
context (appointment, opportunity, form, message), and re-entry is judged there (§24).

## 14. Traversal

A run moves one node per `WORKFLOW_ADVANCED`. The node's effects are generated first and the
continuation second, so an If/Else after Add Contact Tag sees the tag. An `end` node completes the
run. A `goal` node or a non-runnable feature fails the run with reason `unsupported_feature` rather
than pretending. A wait parks the run (§17). A stale advance for a run that has moved on is
recorded and ignored (D-101).

## 15. Actions

Send SMS, Send Email, Add Contact Tag, Remove Contact Tag, Update Contact Field, Assign To User,
Create/Update Opportunity, Remove From Workflow (this workflow, all, or a named one), Send Internal
Notification and Webhook (Outbound). Each produces the same internal events the CRM Lab and the
scenario injector produce, so an SMS from a workflow is the same `SMS_SENT` as one from anywhere
else. A skipped action (no phone, do-not-disturb, tag already present, tag not present) is an
`action_skipped` record with a reason, and an event whose records are all skips fires no triggers,
which is what stops a tag-triggered workflow that adds its own tag from looping.

## 16. Merge fields

`renderTemplate` substitutes `{{contact.*}}`, `{{custom_values.*}}`, `{{appointment.start_time}}`,
`{{appointment.start_date}}`, `{{appointment.status}}`, `{{appointment.calendar}}`,
`{{opportunity.*}}`, `{{user.name}}`, `{{message.body}}` and `{{message.channel}}` from the run's
view. Unresolved fields are recorded on the input row as "Blank merge fields", never invented. No
`eval`, no `Function`, no expression language (D-103).

## 17. Waits

| `wait_type` | Registry wording | What the engine does |
|---|---|---|
| `period` | Time Delay | Wake at now + days/hours/minutes in the run's zone. |
| `appointment` | Appointment Time | Wake at the subject appointment's start ± hours (before / after / at). |
| `date` | Specific Date/Time | Wake at an instant that must carry its offset. |
| `reply` | Contact Reply | Park until an inbound SMS or email from the contact, with an optional timeout. |
| `condition` | Condition | Park until the condition groups hold, re-evaluated on every event touching the contact, with an optional timeout. |

The record names are the wait types the HighLevel Wait article lists, and the fixtures address
them by `wait_type` (D-100). Wake instants are normalised to the run's zone so the queue and the
`wait` on the run agree.

## 18. Appointment-relative waits and late enrolment

An appointment wait reads the appointment from the run's context, or the contact's next
appointment when the context has none. If the target instant has already passed (a contact enrolled
after "24 hours before"), the run proceeds at once and records `waiting` with reason
`wait_target_passed`, so the timeline says why the reminder went out immediately (WAIT-003).

## 19. Time window (business hours)

HighLevel has no "Business Hours Wait" action. What it has is the workflow setting Time Window,
which holds a message set to send outside the window until the next window opens. The engine
models that as `settings.time_window { days, start, end }` applied to outbound messages: the run
parks with reason `time_window` and `held_until`, then resumes into the same node (D-102). TIME-001
and TIME-002 pin it, and the registry record `GHL-WF-WORKFLOW-SETTINGS` (fidelity B) states the
source.

## 20. Reply and condition waits

A reply wait is released by `SMS_RECEIVED` or `EMAIL_RECEIVED` for the same contact on the chosen
channel, and the resume row records `released by a reply`. A condition wait re-evaluates its groups
after every event that touches the contact and resumes with `condition met`. Both can time out. The
Conversations surface injects the reply; the engine decides the release.

## 21. Timezones

A workflow may set its own `settings.timezone`; otherwise the run's zone applies. Day arithmetic is
calendar arithmetic in that zone, so "1 day" across a daylight-saving change stays 09:00. Every
instant in state carries its offset, and an offset-less date wait is refused (D-098 holds).

## 22. Cancellation during a wait: platform versus design

The GHL article "Appointment scenarios in Workflow" says a run started by an appointment trigger
is pulled out when that appointment is cancelled, marked invalid or no-show, or rescheduled, and
that a reschedule fires the appointment triggers again. The engine does exactly that in
`appointmentExits`: a run whose trigger was Customer Booked Appointment or Appointment Status ends
with `appointment_cancelled` or `appointment_rescheduled`, its pending wake is withdrawn, and a
reschedule enrols afresh with status `new` (RESCHED-001, EXIT-002).

A run started any other way is not pulled out. WAIT-004 enrols a reminder by tag, cancels the
appointment during the wait, and shows the reminder still going out. That is the platform's
behaviour, and the fix is workflow design: an Appointment Status filter on the trigger, an If/Else
on `appointment.status` before the send, or a cancellation workflow that removes the contact
(REM-002). The simulator distinguishes the two and the fixture does not fake either.

## 23. If/Else

Branches are ordered. Each holds groups of conditions: AND inside a group, OR between groups.
Operators: `is`, `is_not`, `contains`, `not_contains`, `exists`, `not_exists`, `gt`, `lt`. Values are read from the run's view (contact fields and custom fields, tags,
appointment, opportunity, message) and compared as data. The first matching branch wins and None is
always present. The `branch_result` record stores every condition with the value seen and the
value wanted, and the timeline reads them out (BRANCH-001 to BRANCH-005).

## 24. Re-entry and overlaps

`allow_reentry: false` refuses a second enrolment while a run is active and records the refusal
(ENROLL-001). `allow_reentry: true` starts a second run (ENROLL-002). Two workflows listening to the
same booking both enrol and both send, which is the FIX IT fault (OVERLAP-001, MSG-003). A
workflow that fires again on the same contact from a repeated trigger is TRIGGER-002.

## 25. Exits

Completed, removed by Remove From Workflow, pulled out by the appointment rules, failed, or ended
by a stale resume. Every exit unschedules the run's pending wake and writes an `exit` record with
the reason.

## 26. Execution records

`trigger`, `input`, `step_started`, `step_completed`, `branch_result`, `action_skipped`,
`waiting`, `failure`, `exit`. Records carry data and machine reasons; `words.ts` phrases them.
Attribution (`workflow_id`, `node_id`, `workflow_run_id`) is filled centrally in `run.ts` from the
effect event's payload so a message sent by a node is attributed to it without the reducer
knowing about workflows.

## 27. The Web Worker (SIM-014)

`execution.ts` is one door. It sends `{ run, scenario, op }` to `engine.worker.ts`, which imports
the same `engineOps.ts` the direct path uses, and receives `{ run }` or a structured refusal. The
Worker is stateless, so no state is shared and there is no second engine (D-109). A test pins the
same request to the same result on both paths, byte for byte.

## 28. Parity and crash safety

The direct path and the Worker path produce identical state hashes, event logs, execution logs
and queues for the same op. A Worker that throws, times out or dies returns `ENGINE_CRASHED` and
the saved run is untouched; the commit to the store happens only on success. A test kills the
Worker mid-op and reads the run back unchanged.

## 29. Persistence and the current run

The Lab works in the same `StoredRun` rows the CRM Lab uses. Which run a device works in is one
rule for the CRM Lab, the Workflow Lab, Conversations and both exercise runtimes: the device's
own choice for that scenario, else the newest (D-108, refining D-099 without changing it). D-098's
offset rule holds for every date the Lab writes.

## 30. Workflow Lab desktop

At 1024 px and above: palette on the left, canvas in the middle, inspector on the right, test panel
and timeline below. The canvas is an ink surface, nodes are light, the active run is aqua. The
toolbar holds Save workflow, Undo, Redo and the run selector, the test panel holds Run test and
Reset. Every control is a native button, link, input or select with a visible focus ring.

## 31. Canvas interactions and A11Y-006

Drag moves a node, drag from a port connects, drop from the palette adds. Each has a non-drag
path: arrow keys move the focused node by a grid step, the inspector's Connections section picks
the next step from a select, Move up and Move down reorder a step along a chain, and the palette's
Add button appends after the selected step. The probe moves a node by keyboard and undoes it.

## 32. Inspector (WFL-005)

The node shows its real feature name, a one-line configuration summary and its status
(idle, running, waiting, done, skipped, failed). The inspector holds the full configuration:
registry-driven fields, reference options read from the account (calendars, pipelines, tags, users,
fields), condition editors and wait settings. A goal or fidelity C node says it will not run.

## 33. Test panel (WFL-004)

Pick an existing contact or generate one, choose the workflow, enrol with the contact's next live
appointment as context when there is one, then move time by a minute, an hour, a day or to the
next queued event. The panel also sends a reply as the contact, books an appointment on a calendar
and runs the scenario's injectable actions (a cancellation, a no-show, a reschedule), all through
`commands.ts`. The current node, the wait's wake instant and the run's status are read from the
run.

## 34. Timeline and replay (WFL-012)

The timeline is `state.execution` for the selected run, in sequence order, phrased by `words.ts`.
Replay walks the rows with the node highlight and the travelling dot at a fixed cadence; the
reduced-motion probe shows the end state at once with no dot travel.

## 35. Tablet (768 to 1023 px)

Two columns: the canvas beside the inspector, with the test panel and the timeline side by side
below them. No horizontal overflow at 768 (probe `width-768`).

## 36. Mobile (WFL-006, RSP-004)

Below 768 px the Lab is a vertical step editor: the trigger, then each step as a row in walking
order with branch paths indented, a tap opens the inspector as a bottom sheet, Add opens the
palette as a sheet, and Timeline is a tab. Nothing is a shrunken canvas and nothing is removed.
Touch targets are 44 px and inputs 16 px (probe `width-390`, `width-320`).

## 37. Visual design (WFL-007)

Canvas background `rgb(16, 13, 34)` (luminance 0.06), nodes white (luminance 1.0), execution
in the aqua token. No eyebrow labels, no monospace, no neon, no glow. `designRules.test.ts`
enforces the first two across the app.

## 38. Rail correction (DES-009)

The rail is drawn from `--bl-size-rail: 80px` and `--bl-size-rail-bar: 64px`. `RootLayout` offsets
the page by the same token, so the page starts beside the rail. Seven areas: Home, Campaign, Skill
Map, CRM, Workflow, Inbox, Playground. Labels hide below 480 px so seven items fit at 320 px.
`npm run review:rail` measures all five widths (§49). The holographic cards are unaffected (§49).

## 39. Conversations (CONV-001)

`/conversations` lists the account's threads and shows SMS and email in one view with direction
and, when a workflow sent a message, its attribution. Inject a reply as the contact: the engine
releases a reply wait and enrols any Customer Replied workflow. Calls and other channels are not
here yet.

## 40. Playground (SIM-015)

`/playground` lists every registry feature the learner has unlocked and opens a blank workflow on
a sandbox scenario with no exercise attached. Unlock rule (D-111): a feature is unlocked when a
skill that teaches it has progress beyond UNSEEN, or the learner has a saved run of a scenario that
uses it. Locked features are listed as locked with the skill that unlocks them. No badges, no
points.

## 41. Academy embed (CUR-036)

`<Simulation>` enrols the named contact in the named workflow in memory with the real engine,
moves time once past the first wait, and lists the execution records. A link opens the same
scenario in the Lab. `academy.test.tsx` asserts the rows are engine output.

## 42. Exercise runtime and the architecture source

`workflow/exerciseRuntime.ts` registers `workflow-lab`, claiming simulator-family exercises on
runnable scenarios other than the CRM training account. It supplies `state`, `events`,
`references` and `architecture` from the current run. Architecture is the learner's: workflows the
scenario did not author, or authored ones whose version is past 1 (D-112). A test walks every
authored exercise and proves there are never two claimants.

## 43. EXR-023 weighted scoring

`dimensionOf` assigns each assertion a dimension: the authored `dimension`, else architecture for
architecture checks, edge cases for negatives, explanation for learner-root state, correctness
otherwise. The score is the weighted share across dimensions with checks, weights from the
exercise's `grading.weights` (45/20/15/10/10 by default), and a failed critical check fails the
attempt at any score (D-113). `report.dimensions` carries per-dimension weight, total and passed
for the result view. Grader version `2026.09.07-r1`.

## 44. Family re-evaluation

BUILD IT, FIX IT and REBUILD BLIND are graded from real runs in `exerciseRuntime.test.ts`. RUN THE
LEAD captures the prediction and grades the run; the animation is in the Lab's Replay rather than
inside the runner page, so EXR-006 stays PARTIAL. EDGE CASE judges cancelled and missing-phone
runs; the late-booking exercise's `after:` clause is still not evaluable, so EXR-007 stays PARTIAL.

## 45. Content changes

Schema: condition operators, condition groups, branches, If/Else config, wait types and config,
time window, per-node config validation, graph validation at compile time, and an optional
`dimension` on assertions. Registry: `GHL-WF-WORKFLOW-SETTINGS` added; six records re-shaped for
wait, branch and time-window configs. Scenarios: message purposes, users, appointments. Exercises:
`trigger_appointment_status` on the BUILD IT critical check, `action.skipped` on the missing-phone
check, a subject contact on REBUILD BLIND. Content version 2026.09.07.

## 46. GHL verification sources

| Feature | Fidelity | Verified | Source |
|---|---|---|---|
| Form Submitted | A | 2026-09-04 | article 155000002550 |
| Survey Submitted | B | 2026-09-04 | article 155000003259 |
| Customer Booked Appointment | A | 2026-09-04 | article 155000002675 |
| Appointment Status | A | 2026-09-04 | article 155000002619 |
| Contact Created | A | 2026-09-04 | article 155000002486 |
| Contact Tag | A | 2026-09-04 | article 155000002482 |
| Customer Replied | B | 2026-09-04 | article 155000002677 |
| Pipeline Stage Changed | A | 2026-09-04 | article 155000002493 |
| Opportunity Status Changed | A | 2026-09-04 | article 155000003252 |
| Send SMS | A | 2026-09-04 | article 155000002474 |
| Send Email | A | 2026-09-04 | article 155000002472 |
| Add Contact Tag | A | 2026-09-04 | article 155000003111 |
| Remove Contact Tag | A | 2026-09-04 | article 155000003266 |
| Update Contact Field | A | 2026-09-04 | article 155000002688 |
| Assign To User | A | 2026-09-04 | article 155000003300 |
| Create/Update Opportunity | A | 2026-09-04 | article 155000002476 |
| Remove From Workflow | A | 2026-09-04 | actions list 155000002294 |
| Send Internal Notification | B | 2026-09-04 | article 155000003202 |
| Webhook (Outbound) | B | 2026-09-04 | article 155000003299 |
| Wait | B | 2026-09-04 | article 155000002470 |
| If/Else | A | 2026-09-04 | article 155000002471 |
| Workflow Settings (Time Window) | B | 2026-09-04 | article 48001239875 |
| Appointment scenarios in Workflow | (behaviour) | 2026-09-04 | article 155000002697 |

**Method, stated plainly.** The build environment's egress proxy denies every
`help.gohighlevel.com` request, so every record was verified through search-engine summaries of the
official articles rather than a direct read, and each record's `verification_note` says so with
the date. Nothing was added from memory, and no internal event was renamed to sound native.

## 47. Fidelity limitations

Create/Update Opportunity: HighLevel says the combined action is being phased out in favour of
Create Opportunity and Update Opportunity; the record keeps the name learners still see and says
so. Send Internal Notification: WhatsApp is not offered. Assign To User: one user, or equal rotation
by current load among the listed users, no weighted split. Webhook: recorded with a simulated 200, never sent. Send Email: no templates,
deliverability or open tracking. Wait: the eight HighLevel wait types are covered by five engine
kinds (§17); Trigger Link Clicked and Email Event waits are not modelled. Time Window: modelled as
a hold on outbound messages, which is the documented behaviour, not a wait step. Customer Replied:
Contains Phrase and Reply Channel filters only.

## 48. Test table

| File | Tests | Covers |
|---|---|---|
| `packages/simulator-core/test/workflow-engine.test.ts` | 37 | Graph validation, definitions and versioning, merge fields, capability registry, actions, waits, walk, dynamic values |
| `packages/simulator-core/test/workflow.test.ts` | 21 | Enrolment, re-entry, exits, wait metadata, scheduled wakes (extended) |
| `packages/simulator-core/test/regression.test.ts` and `fixtures/workflow-fixtures.ts` | 3 + fixtures | WAIT-001..004, RESCHED-001, BRANCH-001..005, TIME-001/002, REPLY-001/002, ENROLL-001/002, OVERLAP-001, MSG-003, EXIT-001/002, REM-002, TRIGGER-001/002, REPLAY-002 |
| `packages/simulator-core/test/{reducers,integration,coverage,purity}.test.ts` | 79 | Extended for 42 events, booking fires a workflow, purity of the new modules |
| `packages/content-schema/test/*` | 56 | Workflow config schemas, graph validation at compile, `dimension` on assertions |
| `packages/exercise-engine/test/grade.test.ts` | 24 | Weighted dimensions, critical override, `report.dimensions` |
| `apps/web/src/workflow/workflow.test.ts` | 18 | Commands, one door, Worker parity, crash safety, current run, definition events, undo/redo |
| `apps/web/src/workflow/graphEdit.test.ts` | 9 | Add, connect, disconnect, reorder, branches, palette from registry, forbidden literals |
| `apps/web/src/workflow/workflowScreen.test.tsx` | 5 | The real App at `/workflow` on desktop and phone |
| `apps/web/src/workflow/exerciseRuntime.test.ts` | 9 | Claims, architecture from the learner, BUILD IT, FIX IT, REBUILD BLIND graded from runs |
| `apps/web/src/conversations/conversationsScreen.test.tsx` | 1 | Reply releases a wait |
| `apps/web/src/playground/{unlocks,playgroundScreen}.test.ts(x)` | 5 | Unlock rule, screen |
| `apps/web/src/academy/academy.test.tsx` | 18 | Inline simulation is engine output (extended) |
| `apps/web/src/exercise/{exercise,authoredGrading}.test.ts(x)` | 41 | Runner offers Run it, weighted scores, dimensions block (extended) |
| `apps/web/src/styles/designRules.test.ts` | 20 | Rail token, no eyebrow, no monospace (extended) |

Total: 923 tests in 69 files. Phase 12 added 122 tests and 8 files.

## 49. Browser probes

`npm run review:workflow` (14 sections, PASS): desktop present, edit/undo/redo/save,
keyboard move, drag move, run and replay, reduced motion, 500 events, wait released by the time
machine, conversations, playground, 1024, 768, 390, 320.

| Measurement | Value |
|---|---|
| Drag frames (90) | mean 16.5 ms, p95 17 ms, max 17 ms, none over 50 ms |
| Playback frames (221) | mean 16.7 ms, p95 16.8 ms |
| 500-event run | 504 events, compute 71 ms in the Worker, p95 43.5 ms, max 87 ms, no long task over 100 ms |
| Reduced motion | dot transition 0.00001 s, end state at once |
| Canvas / node luminance | 0.06 / 1.00 |

`npm run review:rail` (PASS): rail 80 px wide and full height at 768, 1024 and 1440 with the page
starting at x = 80; a 64 px bottom bar at 390 and 320 with all seven areas visible and 44 px
targets; no horizontal overflow at any width.

Holographic probe re-run on the Skill Map on the same build: follow t63 60 ms, settle t95 440 ms,
tracking cleared at 880 ms, reduced motion tokens 0, touch `pan-y`, no regression from Phase 11.

Existing probes (crm-review, keyboard, touch, simulator, exercise, learning, academy, offline,
sync) re-run: no regressions.

## 50. Known limitations

State transfer to the Worker grows with run size (the whole run crosses on every op). The
late-booking `after:` clause is not evaluable. The help centre could not be read directly. Calls
and other channels are not in Conversations. The Playground sandbox has one scenario. Waits for
trigger link clicks and email events are not modelled. See KNOWN_LIMITATIONS for the full list.

## 51. Exact Phase 13 boundary

Phase 13 owns the Funnel Lab: forms and pages connected to the CRM and to workflows through the
same command and event path. Nothing in Phase 12 builds a form or a page. Any later phase can
enrol a contact, save a definition or move time by calling `workflow/commands.ts` without
importing a screen, and any Lab can fire a workflow by processing the event the trigger adapter
listens to.
