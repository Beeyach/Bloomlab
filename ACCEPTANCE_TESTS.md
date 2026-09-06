# ACCEPTANCE TESTS

Acceptance criteria keyed by requirement ID (see `REQUIREMENTS_MATRIX.md`). A requirement moves to `PASSED` only when every criterion listed here is demonstrated with evidence. Every non-deferred P0 and P1 requirement must appear in this file (enforced by `scripts/validate-requirements.mjs`). P2/P3 criteria are added when their phase begins.

Conventions: **Given / When / Then** where behavior is testable; checklists where review is manual. "All widths" = 1440, 1024, 768, 390, 320.

---

## Cross-cutting audits (checked at every milestone)

- **PRD-001** No route, table, component or setting exists for billing, subscriptions, instructor dashboards, student management, teams, public profiles, marketplace, classrooms or social feed.
- **PRD-004** With AI setting Off and the Worker's AI routes disabled: Academy, Skill Map, Command Center, all Labs, deterministic exercises, mastery updates, portfolio and saved progress function; only AI-graded families report "AI coaching is off".
- **PRD-009** Learning-engine packages expose learner ID on every record and no single-learner assumption is baked into schemas beyond "one learner per sync key".
- **EXR-024** Audit finds no console-only behavior, hardcoded success, placeholder, "coming soon", screenshot-only path or nonfunctional modal marked as anything other than PARTIAL; no interactive requirement replaced by a static artefact.
- **REP-003 / DES-006** Audit of every screen finds no fabricated numbers and no item from the §70 slop list.
- **RSP-001 / RSP-002 / RSP-003** Every major screen reviewed at all widths; tablet layouts are deliberate; no critical desktop capability is absent on mobile.
- **DES-017 / DES-018** Screen coverage matrix has every cell for every major screen filled with evidence; visual review notes exist per width.
- **INF-006 / INF-007 / INF-008** `wrangler` config and package manifests contain no Durable Object, Queue, Redis, Supabase, Firebase, Kubernetes or vector-database dependency.
- **SEC-001** Secret scan of repo and built client bundle finds no key material; Worker reads secrets only from bindings; D1 schema has no secret columns.
- **SEC-002** Development uses `bloomlab-dev`; no script points local/preview at production D1.
- **SEC-003** No public route or public R2 bucket serves fieldwork/portfolio screenshots.
- **FLD-002** Bloomlab runs end-to-end with no GHL credentials configured; no code path requires a GHL API token.
- **GHL-005 / GHL-010** Every UI label that names a GHL feature resolves to a registry `official_name`; grep for feature-like strings outside the registry returns none.
- **GHL-009** `KNOWN_LIMITATIONS.md` lists every registry feature with fidelity B or C and describes the difference from real GHL.
- **INF-015** `AUDIT_REPORT.md` exists at each milestone covering the ten §141 categories.

## Phase 0 — Spec package

- **INF-003** `git log` shows only conventional commit messages on `main`; `.gitattributes` enforces LF; feature work happens on short-lived branches.
- **INF-014** All twelve §163 Phase 0 files plus `CHANGELOG.md` and `docs/DECISIONS.md` exist; `node scripts/validate-requirements.mjs` exits 0; `IMPLEMENTATION_STATUS.md` follows the §139 sections.

## Phase 1 — Repository foundation

- **INF-001** `apps/web` builds with Vite + React + TypeScript; `worker/` deploys with Workers + Static Assets (no Workers Sites); dependencies include Dexie; no other hosting/DB provider appears.
- **INF-002** Directory tree matches §102 (all listed folders exist, each package has its own `package.json` and `tsconfig`).
- **INF-004** Three named environments exist in Wrangler config; dev and prod D1 bindings differ; preview deploys from branches.
- **INF-005** GitHub Actions workflow runs typecheck, lint, unit, simulator, content validation and build on PR and push to `main`; a failing step blocks deploy.
- **INF-009** `tsconfig` has `strict: true`; no `.js`/`.jsx` files under `apps`, `worker`, `packages`; lint forbids `any` without justification.
- **INF-010** A `feature_flags` module gates at least one route; a flagged-off route is unreachable in UI and by URL.
- **INF-013** `app_version` (`packages/shared`), `content_version` + content hash (the compiled bundle, D-037) and `simulator_version` (`packages/simulator-core`) are written to every exercise attempt and evidence record at write time and never rewritten.
- **DES-014** `packages/design-system` exports tokens for color, spacing, radius, shadow, motion, typography, holographic material, density, z-index, breakpoints as CSS variables.

## Phase 2 — Design system

- **DES-001** Side-by-side review against the reference confirms shared feeling (palette, iridescence, tactility) and no copied art, logo, character, illustration or composition.
- **DES-002** Design review sign-off records the six adjectives as met on the Skill Map and Command Center.
- **DES-003** Grep of `HoloMaterial` usages shows only the eight reserved contexts; standard surfaces use `Surface`/`InkSurface`.
- **DES-004** Token file contains exactly the nineteen §65 values (or documented contrast tunings within the same family with before/after hex noted).
- **DES-005** Bricolage Grotesque, Inter and IBM Plex Mono load (or documented equivalent-class substitutes); system fonts appear only in fallback stacks.
- **DES-007** Each of the eleven semantic components exists; no component named `Card` is exported from the design system.
- **DES-015** Each of the ten primitives exists with keyboard focus styles and reduced-motion handling.
- **DES-016** Component styles are CSS Modules / component CSS with variables; Tailwind, if present, is limited to layout utilities and a visual review confirms no "Tailwind template" look.
- **DES-019** Phase 2 screens use final tokens and primitives; no placeholder grey UI exists in the app.
- **HOL-001** `HoloMaterial` renders the eight layers/behaviors; toggling `prefers-reduced-motion` disables tilt and moving reflection while the pearlescent base remains.
- **HOL-002** Four variants render distinctly; legendary passes a taste review (no neon, no strobing).
- **HOL-003** Pointer move produces rotateX/rotateY within 5–7° max, reflection and sheen track the pointer; on pointer exit the card settles to neutral within 350–500 ms (measured).
- **HOL-004** On a touch device press changes reflection, drag moves it, release settles; no `DeviceOrientation` permission prompt ever appears.
- **MOT-001** Motion tokens are grouped as state, spatial, execution, reward.
- **MOT-002** Interaction transitions measure 120–300 ms; reward sequences measure 1.5–3 s and a Skip control ends them immediately.
- **MOT-003** With reduced motion enabled no element animates continuously; all reward sequences render their end state instantly.
- **MOT-004** No animation runs while its element is off-screen (IntersectionObserver check); idle CPU on the Skill Map is near zero.
- **PERF-003** Same as MOT-004 plus a visual review confirming richness does not impede reading or clicking.
- **A11Y-001** Every core flow (start session, open exercise, submit, navigate labs) completes with keyboard only.
- **A11Y-002** Focus ring visible on every interactive element in light and dark surfaces.
- **A11Y-003** Automated audit reports zero unlabeled controls/inputs.
- **A11Y-004** Contrast checks pass for text on every surface including holo variants.
- **A11Y-005** Every status indicator carries text or icon in addition to colour.
- **A11Y-007** Touch targets measure ≥ 44 px on mobile.
- **A11Y-008** Computed font size of every input on mobile ≥ 16 px.
- **A11Y-009** Every tooltip/hover-only detail has a tap/focus equivalent.

## Phase 3 — Local-first data

- **DATA-001** Network throttled to offline: creating a note, moving a workflow node and completing a deterministic exercise succeed instantly and persist across reload.
- **DATA-002** Dexie database contains the working data; `localStorage` holds at most device preferences; no custom ORM layer exists.
- **DATA-003** Install prompt appears; after install and going offline the app shell, cached curriculum and stable assets load; API responses are not served from cache.

## Phase 4 — D1 and sync

- **SYNC-001** Two browsers linked by one key show the same progress without any login screen.
- **SYNC-002** Generated key has ≥ 256 bits of entropy (code review + test); display format is grouped and human-readable.
- **SYNC-003** D1 `learners` row stores only a hash; unit test confirms `SHA-256(secret + pepper)`; pepper is read from a Worker secret binding.
- **SYNC-004** After linking, requests carry a device session token, not the master key; `devices` row has all seven fields; revoking a device invalidates its token on the next request.
- **SYNC-006** Key screen shows the recovery warning verbatim in meaning, plus Copy, Download recovery file, QR and "I saved it" confirmation.
- **SYNC-007** Dragging a node produces no sync operation; completing an exercise produces one; every synced entity carries the six sync fields.
- **SYNC-008** Unit tests: evidence from two devices merges to the union; progress record takes highest revision; simulator project uses snapshot semantics.
- **SYNC-009** Editing the same project on two devices offline then reconnecting shows the "Two versions were changed" chooser; nothing is discarded until chosen.
- **SYNC-010** Offline edits show "Saved on this device"; reconnecting shows "Synced" with no modal.
- **SYNC-011** Manual test log across two browser contexts (or devices) for SYNC-001/009/010 attached.
- **SYNC-012** Unit tests cover merge, revision, conflict detection and queue replay.
- **DATA-004** No D1 table stores skills, units, exercises or registry content.
- **DATA-005** Migrations create the §93 tables in the six domains, plus `notes` (D-029), and nothing else.
- **DATA-010** Wrangler config names `bloomlab-dev` and `bloomlab-prod`; migration workflow applies to dev first.
- **SEC-004** Same evidence as SYNC-003.

## Phase 5 — Content engine

- **CNT-001** Grep of `apps/web` finds no lesson prose or exercise definitions in TSX.
- **CNT-002** All eleven `content/` folders exist.
- **CNT-003** Structured files are YAML; prose files are MD/MDX; the compiler rejects other formats.
- **CNT-004** A Zod schema exists per content type and is exercised by tests.
- **CNT-005** Fixture tests prove the build fails on: duplicate ID, missing prerequisite, missing skill ref, missing GHL feature ref, missing client, missing scenario, missing campaign ref.
- **CNT-006** Build emits one compiled bundle; runtime never reads `content/` directly (no fs/YAML parser in the client bundle).
- **CNT-007** Compiled bundle carries `content_version`; attempts store it.
- **CNT-008** `ClientSchema` requires all fifteen §38 fields.
- **CNT-011** CI content job runs the fixture tests above.
- **CUR-001** Campaign files contain only skill IDs; a test rejects inline skill definitions.
- **CUR-016** Every skill has one of the ten territories; the compiled graph reports all ten present.
- **CUR-033** Content coverage matrix is emitted by the compiler and matches a hand-checked sample.
- **DATA-011** Changing a registry record's `status` or content does not alter stored attempt records (test).
- **GHL-001** Registry schema requires all eleven fields (plus `supported_configs`); missing any fails the build.
- **GHL-002 / GHL-003 / GHL-004** Enum values outside the allowed sets fail the build; a REAL_GHL feature referenced as a simulator action fails the build.
- **GHL-006** Every registry record has `source_url` pointing at official GHL documentation and a `last_verified` date; a review log records the verification.
- **GHL-007** GHL coverage matrix is emitted by the compiler.

## Phase 6 — Learning engine

- **PRD-002** No code path or content field represents a date lock; searching the UI for "tomorrow"/"come back" returns nothing; gate completion unlocks the next gate immediately in a test.
- **PRD-003** Passing a quiz-only unit does not change mastery state (test); passing an independent exercise does.
- **CUR-002** `FIELD_READY` campaign defines gates 0–12 with the §11 competencies mapped to skills.
- **MAS-001** Mastery engine emits only the eight states.
- **MAS-002** Evidence of type `quiz` alone never yields PRACTICED or higher (test).
- **MAS-003** Evidence records contain all eleven fields; missing any is rejected.
- **MAS-005** A due review does not block gate progression; a retrieval challenge appears in the next session; failing it re-queues the skill (tests).
- **MAS-006** Four session lengths produce plans using every listed input; no AI call occurs; Continue is offered at the end.
- **MAS-007** Assistance rollup computed from hint usage; UI copy contains no shaming language (review).
- **MAS-008** `packages/mastery-engine` has no React or network imports; returns the four outputs for fixture histories.
- **MAS-009** Scheduler uses the five per-skill fields; unit tests cover priority ordering.
- **MAS-011** A pass with Worked Example hints yields GUIDED, not INDEPENDENT (test).

## Phase 7 — Command Center and Skill Map

- **PRD-007** Campaign header shows "FIELD READY CAMPAIGN" and the suggested-pace copy; nothing shows "Day N locked".
- **PRD-012** Copy review of all Phase 7 screens against §158 examples.
- **PRD-013** Progress uses capabilities counts and the six state words; no XP, points or stars anywhere.
- **PRD-014** Unlocks grant capabilities, tools, clients, scenarios, Playground features or territory access; no points ledger exists.
- **DES-008** Density review: Academy low-medium, Workflow Lab medium-high, CRM high, Call Room very low, Pricing Arena medium, Skill Map high-visual/low-text.
- **DES-009** Left rail measures 68–80 px on desktop with the seven areas; no expanded sidebar exists.
- **DES-010** Home shows Continue with campaign/gate/topic/progress, plus active client, due retrieval, recent mastery, Build My Session; no vanity metrics.
- **DES-011** Skill Map renders ten territory objects with HoloMaterial. Every skill state is clearly distinguishable through its material plus a state badge, text or icon; progression into Independent, Pressure-tested and Mastered changes and escalates the material (§75); NEEDS_REFRESH stays visually distinct while preserving the earned rung's material; no status relies on colour alone (A11Y-005). Corrected from "each of the eight skill states renders a distinct material" (D-061).
- **INF-011** Throwing inside Call Room, Workflow Lab and the AI client each leaves the other environments functional (tests); local data survives a simulated sync failure.
- **PERF-001** Bundle analysis shows lab chunks split by route; opening an Academy unit does not load the Workflow Lab chunk (network panel evidence).

## Phase 8 — Academy

- **CUR-036 / DES-020** A sample unit renders typography-led sections, at least one diagram and one inline simulation embed; no unit is video + paragraph + next.

## Phase 9 — Exercise runner

- **EXR-001** Adding a new BUILD IT exercise requires only a new content file (demonstrated).
- **EXR-002** Unit tests cover all six assertion types.
- **EXR-003** Grading output groups results by the four tiers.
- **EXR-004** BUILD IT: objective shown; learner constructs in the Lab; deterministic assertions grade it.
- **EXR-005** FIX IT: symptom text shown; faulty node hidden until diagnosed; repair graded.
- **EXR-006** RUN THE LEAD: prediction captured before execution; execution animates; mismatch highlighted.
- **EXR-007** EDGE CASE: variable change applied to a passing system; learner verdict graded against actual simulator outcome.
- **EXR-008** WHAT WOULD YOU BUILD?: no feature named in the prompt; at least two authored valid architectures accepted; AI invoked only for unmatched designs.
- **EXR-009** ARCHITECTURE DECISION: choice + reasoning captured; later-level version has no multiple choice.
- **EXR-019** REBUILD BLIND: no lesson link, no step support; any hint use is recorded and reduces independence.
- **EXR-022** Three hint levels available per exercise; each use recorded with level.
- **MAS-004** An attempt with 95% score and one critical failure reports FAILED (test).

## Phase 10 — Simulator core

- **SIM-001** A form submission in one lab produces a contact, field values, workflow run, opportunity, SMS, appointment and reporting change visible in the others (scenario test).
- **SIM-002** `packages/simulator-core` has no React, DOM or network imports.
- **SIM-003** Reducer purity test: same state + event → identical output; no `Date.now`/`Math.random`/fetch in the package.
- **SIM-004** Account state type includes all twenty-two collections.
- **SIM-005** Every listed event type has a reducer and a fixture.
- **SIM-006** Scenario clock is the only time source; changing system time does not change results (test).
- **SIM-007** Four Time Machine controls work; simulated time is displayed on every simulator screen.
- **SIM-008** Next Event advances exactly to the earliest queued event (test).
- **SIM-009** All seven injectable events can be fired from a scenario and from the UI.
- **SIM-010** Execution log entries contain all ten fields.
- **SIM-012** Two runs with the same seed produce identical event logs.
- **SIM-013** Undo, rewind, replay work from checkpoints; checkpoint frequency is periodic, not per event.
- **SIM-016** Moving a node changes `position` only; execution output unchanged (test).
- **SIM-017** Regression suite exists with stable fixture IDs; CI fails when a fixture breaks (demonstrated by an intentional break on a branch).
- **SIM-018** Reset returns to the initial scenario; replay reproduces the log.
- **SIM-019** `simulator_version` is exported and recorded in attempts.
- **DES-021** No user-facing screen shows a tiny upper-case label above a heading, and the information such labels carried is still on screen somewhere sensible.
- **DES-022** No user-facing screen renders text in a monospace family, including logs, counts, IDs and code snippets.

## Phase 11 — CRM Lab

- **CRM-001** All nine capabilities usable; changes flow through simulator events.
- **CRM-003** A deliberately poor choice (e.g. tag as a field) is allowed; a later exercise surfaces its consequence.
- **CRM-004** Desktop shows dense rows; mobile shows stage view / local horizontal scroller reviewed at 390 and 320.

Evidence (Phase 11, additive): CRM-001 — `npm run review:crm` works all nine areas on the built preview and finds every change after reload, offline and reset, and `apps/web/src/crm/crmScreen.test.tsx` checks each lands in `sim_events`. CRM-003 — `EX-FIX_IT-jordan-treatment-interest` is graded from the learner's own account and fails before the fix and passes after (`consequence.test.ts`). CRM-004 — `npm run review:crm-review` audits seventeen states at 1440 / 1024 / 768 / 390 / 320.

## Phase 12 — Workflow Lab

- **WFL-001** Canvas, toolbar, inspector and timeline present at 1440 and 1024.
- **WFL-002** Each of the twelve operations works with mouse and keyboard.
- **WFL-003** Every palette item resolves to a registry record; approximations carry a visible label.
- **WFL-004** Existing or generated test contact runs visibly with node highlight, values, branch result and timeline.
- **WFL-005** Node shows the four summary elements; settings open only in the inspector.
- **WFL-006** At 390 and 320 the vertical editor supports configure, inspect branches, test, review execution, edit.
- **WFL-007** Visual review confirms ink workspace, light nodes, aqua/blue execution, no neon.
- **WFL-008** Fixtures WAIT-001..004 pass (fixed, appointment-relative, late enrollment, cancellation during wait) plus business-hours and timezone fixtures.
- **WFL-009** Fixtures for If/Else with AND/OR, comparisons, dynamic values, fallback and multi-path.
- **WFL-010** Fixtures: duplicate enrollment blocked/allowed per setting, repeated trigger, overlapping workflows, exit.
- **WFL-011** Palette is generated from the registry; a registry addition appears without code change.
- **EXR-023** Workflow grading uses the weighted rubric and critical override (test).
- **SIM-014** A 500-event run keeps the main thread responsive (frame timing evidence).
- **SIM-015** Playground exposes every unlocked feature without an exercise.
- **CONV-001** Simulated SMS/email appear in Conversations; an injected reply enrolls/exits a workflow.
- **RSP-004** Each of the six mobile recompositions reviewed at 390/320.
- **A11Y-006** Every drag interaction in the Lab has a keyboard/menu alternative.
- **PERF-002** Frame timing during node drag and execution ≥ 55 fps on the reference desktop.

## Phase 13 — Funnel Lab

- **FUN-001** All eight capabilities present; device preview switches between three widths. *Evidence: `funnel.test.ts`, `edit.test.ts`, `funnelScreen.test.tsx`, probe sections `build-core-actions`, `preview-device-switch`, `simulate-form-chain`, `simulate-booking`. Checkout is the account's own product and one payment; the Payments Lab boundary is stated in the interface and the registry (D-124).*
- **FUN-002** BUILD, PREVIEW, SIMULATE modes switch and persist. *Evidence: the mode and the preview width are read back after a remount and after a reload from the device record (D-120); probe section `mode-persists`.*
- **FUN-003** Submitting a form in SIMULATE creates a contact and fires the connected workflow (scenario test). *Evidence: `chain.test.ts` over `SC-glowhaus-funnel`, asserted on the run's own log — the generated `CONTACT_CREATED`, the enrolment the matcher decided, and the tag and text the workflow's nodes produced; probe section `simulate-form-chain`. The refusal paths are covered too, and no test injects `WORKFLOW_ENROLLED`.*
- **EXR-011** FUNNEL ASSEMBLY accepts more than one valid ordering for a scenario with multiple solutions. *Evidence: `assembly.test.ts` grades two structurally different funnels — a two-step capture-then-book and a three-step qualify-capture-book with proof on a different step — against the same authored exercise and expects both to pass; a wrong architecture fails and the critical gate holds at a full score.*

## Phase 14 — Calendar Lab

- **CAL-001** Each listed capability configurable; fixtures for buffers, minimum notice, round robin, reschedule, cancellation.
  - **PASSED (Phase 14).** Every capability is a real setting with a real consequence, changed through the Lab's own controls and read back from the schedule: duration and slot interval, weekly working hours, pre and post buffer, minimum scheduling notice, a team with an order, both round-robin distribution methods, staff selection, services that set their own length and eligible staff, meeting locations that reach the booking, and cancellation and reschedule permissions with a cutoff. Confirmation, reschedule and cancellation are real account events, not badge changes.
  - Fixtures: `SLOT-001`, `BUFFER-001`, `NOTICE-001`, `ROBIN-001`, `ROBIN-002`, `RESCHED-002`, `RESCHED-003`, `CANCEL-001`, `CANCEL-002`, `STATUS-001`, `STATUS-002`, `CALDEF-001`.
  - Evidence: `packages/simulator-core/test/calendar.test.ts`, `apps/web/src/calendar/*.test.*`, `npm run review:calendar` (22 sections, all PASS).
- **CAL-003** Booking, reschedule, cancel and status events enroll/exit workflows (fixtures).
  - **PASSED (Phase 14).** All four families reach `workflowReactions` through the shared engine. `APPOINTMENT_CANCELLED` did not reach the Appointment Status trigger before Phase 14, so a workflow filtered to Cancelled could never run; it does now (D-131). Order is asserted, not assumed: the appointment-scoped run exits before the cancellation workflow enrols, and a form-triggered run is left alone. No test injects `WORKFLOW_ENROLLED`.
  - Fixtures: `CANCEL-001`, `CANCEL-002`, `STATUS-001`, `STATUS-002`, `RESCHED-002`.

## Phase 15 — Troubleshooting and reporting

- **SIM-011** Each of the nine failure modes reproducible with a symptom shown before any fix hint.
  - **PASSED (Phase 15).** Nine scenarios, one per failure, each produced by engine behaviour rather than authored into the case file: a missing phone skips the SMS step, do-not-disturb refuses the send, a wrong credential answers 401, a merge field with nothing behind it sends the gap, a round-robin calendar with no staff offers no slot, a second enrolment is refused while the first is active, a valid condition compares against a tag the account renamed, two workflows re-trigger each other until the engine stops one enrolment, and an endpoint that accepts the credential fails anyway. The case file shows the symptom, the client's complaint, the logs and the system state, and never names the failure mode; Reproduce it re-runs the fault on demand.
  - Fixtures: `PHONE-001`, `DND-001`, `WEBAUTH-001`, `FIELD-001`, `SLOTS-001`, `REENTRY-001`, `CONDITION-001`, `LOOP-001`, `INTEGRATION-001`.
  - Evidence: `apps/web/src/incident/incidents.test.ts` (19 tests), `npm run review:incident` (20 sections).
- **DES-013** INCIDENT view shows symptom, logs, client complaint, system state; no alarm animation.
  - **PASSED (Phase 15).** The Incident Room is Inter in a table with one quiet warning rule on the client's own words. The probe checks the four parts are present, that no element on the page runs an animation, that nothing learner-facing is monospace, that a skipped step and a failure are marked by a rule and by their wording rather than by colour alone, that every target is at least 44 px, and that nothing overflows sideways at 320.
  - Evidence: `npm run review:incident` sections `case-file`, `understated`, `reduced-motion`, `width-1440` … `width-320`; screenshots `.review/incident-1440.png`, `.review/incident-390.png`.
- **EXR-010** FUNNEL AUTOPSY exposes the six data views; submission requires separate problem and hypothesis fields.
  - **PASSED (Phase 15).** `EX-FUNNEL_AUTOPSY-glowhaus-consult-traffic` opens the Autopsy lens with traffic source, conversion rate, scroll behaviour, form completion, booking rate and drop-off, all projected from the run's own visit telemetry. The exercise authors `problem` and `hypothesis` as separate fields, the schema refuses a FUNNEL AUTOPSY that authors only one, and the grader reads them separately: a problem statement that explains the cause is a critical failure.
  - Evidence: `apps/web/src/reporting/reporting.test.ts`, `npm run review:funnel` → `autopsy-lens`.
- **FUN-004** Same six data views available in the Lab.
  - **PASSED (Phase 15).** One `funnelAutopsy` projection serves both surfaces, so the Lab and the exercise cannot disagree. A funnel with no traffic says so rather than showing six zeroes.
  - Evidence: `npm run review:funnel` sections `autopsy-lens`, `autopsy-empty`; screenshot `.review/funnel-autopsy.png`.
- **REP-001** All ten metrics computed from simulator data and reconcile with the event log (test).
  - **PASSED (Phase 15).** `SC-glowhaus-reporting` holds three weeks as 269 scheduled events with no seeded totals; Run the window advances the clock through the ordinary execution door, and each metric is reconciled in a test against the events behind it: 40 visits, 14 leads, 11 bookings, 9 due, 4 showed, 5 no-show, 3 won, 1680 collected after one 480 refund, 2160 open pipeline, 12 messaged and 5 replied, median time to contact 6 minutes. Two contacts were never contacted and the report says which and why.
  - Evidence: `apps/web/src/reporting/reporting.test.ts` (22 tests), `npm run review:reporting` (21 sections).
- **REP-002** At least one reporting exercise requires a bottleneck diagnosis, graded.
  - **PASSED (Phase 15).** `EX-FIX_IT-glowhaus-reporting-bottleneck` asks which stage is losing the most and grades the answer against the same report: show rate passes, close rate is a critical failure. The Lab teaches the reasoning rather than displaying a dashboard — it opens on the stage chain, and every metric row opens to its calculation and the events behind it.
  - Evidence: `apps/web/src/reporting/reporting.test.ts`, `npm run review:reporting` sections `diagnosis-workspace`, `graded-exercise`, `calculation-disclosure`, `evidence-drawer`.
- **REP-003** (cross-cutting) No fabricated number reaches a learner-facing screen.
  - **PASSED (Phase 15).** `noFakeAnalytics.test.ts` scans every learner-facing module for a percentage or money amount written into markup and for a reporting rate computed outside the projection, and fails on either. Flag-gated developer surfaces are excluded by name. The two hits it found while being written were a bar-width ratio in the Academy diagram (kept: it is arithmetic about pixels) and the Reporting Lab dividing leads by visits (fixed by carrying `conversion` on the source row).
  - Evidence: `apps/web/src/reporting/noFakeAnalytics.test.ts` (4 tests).

## Phase 16 — Sales exercises

- **SAL-001** AUDIT IT requires a classification per finding; an unsupported VERIFIED claim loses points (test).
  - **PASSED (Phase 16).** A finding stands up only when its evidence carries it: Verified needs at least one item the learner observed first-hand, Likely needs evidence and stays labelled an inference, Unknown needs what would confirm it. Everything else is an unsupported claim, counted by `audit.unsupported_claims`, which `EX-AUDIT_IT-northwind-outside-in` requires to be zero. Confident wording changes nothing, because nothing reads the wording. The work area says so at the moment it happens rather than at submission.
  - Evidence: `apps/web/src/exercise/sales/sales.test.ts` (the AUDIT IT block: an unsupported Verified scores below a clean run of the same three findings), `npm run review:sales` → `audit-unsupported-verified`.
- **SAL-002 / EXR-012** PROSPECT IT presents ≥ 3 businesses; Skip with sound reasoning can score full marks.
  - **PASSED (Phase 16).** `EX-PROSPECT_IT-three-businesses` puts Northwind, Ridgeline and Halcyon in front of the learner with only what can be seen of each. Halcyon is right to skip and Ridgeline is a defensible Maybe, so contacting all three fails the deterministic half. A Skip with the dimensions named and the evidence cited scores 100 on that half, exactly as a Contact would. "Sound reasoning" is never the length of the reason: it is the decision the brief accepts plus evidence behind every dimension named.
  - Evidence: `apps/web/src/exercise/sales/sales.test.ts` (PROSPECT IT block, including "does not read the length of the reason"), `npm run review:sales` → `prospect-opens`, `prospect-skip`.
- **SAL-003 / EXR-014** WRITE IT cold-email rubric checks opener, evidence, relevance, problem, CTA, follow-up.
  - **PASSED (Phase 16).** `WRITTEN_COMMUNICATION_RUBRIC_V2` carries all six as data on the items, so the claim is checked rather than read. `EX-WRITE_IT-northwind-cold-email` asks for the email and the follow-up, caps both, asks each for one next step, and requires the first to cite something observed first-hand. V1 is unchanged for the attempts it judged. The rubric itself is executed by the AI gateway in Phase 19; until then the exercise reports `rubric_pending` rather than a verdict.
  - Evidence: `apps/web/src/exercise/salesCoverage.test.ts`, `apps/web/src/exercise/sales/sales.test.ts` (WRITE IT block), `npm run review:sales` → `write-cold-email`.
- **SAL-004** Discovery rubric contains all fourteen items plus technical discovery.
  - **PASSED (Phase 16).** `SALES_DISCOVERY_RUBRIC_V2` names each of the fifteen topics as data on the item that judges it, and a test walks the whole list. The authored thread makes them reachable rather than a checklist: Marcus surfaces the current process, the tools and the people in one answer, and the learner decides what to ask next.
  - Evidence: `apps/web/src/exercise/salesCoverage.test.ts` (fifteen parameterised cases), `EX-WRITE_IT-summit-written-discovery`.
- **SAL-005** Transcript with > 60% learner talk time or a pitch before diagnosis is penalised (test).
  - **PASSED (Phase 16).** Talk share is one function over the thread both sides can see, rounded to a whole percent and reported as `conversation.talk_share`: exactly 60 is not penalised, above it is. A pitch is a move the learner chose, not a guess at their prose, so `conversation.pitched_before_diagnosis` is true when the pitch turn is at or before the turn Marcus agreed on. In the discovery exercise that is a critical failure, which no score can override.
  - Evidence: `apps/web/src/exercise/sales/sales.test.ts` (the talk-share boundary, an empty thread, a pitch before and after agreement, and the failed attempt).
- **SAL-006 / SAL-007 / EXR-018** EXPLAIN IT grades the problem → consequence → system → outcome frame and flags unnecessary jargon.
  - **PASSED (Phase 16).** `EX-EXPLAIN_IT-no-show-system` asks for the owner version and the builder version as separate answers; the schema refuses an EXPLAIN IT that authors only one. Frame coverage is read from the exercise's own markers, so the learner never has to write the words "problem" or "outcome". Jargon is counted against the glossary, minus the terms marked `owner_safe`, so a no-show is not held against anybody and a custom value is.
  - Evidence: `apps/web/src/exercise/sales/sales.test.ts` (EXPLAIN IT block), `packages/content-schema/test/sales.test.ts`, `npm run review:sales` → `explain-two-audiences`.
- **SAL-008** Closing scenarios cover commitment, follow-up, ghosting, delay, next step.
  - **PASSED (Phase 16).** `EX-WRITE_IT-summit-after-the-proposal` stages all five in one thread: nine days of silence, a vague "still thinking about it", November, the decision, and the date both sides hold. A content test walks the five against the authored nodes. No pricing or negotiation mechanics: that is Phase 17 and Phase 18.
  - Evidence: `apps/web/src/exercise/salesCoverage.test.ts`, `apps/web/src/exercise/sales/sales.test.ts` (closing block), `npm run review:sales` → `thread-closing`.
- **SAL-013** WRITE IT includes update, blocker, delay, approval, revision, technical explanation prompts.
  - **PASSED (Phase 16).** All six are authored as real briefs with a reader, a cap and a next step, across the Glowhaus delivery exercises. A content test walks all fifteen written pieces EXR-014 and SAL-013 name and checks each one is asked for by an exercise rather than listed in a document.
  - Evidence: `apps/web/src/exercise/salesCoverage.test.ts` (fifteen parameterised cases), `npm run review:sales` → `write-client-communication`.
- **EXR-013** AUDIT IT UI offers only Verified / Likely / Unknown.
  - **PASSED (Phase 16).** Three radios, from one constant, with no fourth option and no "Other". The learner writes their own findings; this is not a list of prewritten claims to tick. An Unknown asks what would settle it, and only then.
  - Evidence: `apps/web/src/exercise/salesRunner.test.tsx`, `npm run review:sales` → `audit-classifications` (checks the three values and that Confirmed, Assumed, Probable, Guess and Other appear nowhere on the page).
- **CONV-002** Inbox conversation continues based on the learner's message; no "Correct." banner.
  - **PASSED (Phase 16).** Two authored threads. The client writes, the learner picks what they are doing and writes back, and the branch follows the move: asking how it works today and proposing a system reach different replies. Sending without picking a move takes the authored fallback and the client asks what was meant. The exchange survives a reload and travels with the finished attempt. Nothing says "Correct."
  - Evidence: `apps/web/src/exercise/salesRunner.test.tsx` (the thread block, including the branch, the fallback and the reload), `npm run review:sales` → `thread-branch-a`, `thread-branch-b`, `thread-fallback`, `thread-persists`, `thread-closing`.

## Phase 17 — Pricing Arena

- **PRI-001** Deal desk shows the seven areas; removing a scope item visibly changes the structure and price.
  - **PARTIAL (Phase 17).** The seven areas are there and the structural half is fully met: a removed line says what it leaves the client with, a requirement the client stated reads "Nothing left in the deal answers this" the moment the last line answering it comes out, and a line left depending on something removed is named. The price half is deliberately not met before submission. The learner sets one project fee for the whole deal, so there is no per-line price to subtract, and showing what the removed line costs to deliver is what the hidden-economics criterion below forbids. After submitting, the full economic consequence is shown: the floor moves with the scope, so the same $1,600 that is indefensible on the whole Summit build clears the floor once the migration and handover are out. Recorded in D-162 rather than settled by weakening either criterion.
  - Evidence: `npm run review:pricing` → `scope-consequences`, `reveal-after-submit`; `apps/web/src/exercise/pricingRunner.test.tsx`, `apps/web/src/exercise/pricingCoverage.test.ts`.
- **PRI-002** Scenario stores the nine economics fields; evaluation returns price, margin, scope, risk and reasoning feedback; two different defensible prices can both pass.
  - **PARTIAL (Phase 17).** All nine fields are required and stored on the scenario. Estimated labor and risk feed the pricing math directly; the other economics fields constrain the authored scenario and scope rather than each becoming a second multiplier. Price, margin, scope and risk are evaluated deterministically: a quote is checked against what the work costs, against cost plus the contingency the scenario's own risk score asks for, against the margin floor measured on revenue, and against the scope it promised. $2,200 and $3,200 both pass the Summit deal on every economic check; $1,200 fails the critical floor check and says so. Reasoning feedback is the gap: the learner's explanation is collected and preserved and the rubric is named, but nothing evaluates it until the AI gateway, so the exercise reports its deterministic score and `rubric_pending`.
  - Evidence: `apps/web/src/exercise/pricingCoverage.test.ts` (the two defensible prices, the under-floor failure, the smaller deal with a lower floor, `rubric_pending`), `npm run review:pricing` → `underpriced-fails`.
- **PRI-003** Pricing units cover all ten models.
  - **PASSED (Phase 17).** `LU-pricing-models` covers fixed, hourly, project, setup, recurring and retainer; `LU-pricing-the-number` covers margin, complexity, risk and minimum viable. The concepts are declared as front-matter data so the ten are walked by a parameterised test rather than read out of a document, and both units are real bodies with headings, a depth section and an exercise embed.
  - Evidence: `apps/web/src/exercise/pricingCoverage.test.ts` (ten parameterised cases plus a body-substance check).
- **PRI-004** Unit tests for margin, deposit, recurring and rush calculations.
  - **PASSED (Phase 17).** 32 tests over the pricing math alone, including the boundaries: rounding half away from zero and never to negative zero, a percentage over a zero denominator, a deposit expressed as a percentage and as an amount reaching the same canonical dollars, a percentage deposit that stays unset while there is no total, a deposit larger than the total, recurring excluded from the margin and its annual figure, margin measured against revenue rather than cost, the floor at exactly the cost and one dollar under it, and the rush fee agreeing with the timeline in all four combinations.
  - Evidence: `apps/web/src/exercise/pricing/pricing.test.ts`.
- **EXR-016** PRICE IT captures all eight fields; hidden economics revealed only after submit.
  - **PASSED (Phase 17).** The desk collects the scope kept, the project fee, the rush fee, the deposit, the recurring fee, the timeline, the revisions and the exclusions the learner writes, and it survives a reload with all of them. Nothing hidden reaches the page before submission: a test reads the rendered desk and fails on hours, cost, the hourly rate, a per-line price or the word margin, and the probe repeats that check at 1440, 1024, 768, 390 and 320. The reveal after submitting shows the hours, the delivery cost, the contingency, the margin and what a target margin would have needed.
  - Evidence: `apps/web/src/exercise/pricingRunner.test.tsx`, `npm run review:pricing` → `economics-hidden`, `the-eight-answers`, `reload`, `reveal-after-submit`, `width-*`.
- **SAL-009** Proposal exercise requires all eight sections.
  - **PASSED (Phase 17).** `EX-WRITE_IT-summit-proposal` asks for problem, recommendation, scope, price, timeline, assumptions, exclusions and acceptance as eight separate answers, each with its own question, reader and cap. The drill carries an explicit priced scope in its own brief and does not pretend to read a prior PRICE IT attempt. The schema refuses a proposal missing any of the eight sections and refuses two fields claiming the same section, so a half-proposal cannot be authored.
  - Evidence: `packages/content-schema/src/schemas/exercise.ts` (family rules), `apps/web/src/exercise/pricingCoverage.test.ts`, `npm run review:pricing` → `proposal-sections`.
- **SAL-016** Scope exercise covers all thirteen items.
  - **PASSED (Phase 17).** `EX-PRICE_IT-glowhaus-two-locations` covers ten in its scope lines and three in the controls the learner works with. The schema refuses an exercise that declares itself scope training while missing one, so the coverage is enforced at build time rather than asserted.
  - Evidence: `packages/content-schema/src/schemas/pricing.ts`, `apps/web/src/exercise/pricingCoverage.test.ts` (thirteen parameterised cases).

## Phase 18 — Negotiation

- **NEG-001** Hidden state fields exist in scenario data; no UI element renders them; grep confirms.
- **NEG-002 / EXR-017** All six actions available; a walk-away scenario can score high (test).
- **NEG-003** Classifier maps sample responses to the seven strategies; authored reactions exist for each; AI is invoked only when classification confidence is low (test with AI Off shows authored path).
- **NEG-004** Scenarios exist for all ten objections.
- **NEG-005** Dialogue actions change hidden state per rules (tests for the three examples).

## Phase 19 — AI gateway

- **AI-001** Code review confirms no AI call for any deterministic grade; classifier runs before LLM.
- **AI-002** Setting persists; Off disables all AI routes; default is Limited.
- **AI-003** Governor unit tests for the four spend bands; a request above the limit is refused with a clear message; limit is configurable.
- **AI-004** `ai_usage` rows carry all eight fields.
- **AI-005** Routing table maps request types to model classes; no request type defaults to the most expensive model.
- **AI-006** Invalid model output triggers one repair retry, then saves the submission and reports failure (tests).
- **AI-007** Deterministic FAILED result cannot be changed by any AI response (test).
- **AI-008** Simulated AI outage: submission, transcript and state persist; retry works; other study continues.
- **AI-009** Client bundle contains no Anthropic SDK or key; all AI calls hit `/api/ai/*`.
- **AI-010** Stable context blocks use prompt caching; per-request payload excludes the curriculum bundle.
- **AI-011** Rubric IDs carry versions; an attempt keeps its rubric version after a rubric update.
- **AI-012** `ai_feedback` stores submission, rubric version, model, result, cost, timestamp only.

## Phase 20 — Voice assets

- **VOI-001** At least one persistent client has an ElevenLabs voice configured.
- **VOI-002** Pre-generated lines for greetings, objections, interruptions, voicemail, recurring lines exist in R2 and play without a TTS call.
- **VOI-004** Registry entries carry all seven fields; a client's voice is stable across sessions.
- **DATA-006** Audio and media are in R2; D1 holds only metadata rows.
- **DATA-007** Fetching a learner asset without a valid session returns 401/403.

## Phase 21 — Call Room

- **CALL-001** Call Room shows the six elements on a dark surface; no participant grid.
- **CALL-002** Turn-based loop works end to end; no realtime streaming dependency.
- **CALL-003** Call rubric has the eight dimensions and no accent criterion.
- **CALL-005** Full call completes on a 390 px device with touch only.
- **CALL-006** Transcript saved; raw audio deletable; retention optional.
- **EXR-015** All five SAY IT modes exist.
- **VOI-006** Recording uploads through the Worker to Google STT V2; transcript displayed before evaluation.
- **VOI-007** TTS failure shows text; STT failure keeps the recording and offers retry.
- **SEC-005** Audio is sent only to Google STT (and ElevenLabs for generation); no other endpoint receives it.

## Phase 22 — Fieldwork

- **FLD-001 / EXR-020** Fieldwork flow collects screenshots, configuration answers, explanation, test results, then asks reasoning questions.
- **FLD-004** A REAL_GHL skill cannot reach MASTERED without fieldwork evidence (test).

## Phase 23 — Portfolio

- **PORT-001** Portfolio item stores all ten fields.
- **PORT-002** Every simulated item displays "Simulation Project" or "Demonstration Build"; no results/outcome claims field exists.
- **DATA-008** Export produces a versioned file containing the six data groups.

## Phase 24 — Field Ready content

- **PRD-005** A full run from placement to capstone is completed by the learner and reviewed against the §4 reasoning list.
- **PRD-006 / CUR-003** Gate 0 assesses the eight areas; strong results skip mapped early requirements.
- **PRD-008** Field Ready certificate copy lists the nine capabilities and no "expert" claim.
- **PRD-010** Skill graph tags each skill to at least one of the four identities.
- **PRD-011** Content compiler reports instruction / practical / retrieval time within ±10% of 20/60/20 for FIELD_READY.
- **PRD-017 / PRD-018** ≥ 70% of Field Ready scenarios use Bloomwired-bias industries; Bloomwired-specific units exist for ICP, offer, pricing, audits, outreach, proposals.
- **CUR-004** Gate 1 units and exercises cover customer journey, funnel purpose, traffic intent, offers, friction, CTA, conversion, funnel math, bottleneck thinking (coverage matrix non-empty for each).
- **CUR-005** Gate 2 covers lead capture, forms, confirmation, follow-up, CRM capture, pipeline, next action, with a Lead Capture build exercise.
- **CUR-006** Gate 3 covers contacts, tags, custom fields, custom values, opportunities, pipelines, assignments and includes ARCHITECTURE DECISION exercises.
- **CUR-007** Gate 4 covers triggers, filters, actions, waits, If/Else, re-entry, timing, communications, pipeline automation, with BUILD IT and FIX IT workflow exercises.
- **CUR-008** Gate 5 covers forms, surveys, qualification, calendars, routing, reminders, cancellations, reschedules, no-shows, with a Consultation Booking build.
- **CUR-009** Gate 6 covers page hierarchy, message match, CTA placement, conversion copy, proof, qualification friction, mobile conversion design, with FUNNEL ASSEMBLY and WRITE IT exercises.
- **CUR-010** Gate 7 covers workflow troubleshooting, funnel troubleshooting, logs, edge cases, metrics, pre-launch QA, bottleneck diagnosis, with FIX IT, EDGE CASE and FUNNEL AUTOPSY exercises.
- **CUR-011** Gate 8 covers ICP, prospect selection, evidence, research, outreach, cold email, follow-up, audit quality, with PROSPECT IT, AUDIT IT and WRITE IT exercises.
- **CUR-012** Gate 9 covers cold calls, discovery, Zoom-style calls, listening, questions, diagnosis, explaining systems, pitching outcomes, with SAY IT and EXPLAIN IT exercises.
- **CUR-013** Gate 10 covers scope, fixed pricing, recurring pricing, deposits, revisions, exclusions, risk, negotiation, reducing scope, walking away, with PRICE IT and NEGOTIATE IT exercises.
- **CUR-014** Gate 11 covers proposal, acceptance, onboarding, dependencies, build order, client updates, QA, handoff, with proposal and client-communication WRITE IT exercises.
- **CUR-015 / CUR-031** Capstone has no hint controls, provides all nine inputs, requires the nine actions and asks the eight reasoning questions; fieldwork step required.
- **CUR-017** Judgment items exist for all fourteen decisions; rubric rewards verified uncertainty.
- **CUR-018** Every STRATEGIZE Field Ready topic and all eleven core funnel families have at least one unit and one practical exercise; Practitioner/Advanced/Specialist tiers are tagged for Phase 25.
- **CUR-019** Every BUILD topic (conversion layout, copy, Funnel Builder, Websites, Forms, Surveys, Calendars, Payments basics) has at least one unit and one practical exercise; Funnel Builder units reference only registry features with `status: current`.
- **CUR-020** Every AUTOMATE topic (foundations, core triggers, core actions, wait logic, branching, re-entry, common systems) has at least one unit and one Workflow Lab exercise; advanced topics are tagged for Phase 25.
- **CUR-021** Every ARCHITECT topic (contacts, tags, custom fields, custom values, pipelines, opportunities, smart lists, companies, data modeling) has at least one unit and one practical exercise; the veterinary-clinic style data-modeling problem exists.
- **CUR-022** Every DIAGNOSE topic (QA protocol, workflow/funnel troubleshooting, deliverability, SMS reliability, analytics, experimentation) has at least one unit and one practical exercise; the 19-area QA protocol exists as a checklist exercise.
- **CUR-024** Every SELL topic has at least one unit and one practical exercise across PROSPECT IT, AUDIT IT, WRITE IT, SAY IT, PRICE IT, NEGOTIATE IT.
- **CUR-025** Every DELIVER topic has at least one unit and one practical exercise (proposal, change request, onboarding, build order, client communication, handoff).
- **SAL-010** A change-request scenario requires the learner to hold, re-scope or re-price; accepting unpaid scope creep is penalised (test).
- **SAL-011** Onboarding exercise requires all nine checklist items (access, credentials, domains, calendars, users, branding, copy, payment, expectations).
- **SAL-012** Build-order exercise rejects orderings that violate the dependency chain data → pipeline → calendar → forms → workflows → funnel → tracking → QA (test).
- **SAL-014** Handoff exercise requires documentation, training, ownership and support sections; missing any leaves the exercise Needs another run.
- **CUR-029** Copy exercises at higher tiers disable AI drafting.
- **CUR-030** All five starter projects exist and are completable.
- **CUR-034** Coverage matrix shows practical work for every Field Ready skill plus retrieval, pricing, negotiation, calls, written sales, proposals, prospecting and fieldwork exercises.
- **CUR-035** Field Ready path is completable end to end before any Phase 25 content is added.
- **MAS-010** Field Ready evaluation checks the ten evidence areas independently; a high average with one empty area does not pass (test).
- **EXR-021** Boss Client persists across the eleven stages; an early decision changes a later stage (test).
- **CNT-009** ≥ 20 persistent clients across the listed industries with persistent state.

## Phase 25 — Advanced curriculum

- **CUR-023** CONNECT units for every listed topic with practical exercises.

## Phase 26 — Polish

- **A11Y-010** Automated a11y job in CI; manual review log for the six areas.
- **INF-016** Each of the fourteen adversarial cases has a recorded test result.

---

## Simulator regression fixtures (SIM-017)

Fixture IDs are stable. Minimum set at Phase 12: `WAIT-001..004`, `ENROLL-001..003`, `BRANCH-001..005`, `REM-001..003` (reminders incl. cancelled-no-reminder), `TZ-001..002`, `BH-001` (business hours), `DUP-001` (duplicate messages), `EXIT-001..002`. Each bug fix adds one.

## Adversarial cases (INF-016)

offline mid-exercise · refresh mid-simulation · duplicate events · missing phone · missing email · cancelled appointment during wait · timezone change · AI timeout · AI budget exhausted · ElevenLabs failure · transcription failure · sync conflict · second device · extreme values · malformed scenario data.

## Field-Ready Complete gate (§167)

All P0 PASSED · Field Ready P1 PASSED · content validation passing · simulator regression passing · sync passing · AI fallback passing · responsive review passing · accessibility core flows passing · GHL Field Ready registry current · placement-to-capstone completable · real-GHL fieldwork recordable · design review passing · no major core interface is a stub.
