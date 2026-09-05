# Phase 15 — Troubleshooting and Reporting

Reviewed 2026-09-06, against `main` at `6c03b853` plus the Phase 15 branch.
Requirements: **SIM-011**, **DES-013**, **EXR-010**, **FUN-004**, **REP-001**, **REP-002** (all P1)
and **REP-003** (P0, cross-cutting).

## What was built

Two things, and they lean on the same rule: a number a learner reads has to come from somewhere,
and a broken system has to break for a reason.

The Reporting Lab computes ten metrics from an account's own event log. Nothing is seeded. The
training account holds three weeks of Glowhaus as 269 scheduled events — visits from three sources,
forms filled in, appointments booked and shown and missed, deals won and lost, one refund, one
failed payment, two people nobody ever called — and the Lab's Run the window advances the account
clock through the ordinary execution door until those events have happened. The report is a
projection over what came out.

The Incident Room holds nine cases, one per failure SIM-011 names. Each one is a scenario that
produces the fault through engine behaviour, not a case file describing a fault the engine cannot
actually cause. The page shows the symptom, the client's own words, the execution logs and the
system state, and never names the failure mode.

## The number and its evidence

Every metric value carries its numerator, its denominator, the definition it was computed under and
the ids of the events behind it. On the page each row has two disclosures: **Show calculation**,
which prints the rule and the two numbers, and **Open the evidence**, which lists the events. That
is what makes it a reporting lesson rather than a dashboard: a learner can disagree with a figure
and go and look.

A rate over a zero denominator is `null`, everywhere, and reads **Not enough data**. Nothing in the
product prints 0% for a percentage of nothing.

`METRIC_DEFINITIONS` is the only place the ten rules live, and one source-level test fails the build
if any learner-facing module works out a rate of its own. That test found a real one: the Lab's
source table divided leads by visits instead of reading the report. `SourceRow` now carries
`conversion` and the screen reads it.

## The three-week account

Authoring this was the largest single piece of the phase, and it is what REP-001 actually asks for.
The alternative — an account with `leads: 14` written into it — would have produced numbers that
agree with themselves and with nothing else.

What the window produces, all of it reconciled in tests against the events behind it:

| Metric | Value | Denominator |
|---|---|---|
| Leads | 14 | — |
| Visit to lead | 14 / 40 | visits |
| Booking rate | 11 / 14 | leads |
| Show rate | 4 / 9 | appointments whose time has passed |
| Close rate | 3 / 4 | consultations shown |
| Revenue collected | 1,680 | — (2,160 taken, one 480 refund) |
| Open pipeline | 2,160 | — |
| Response rate | 5 / 12 | leads messaged |
| Time to first contact | 6 min (median) | leads contacted at all |
| Source performance | 3 rows | visits per source |

Two contacts were never contacted — one has no phone, one is on do-not-disturb — and the speed panel
says so by name rather than averaging them in as a zero.

Show rate is the bottleneck, which is what the graded exercise asks the learner to find. Close rate
is the trap: 3 of 4 is a good close rate, and a learner who reads the raw count of won deals instead
of the rate names it. That is a critical failure in the exercise, not a lost point.

## Nine failures, none of them staged

| Failure | How the engine produces it | Fixture |
|---|---|---|
| Missing phone | The SMS step is skipped because the contact has no number | `PHONE-001` |
| DND | The send is refused by the contact's own setting | `DND-001` |
| Invalid webhook auth | The endpoint answers 401 to the wrong credential | `WEBAUTH-001` |
| Missing field | A merge field resolves to nothing and the gap goes out | `FIELD-001` |
| Unavailable appointment | A round-robin calendar with no staff offers no slot | `SLOTS-001` |
| Duplicate enrolment | A second enrolment is refused while the first is active | `REENTRY-001` |
| Bad condition | A valid condition compares against a tag the account renamed | `CONDITION-001` |
| Workflow loop | Two workflows re-trigger each other until the engine stops one | `LOOP-001` |
| Integration failure | The endpoint accepts the credential and fails anyway | `INTEGRATION-001` |

Three of these needed the engine to gain behaviour it did not have. External services are now
account configuration: an endpoint with a URL, an expected credential, an ok status and an optional
outage, answering deterministically with no request leaving the browser. Credentials are checked
before the outage, so a wrong token answers 401 even while the service is down and the two failures
stay distinguishable. Header names are recorded on the execution record; values never are.

## The loop, and what it cost

HighLevel's builder has no edge back to an earlier step, and Bloomlab's graph validation refuses one
for the same reason. So the loop a real account suffers is two workflows triggering each other: this
one adds a tag that enrols the contact in that one, which adds a tag that enrols them back.

Stopping it at the engine's global cascade limit would have been easy and useless — a `CASCADE_LIMIT`
abandons the whole operation and leaves a diagnostic, so there is nothing left to inspect. It is
stopped at the enrolment instead: one enrolment refused, a `workflow_loop` failure recorded with the
count and the workflow on it, and the account left standing.

The first version of that bound counted enrolments sharing an account instant, and it broke the
Workflow Lab. A Test Contact run never moves the account clock, so ninety test runs share one
instant and the eleventh was called a loop. `review:workflow` caught it: `five-hundred-events` could
only reach 225 events in 90 clicks, and both phone widths lost their timeline. Gating on generated
enrolments did not fix it either, because a test fires a trigger and the enrolment it produces is
generated too. The bound now counts enrolments in one chain of `caused_by`: one for a test, and
growing without end for a loop. Two tests pin it, running the same workflow twenty-five times by
hand and through its trigger.

That is the honest sequence: the probe found a regression I introduced, and the fix is a different
rule rather than a looser one.

## Two engine bugs the incidents exposed

**An injected booking fired no appointment trigger.** Both trigger matchers read `appointment_id`
off the event, but a booking that does not name one has its id minted by the reducer. So a scenario
booking an appointment created it and started nothing. `appointmentIdOf` derives the id exactly as
the reducer does, and both matchers use it. Pinned by `BOOKING-001`. Phase 12 behaviour, corrected.

**Scenario validation assumed everything existed at t0.** A three-week history creates contacts,
appointments and opportunities as it goes, and the validator rejected every reference to them. It
now walks the scheduled events in queue order and remembers what each one creates before checking
the next. A genuine dangling reference still fails.

## Independent post-completion audit

A second code pass after the first green PR head found three correctness gaps and fixed them before
merge.

**Reporting missed id-less bookings.** D-145 made the reducer and appointment triggers agree on the
deterministic id `appt-<event id>` when an `APPOINTMENT_BOOKED` event names no
`appointment_id`, but the reporting projection still read only the payload field. The appointment
therefore existed and its workflow ran while booking rate and the appointment cohort ignored it.
The report now uses the same `appointmentIdOf` helper as the reducer and trigger adapters.

**A booking could leak into another funnel's Autopsy.** The first projection reduced all booking
events in the account to contact ids. If the same contact was a lead on Funnel A and later booked
through Funnel B, Funnel A received the booking too. Live booking and payment actions now carry the
visit id already held by the visitor session; the Autopsy binds explicitly linked outcomes to that
visit. Older authored histories without visit ids keep a conservative one-booking-per-contact
fallback so existing scenarios remain readable (D-149).

**Injectables were validated against the future.** D-144 correctly made scheduled history
time-ordered, but the initial implementation then checked injectables against the entity set left
after all scheduled events. An action available at run start could therefore pass validation
because a later event would create its target. Injectables are now checked against the authored
starting account while scheduled events continue to build references in queue order (D-150).

These corrections are pinned by regression tests, including a reducer-minted appointment id, a
booking explicitly linked to another funnel visit, scheduled create-then-reference history, and an
injectable that wrongly depends on a future creation.

## Verification

Tests: **1192 pass**, 48 new. Ten new regression fixtures.

| Probe | Result |
|---|---|
| `review:reporting` | PASS (21 sections) |
| `review:incident` | PASS (20 sections) |
| `review:funnel` | PASS (18 sections, two new: `autopsy-lens`, `autopsy-empty`) |
| `review:calendar` | PASS |
| `review:crm` | PASS |
| `review:crm-review` | PASS |
| `review:rail` | PASS |
| `review:workflow` | FAIL, one section — see below |

Full CI gate: typecheck, lint, format check, unit tests, `validate:docs`, `content:check`, build.

Both new screens were reviewed at 1440, 1024, 768, 390 and 320, with keyboard operation, 44 px
touch targets, semantic tables, status said in words as well as colour, 16 px mobile inputs and
reduced motion. Screenshots: `.review/incident-1440.png`, `.review/incident-390.png`,
`.review/reporting-1440.png`, `.review/reporting-390.png`, `.review/funnel-autopsy.png`.

Getting 320 clean took two passes. Grid tracks default to `min-width: auto`, so a long endpoint URL
and a sentence-length button label were both deciding how wide the page was; `min-width: 0` down
every grid container, `overflow-wrap: anywhere` on the lists, and wrapping action labels fixed it.

## The one failure, unchanged again

`review:workflow` → `five-hundred-events`: mean 18.5 ms, p95 55 ms, maximum frame 130 ms, engine
compute 79 ms for 504 events, against ceilings of 50 ms (p95) and 100 ms (maximum).

Not this phase. Those numbers sit inside the range Phase 14 recorded (mean 19, p95 57, max 165,
compute 87), and Phase 13 established that pre-Phase-13 `main` reproduces them in the same container
across three runs. It is the shared, throttled build environment. **PERF-002 must not be claimed for
this scenario from container evidence** — it needs one run on the reference desktop.

## Needs your eyes

The Reporting Lab at 1440 on the Mac. The stage chain runs across the top, the metric table and the
source table sit side by side underneath, and the two disclosures per row mean the page grows as a
learner opens things. Whether ten rows plus an open evidence list is the right density, or whether
the metrics want to be two columns, is a judgment a screenshot cannot settle. `.review/reporting-1440.png`.

The Incident Room's case list. Nine cards in a `repeat(auto-fill, minmax(20rem, 1fr))` grid, each
one a title, a symptom and a client name. It reads as a queue, which is right, but nine is a lot to
meet at once and there is no grouping by Lab or by difficulty. `.review/incident-1440.png`.

## Registry

`GHL-WF-WEBHOOK` keeps fidelity **B**, deliberately not promoted. The record now carries the
`headers` config field, and its limitations name what is still absent: GHL's authorization pickers
(Bearer, API key, Basic, OAuth2, including token refresh through Global Workflow Settings), query
parameters as their own rows, and the fact that responses come from the scenario's own endpoint
profile rather than a live service.

Checked on 2026-09-06 through search-result summaries of the official Custom Webhook article,
because the build environment's proxy still rejects `help.gohighlevel.com` with a 403 at the
CONNECT. The record's `verification_note` says exactly that. Fifth phase under that constraint.

## Not done

**INF-015 stays `NOT_STARTED`.** `AUDIT_REPORT.md` does not exist in the repository. The §141 audit
is an independent pass with no coding, covering ten categories, and writing one in the same session
that wrote the code would not be independent. The one category this phase does close is fake data:
REP-003 is enforced by a test rather than by an audit note that goes stale.

## Versions

Simulator `2026.09.11-r2` (visit telemetry, external endpoints, loop and node-visit bounds, the
appointment trigger fix), content `2026.09.11`. App version, mastery rules and the exercise grader
untouched — `written` is additive, so no previously graded attempt changes.

Phase 16 has not been started.
