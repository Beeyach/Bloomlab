# Phase 14 — Calendar Lab

Reviewed 2026-09-05, against `main` at `fe02f857` plus the Phase 14 branch.
Requirements: **CAL-001** (P1) and **CAL-003** (P0). CAL-002 stays `NOT_STARTED` for Phase 25.

## What was built

A calendar is now configuration the shared account holds, and one engine turns that configuration
into bookable times. Everything a learner can change has a consequence they can watch: change the
duration, the working hours, a buffer, the minimum notice or the team, and the schedule beside the
controls redraws from the engine's own answer.

The whole appointment lifecycle is real account events. A booking is `APPOINTMENT_BOOKED` through
the Phase 12 execution door; confirming is `APPOINTMENT_STATUS_CHANGED`; moving is
`APPOINTMENT_RESCHEDULED`; cancelling is `APPOINTMENT_CANCELLED`. Each one goes through the same
reducers, the same validation and the same workflow reactions as anything else in the account.

## The gap CAL-003 exposed

`APPOINTMENT_CANCELLED` never reached the Appointment Status trigger. The adapter listened to
`APPOINTMENT_BOOKED`, `APPOINTMENT_RESCHEDULED` and `APPOINTMENT_STATUS_CHANGED` and nothing else,
so a workflow filtered to Cancelled — which is exactly what a no-show recovery workflow is — could
never run through the shared engine. Cancellation only pulled contacts *out* of workflows.

That is fixed rather than worked around (D-131): the adapter listens to all four events and a
cancellation exposes the status `cancelled` to filters. The ordering was already right and is now
asserted rather than assumed — the appointment-scoped exits are produced before any enrolment, so
the reminder is pulled out first and the recovery workflow starts after it, and a run enrolled by
a form trigger is untouched. `CANCEL-001` pins all of it, and every enrolment in that fixture is
asserted to carry `origin: generated` and `source.kind: workflow_trigger`, so a hand-written
enrolment would fail the test. No test in this phase injects `WORKFLOW_ENROLLED`.

## One engine, asked by both Labs

Phase 13's `bookableSlots` in `funnel/visit.ts` computed the next three openings on the hour inside
a hardcoded nine-to-five day, and its own comments said Phase 14 owned the real thing. It is
retired: the funnel's calendar block asks the shared engine, and a funnel booking arrives carrying
the host and the length the engine assigned (D-129).

The probe proves this end to end rather than by inspection. Section `funnel-shares-the-engine`
opens the Calendar Lab on the funnel scenario, sets two days of minimum notice on the consultation
calendar, saves, then opens the Funnel Lab on the same run, builds a booking step with a calendar
block, and reads the visitor's own time picker: every option honours the notice, and the first one
is the same instant the Calendar Lab was showing.

## Buffers, and why 10:45

A buffer is padding around an appointment, and a slot is refused when either side's padding reaches
the other's real time. That is what makes HighLevel's own worked example come out right: a
10:00–10:30 appointment on a calendar with a fifteen-minute buffer leaves **10:45** bookable, not
11:00, because two paddings never have to clear each other. Padding both sides symmetrically would
have produced 11:00 and contradicted the documentation.

Pinned by `BUFFER-001` and by the probe's `buffers` section, which reads it off the live schedule.

## Round robin

Deterministic and explainable, never random. Optimize for Availability gives the booking to the
first free member in the order the learner arranged the team; Optimize for Equal Distribution gives
it to whoever holds fewest bookings on that calendar in the slot's own month, ties broken by the
same order and then by id. Every slot carries the host and the reason, and the Lab prints both.

The nuance HighLevel adds to equal distribution — temporarily limiting a member who runs too far
ahead — is not simulated, and the registry record says so rather than the label implying otherwise.
The official names are used because the simulated rules are close enough to teach them; a homemade
rotation under an official name was refused.

## Contact owner is not the appointment host

Three separate references (D-130). The scenario is built to show it: Nadia is owned by Priya and
hosted by Theo. A host the account does not have, and a host who does not work on that calendar,
are both refused by the reducer; a dangling one is refused by scenario validation and by the
content schema at authoring time.

## History stays history

An appointment records the length, host, service, location and booking channel it was made with
(D-128). Changing the calendar from thirty minutes to forty-five does not lengthen yesterday's
appointment. `CALDEF-001` replays a create, an update and a booking and compares the history hash.

## Verification

- **1139 tests in 79 files** (was 1036/75). 103 new.
- **Twelve new regression fixtures**: `SLOT-001`, `BUFFER-001`, `NOTICE-001`, `ROBIN-001`,
  `ROBIN-002`, `RESCHED-002`, `RESCHED-003`, `CANCEL-001`, `CANCEL-002`, `STATUS-001`,
  `STATUS-002`, `CALDEF-001`.
- **`npm run review:calendar`: 22 sections, all PASS** in headless Chromium against the production
  build. Every setting is changed through the Lab's own controls and the schedule is read back from
  the slot buttons; the lifecycle is driven end to end and the account's event chain is read after
  each step. Five review widths with keyboard, touch and reduced motion.
- `review:funnel` (16 sections), `review:rail`, `review:crm`, `review:crm-review`: PASS.
- `npm run ci` clean: typecheck, lint, format, 1139 tests, docs validation, content check, build.
  `/calendar` is its own lazy chunk (42.5 kB, 12.5 kB gzipped).

### The slot / conflict matrix

| Case | Where |
|---|---|
| Inside and outside the weekly window | `calendar.test.ts`, `SLOT-001` |
| An appointment that would cross closing time | `calendar.test.ts`, `SLOT-001` |
| A day with no working hours, reported as valid | `calendar.test.ts` |
| Booking window exhausted | `calendar.test.ts` |
| Duration changes the next possible time | `calendar.test.ts`, probe `duration-changes-availability` |
| Pre buffer, post buffer, both, neither | `calendar.test.ts`, `BUFFER-001`, probe `buffers` |
| Notice below, exactly at, and beyond the boundary | `calendar.test.ts`, `NOTICE-001`, probe `minimum-notice` |
| Notice crossing midnight | `calendar.test.ts`, `NOTICE-001` |
| Overlap refused; adjacent allowed with no buffer | `calendar.test.ts`, `BUFFER-001` |
| A cancelled appointment stops blocking | `calendar.test.ts`, `CANCEL-002`, probe `cancellation` |
| A reschedule releases the old time and takes the new | `calendar.test.ts`, `RESCHED-002`, probe `reschedule` |
| One host busy on another calendar | `calendar.test.ts`, `ROBIN-001` |
| Round robin: two free, one free, none free, none on the calendar | `calendar.test.ts`, `ROBIN-001` |
| Equal distribution and its tie-break, repeated | `calendar.test.ts`, `ROBIN-002` |
| Staff selection honoured, and ignored when off | `calendar.test.ts`, probe `staff-selection` |
| Calendar zone different from the account's | `calendar.test.ts` |
| DST: the working day stays at nine either side of the change | `calendar.test.ts` |
| Service length and eligible staff | `calendar.test.ts`, probe `service-behaviour` |
| Location reaches the appointment | `calendar.test.ts`, `chain.test.ts` |

### The CAL-003 matrix

| Case | Where |
|---|---|
| Customer booking enrols Customer Booked Appointment | `calendar.test.ts`, `chain.test.ts`, probe `booking` |
| Staff booking does not | `calendar.test.ts`, `chain.test.ts` |
| A staff booking stays one through a reschedule | `calendar.test.ts` |
| Confirmed enrols the matching Appointment Status workflow | `STATUS-001`, probe `confirmation` |
| An unchanged status fires nothing and ends nothing | `STATUS-002` |
| Cancellation exits the appointment-scoped run, then enrols recovery | `CANCEL-001`, probe `cancellation` |
| A form-triggered run survives a cancellation | `CANCEL-002`, `chain.test.ts` |
| Reschedule exits the old run and the new wait uses the new time | `RESCHED-002`, `chain.test.ts` |
| A cancelled appointment cannot be rescheduled | `RESCHED-003` |
| Replay rebuilds definitions, appointments and enrolments | `CALDEF-001` |

## Design

Deliberately not the Funnel Lab's three permanent panels. The learner's object here is time, so the
workspace is a run of days: what is booked, what is open, in the calendar's own zone, with the
host printed under each opening. The configuration sits beside it as one group at a time — Basics,
Availability, Staff & assignment, Service & location, Booking rules — rather than five boxes
competing for attention, and it becomes a sheet on phones.

Nothing on the §70 list: no gradient hero, no card grid of settings, no fake booking analytics, no
icon beside every heading, no eyebrow, no learner-facing monospace, no emoji. Status is a word and
a pill, never colour alone. Every reorder and every action is a button; there is no drag-only path
anywhere. The 104 px rail token is untouched and the probe checks it at 768, 1024 and 1440.

## The one failure, unchanged from Phase 13

`review:workflow` → `five-hundred-events` → `noFrameOver100ms`, `p95Under50ms` and
`noLongTaskOver100ms`: max frame 165 ms, mean 19 ms, p95 57 ms, engine compute 87 ms for 504
events, against a 100 ms ceiling.

Not this phase, and not this branch. Phase 13 established that pre-Phase-13 `main` reproduces the
same numbers in the same container across three runs (104, 163, 131 ms). It is the shared,
throttled build environment. **PERF-002 must not be claimed for this scenario from container
evidence** — it needs one run on the reference desktop.

## Needs your eyes

The 1440 composition on the Mac. The schedule is a `repeat(auto-fit, minmax(9rem, 1fr))` run of day
columns above the booking and appointment panels, with the configuration in a 22 rem column beside
it. Screenshots in `.review/calendar-1440.png`, `calendar-round-robin.png`,
`calendar-lifecycle.png` and the four narrower widths. Whether seven day columns is the right
density at 1440, or whether a five-day working week reads better, is a judgment a screenshot cannot
settle.

## Registry

`GHL-CAL-CALENDARS` keeps fidelity **B** — deliberately not promoted to A. Three calendar families
are simulated with real availability, assignment and service behaviour, and the record now names
what is still absent: date-specific hours, linked and conflict calendars, Look Busy, per-day and
per-slot limits, calendar groups, recurring appointments, Class Booking, Collective, Group and Event
calendars, resources, and payment at booking.

`GHL-WF-APPOINTMENT-STATUS` and `GHL-WF-CUSTOMER-BOOKED-APPOINTMENT` were re-verified and both keep
fidelity A. The Rescheduled status is **not** offered and the conflict between the two official
articles is recorded rather than resolved (D-132) — that is the one piece of HighLevel behaviour
this phase could not settle, and it needs the articles opened directly.

All three were checked on 2026-09-04 through search-result summaries, because the build
environment's proxy rejects `help.gohighlevel.com` with a 403 at the CONNECT. Each record's
`verification_note` says exactly that. Fourth phase under that constraint.

## Versions

Simulator `2026.09.09-r1` (the calendar model, the availability engine, appointment context,
definition events, the trigger fix), content `2026.09.09`. App version, mastery rules and the
exercise grader untouched — Phase 14 adds no exercise family, as the handoff asked.

Phase 15 has not been started.
