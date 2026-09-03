# SIMULATOR SPEC

Derived from `BLOOMLAB_MASTER_SPEC.md` §26, §41–§61, §97, §133 and TA§19–§30, §74. Requirement IDs: SIM-*, WFL-*, CRM-*, FUN-*, CAL-*, CONV-*, PAY-*, REP-*.

## 1. Principle (SIM-001)

Bloomlab contains **one shared fake GHL account model**. Labs are not separate mini-games. A form submitted in Funnel Lab can create a CRM contact, populate fields, fire a workflow, create an opportunity, send simulated SMS, create an appointment and affect reporting. This is critical.

## 2. Package and transition model (SIM-002, SIM-003)

`packages/simulator-core` is a deterministic TypeScript engine completely separate from React. React displays it; React never contains simulation rules.

```text
State + Event + Configuration → Transition → New State + Generated Events + Execution Records
```

`applyEvent(state, event)` is pure. It never: calls Claude · mutates browser globals · depends on system time · generates uncontrolled randomness · performs network requests. This is what makes the simulator testable.

## 3. Account model (SIM-004)

Supported progressively; schema designed for expansion:

account · users · contacts · companies · tags · custom fields · custom values · opportunities · pipelines · appointments · calendars · forms · surveys · products · payments · conversations · workflows · workflow runs · tasks · notes · analytics · event log.

## 4. Event catalogue (SIM-005)

```text
CONTACT_CREATED  CONTACT_UPDATED  TAG_ADDED  TAG_REMOVED
FORM_SUBMITTED  SURVEY_SUBMITTED
APPOINTMENT_BOOKED  APPOINTMENT_RESCHEDULED  APPOINTMENT_CANCELLED  APPOINTMENT_STATUS_CHANGED
SMS_SENT  SMS_RECEIVED  EMAIL_SENT  EMAIL_OPENED
OPPORTUNITY_CREATED  OPPORTUNITY_UPDATED  PIPELINE_STAGE_CHANGED
PAYMENT_RECEIVED  PAYMENT_FAILED  REFUND_ISSUED
TIME_ADVANCED
WORKFLOW_ENROLLED  WORKFLOW_STEP_COMPLETED  WORKFLOW_EXITED
WEBHOOK_RECEIVED  WEBHOOK_RESPONSE
```

`EMAIL_OPENED` is included per TA§21 (D-006). Where the UI represents a real GHL feature it uses exact real GHL terminology (GHL-010).

## 5. Clock, scheduler, Time Machine (SIM-006 … SIM-008)

Every scenario has its own deterministic clock: `simulation_time` (e.g. `2026-09-02T10:00:00`), `timezone` (e.g. `America/Los_Angeles`), `scheduled_events` (priority queue). Graded behavior never depends on wall-clock time.

Time Machine actions: **+1 minute · +1 hour · +1 day · Next Event**. Next Event advances the clock to the earliest queued event. The current simulated date/time is always clearly shown.

```text
10:00 FORM_SUBMITTED
10:00 WORKFLOW_ENROLLED
10:00 SMS_SENT
15:00 WAIT_COMPLETED
15:00 IF_ELSE_EVALUATED
```

This needs zero AI and enables deterministic testing of waits, reminders, appointment-relative timing, business hours, delays, follow-up, recurring behavior.

## 6. Event Injector (SIM-009)

Scenario-defined events the learner or exercise can inject: contact reply · tag added · appointment cancellation · appointment reschedule · payment · form submission · opportunity movement.

## 7. Execution log (SIM-010)

Every run records: trigger · data · step · start · completion · branch result · skipped action · waiting · failure · exit reason. This powers troubleshooting, Fix It exercises and the execution timeline.

## 8. Realistic failures (SIM-011)

Simulate: missing phone · DND · invalid webhook auth · missing field · unavailable appointment · duplicate enrollment · bad condition · workflow loop · integration failure. Teach observable symptoms before giving fixes.

## 9. Determinism, snapshots, workers (SIM-012, SIM-013, SIM-014, SIM-018)

- **Seeded randomness:** scenarios that need probability (e.g. simulate 100 visitors) specify `seed`; identical inputs produce identical results for grading.
- **Snapshots:** state is saved as initial scenario + event log + periodic checkpoints, giving undo, rewind, replay, reset, troubleshooting, reproducible grading. The complete state is not serialised after every tiny event.
- **Web Worker:** heavier execution (workflow runs, traffic simulation, timeline replay, analytics) runs off the main thread so the UI never blocks.

## 10. Workflow definition and registry (SIM-016, WFL-011, GHL-004)

```text
workflow: id, name, trigger, trigger_filters, nodes[], edges[], settings
node:     id, type, ghl_feature_id, config, position
```

Layout and behavior are separate. Available triggers and actions come from the GHL feature registry (`content/ghl-features/`), never from hardcoded lists. Each feature has fidelity **A** (close reproduction: fields, tags, pipeline state, simple workflow logic) · **B** (training-equivalent, simplified internals) · **C** (conceptual demonstration) · **REAL_GHL** (not simulated; learner practices in real GHL). Approximations are labelled. No fictional native functionality.

## 11. Labs

### Workflow Lab (WFL-001 … WFL-012) — flagship

Desktop: canvas · toolbar · inspector · execution timeline. Operations: add trigger, filter, action, Wait, If/Else, branches, reorder, connect, undo, redo, run test, inspect history.

Real GHL mechanics: anything shown as Appointment Status, Send SMS, Wait, etc. maps to a real current GHL function or is clearly marked as an approximation. No made-up native actions.

Test contact: use an existing simulated contact or generate one; run it visibly through the workflow showing current node, current values, branch result, timeline events.

Node design: action type · real feature name · concise configuration · status. Full settings live in the contextual inspector, not on the canvas.

Semantics required: wait logic (fixed delay, appointment-relative, time/date, business hours, event waiting, timezone, late enrollment) · branching (If/Else, AND/OR, comparisons, dynamic values, fallback, multiple paths) · re-entry (duplicate enrollment, repeated triggers, overlapping workflows, duplicate messages, exits; race conditions later).

Mobile: a structured vertical / drill-down flow editor — not a shrunken canvas — that still supports configuring steps, inspecting branches, testing, reviewing execution, editing.

Visuals: dark ink workspace, light clean nodes, aqua/blue active execution; not neon hacker software.

### CRM Lab (CRM-001 … CRM-005)

Contacts · fields · tags · opportunities · pipelines · assignments · activity history · notes · tasks; companies and custom objects later; smart lists later. Poor architectural choices are allowed when technically possible so later consequences teach why they were poor. High density on desktop; stage view / deliberate local horizontal scroller on mobile.

### Funnel Lab (FUN-001 … FUN-004)

A conversion architecture simulator, not a page-builder replacement. Supports funnel steps, page structure blocks, forms, surveys, calendar, checkout concepts, mobile/tablet/desktop preview, simulated visitor. Modes **BUILD · PREVIEW · SIMULATE**. Submitting a form creates real simulated CRM data and fires workflows. Funnel Autopsy exposes traffic source, conversion rate, scroll behavior, form completion, booking rate, drop-off.

### Calendar Lab (CAL-001 … CAL-003)

Progressively: duration · availability · buffers · minimum notice · staff · assignment · round robin · services · locations · confirmation · reschedule · cancellation; advanced resource rules later. Booking events fire workflows.

### Conversations Lab (CONV-001)

Simulated SMS and email; call events and other channels later. Replies can affect workflows.

### Payments Lab (PAY-001) — later

Product · price · one-time · subscription · payment link · invoice · failed payment · refund. Payment events fire workflows.

### Reporting Lab (REP-001 … REP-003)

Calculated from actual simulator data: leads · conversion · booking rate · show rate · close rate · revenue · pipeline value · source performance · response rate · time to contact. Trains diagnosis. No fake analytics anywhere.

### Playground (SIM-015)

Once a feature is unlocked it stays available for free experimentation. No assigned exercise is required to use the simulator.

## 12. Regression suite (SIM-017)

Mandatory. Every simulated GHL behavior gets fixtures with stable IDs, e.g.:

```text
WAIT-001   fixed wait
WAIT-002   appointment-relative wait
WAIT-003   late enrollment
WAIT-004   cancellation during wait
ENROLL-001 duplicate enrollment blocked
BRANCH-001 If/Else with AND/OR
REM-001    cancelled appointment receives no reminder
```

Every bug fix adds a regression fixture. If a change to the wait engine breaks `WAIT-003`, CI fails. This is how "one fix broke three old exercises" is prevented.

## 13. Versioning (SIM-019)

The simulator carries its own `simulator_version`. Attempts record it alongside `app_version` and `content_version`.

---

## 14. Implemented architecture (Phase 10)

What the engine is, as built. This section records decisions the spec left open; where it and the
sections above differ in detail, the sections above state the requirement and this states the
implementation.

**Package.** `packages/simulator-core`, pure TypeScript, importing nothing outside its own
modules. A source-level test enforces the absence of React, the DOM, IndexedDB, Dexie, Cloudflare,
`fetch`, Claude, `Math.random()`, `Date.now()` and any read of the machine's timezone.

**Transition.** `applyEvent(account, event, state) → { account, records, generated }` is pure and
never mutates its input. `processEvent(state, pending)` owns identity, order and the log, and
feeds generated events back through itself breadth-first, so a generated event travels the same
path as an injected one. There is no second route into the state.

**Event envelope.** `id` (`ev-<run>-<sequence>`, deterministic), `type`, `at` (simulator time),
`sequence` (total order), `payload`, `origin` (`scenario` · `injected` · `generated` · `clock`),
`source` (what produced it, and what caused it), `run_id`, `scenario_id`.

**Names.** The catalogue keeps the spec's names; content and the grader address the same events in
the dotted lower-case form, one deterministic transformation away (D-076).

**Clock.** ISO instants carrying their offset. A minute and an hour are absolute durations; a day
is a calendar day in the scenario's zone, so 09:00 stays 09:00 across a daylight-saving change.
Zones are data and are validated; nothing reads the device.

**Scheduler.** Total order of (timestamp, insertion sequence, stable id) — D-077. The queue's
insertion counter is separate from the event sequence so queuing never shifts event identity.

**Cascade safety.** 500 events per operation, then an explicit `CASCADE_LIMIT` carrying the trail.
Nothing is silently dropped (D-078).

**Execution log.** `ExecutionRecord` with a stable id, the run, simulator time, the shared
sequence, a `kind` from the nine categories, workflow / run / node / contact / event references,
structured `data` and a machine `reason`. The interface derives words; the log stores facts.

**Randomness.** mulberry32, state carried in the run, position preserved across a snapshot
(D-081).

**Snapshots.** Authored scenario + append-only event log + a checkpoint every 25 events, each
hashed and validated on restore (D-080).

**Replay and rewind.** Replay re-runs only root events and regenerates consequences, so ids can
never duplicate; `rewind` is replay to an earlier index, which is what undo means here (D-079).

**Reset.** Rebuilds from the authored scenario. The content object is never mutated.

**Persistence.** Outside the core: `sim_projects`, `sim_events` and `sim_snapshots` on the
existing local-first sync path (D-082).

**Grading.** A translation-only adapter in the app supplies state, events and references, never
architecture (D-083).

### Phase boundary

Phase 10 owns the account, the clock, the queue, the catalogue, the log and the run. It does not
execute workflows: enrolment, step completion, exit and refused re-entry are recorded as entities
and events, but nothing walks a contact from node to node, evaluates a branch or serves a wait.
That is the Workflow Lab (Phase 12), which is also where the Playground (SIM-015) and the Web
Worker (SIM-014) belong. The realistic-failure library (SIM-011) is Phase 15; the two failure
conditions Phase 10 enforces — a contact with no phone, and do-not-disturb — are properties of an
outbound message, not of that library.
