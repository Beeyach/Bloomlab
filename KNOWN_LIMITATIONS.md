# KNOWN LIMITATIONS

Honest record of approximations, gaps and mismatches (spec §140). Updated at the end of every phase. Once the simulator exists, every approximation versus real GHL is listed here per registry feature.

Last updated: 2026-09-08 (Phase 21 implementation review)

## Phase 21 — Call Room acceptance gate

- Implementation is under review with preview/production calls disabled. Preview lacks the `GOOGLE_CLOUD_CREDENTIAL` Worker secret; Google project/API/IAM and a real microphone → private R2 → Google STT → confirmed turn remain unverified. The exact secure action is in `docs/operations/call-room.md`. Existing rotated ElevenLabs preview binding is a Worker secret.
- Local browser coverage uses a virtual microphone and explicit HTTP fixtures. It establishes interaction, Blob persistence/recovery and five-width layout, not live Google/dynamic ElevenLabs/private remote recording acceptance. Physical mobile/Safari recording and assistive technology are unverified.
- There is no timed deletion sweep: unsuccessful/abandoned raw recordings remain private until resume or manual deletion. Default cleanup follows a durable confirmed branch; retained audio requires explicit deletion. Browser eviction can remove a local copy, and a reload before MediaRecorder finishes cannot recover unfinished bytes.
- Dynamic speech is narrowly constrained to a verified confirmed-text quote plus an authored question. Missing static audio uses text; uncertain provider purchases require operator reconciliation. No arbitrary-text synthesis, full-duplex streaming, background STT, active-call cross-device resume or Boss Client continuity is claimed.
- Nine Phase 21 targets remain IMPLEMENTED_UNVERIFIED. Broad privacy/infrastructure rows and PRI-001, PRI-002, NEG-003, EXR-024 carryovers retain their prior status. Independent audit, production secret setup and reviewed gate changes remain before production readiness. Details: `docs/reviews/phase-21-call-room.md`.

## Current state

- The product has curriculum content compiled in (Phase 5), a working learning engine over it (Phase 6), the Command Center, Campaign and Skill Map (Phase 7), the Academy (Phase 8), the exercise runner (Phase 9), the simulator core (Phase 10), the CRM Lab (Phase 11), the Workflow Lab with Conversations and the Playground (Phase 12) and the Funnel Lab (Phase 13). Five exercise families are graded from real runs; Run the Lead and Edge Case still carry the gaps recorded under Phase 12. Evidence that no runnable family produces still enters through the diagnostic form on `/system`.
- `/system` (diagnostics) and `/design` (gallery) exist only in local and preview environments; both are off in production by flag.
- The semantic components are presentational: Phase 7 wires SkillCard, HoloTerritory, MasteryBadge and StatusPill to the learning engine; the simulator components are wired by their phases. Prop shapes may still change when those data models land; they share tokens, so the visual language will not.
- Deployment is live: every push to `main` deploys the `bloomlab` Worker (https://bloomlab.cool-sunset-2169.workers.dev) and every pull request redeploys the single shared `bloomlab-preview` Worker (D-020). Both hosts serve public app shells; learner API data requires a session. Separate development/production D1 databases exist. Phase 20 adds private `bloomlab-media-dev` and `bloomlab-media-prod` R2 buckets, with public development URLs disabled.
- Phase 20 verification uses Node 22.22.1. The repository pins the Node 22 major; `engines.node` requires >=22.22.0.
- GHL feature names are verified only for the 41 registry records; the gallery samples in `/design` still use illustrative labels and are not wired to the registry (GHL-005 / GHL-010 apply from the screens onward).
- The historical ~128k expiring-credit estimate is superseded by the live account and generation usage in the Phase 20 review. Saved R2 playback has no provider-credit dependency.
- Prettier does not format Markdown (`*.md` is ignored) so the control documents keep their hand-laid tables.

## Phase 10 — simulator core

- **Workflow execution arrived in Phase 12.** The two bullets that stood here (no workflow executes; the Academy embed does not run a workflow) are closed: the engine walks a contact node to node, `EXERCISE_RUNTIMES` holds the CRM and Workflow runtimes, and the embed runs the engine. What remains is under Phase 12 below.
- **Simulator runs sync, and two devices produce two runs.** `sim_projects`, `sim_events` and
  `sim_snapshots` ride the existing sync path (D-082), and a run id is minted per run rather than
  per scenario, so a learner who starts the same scenario on two devices gets two runs rather than
  a merge. That is the honest reading of what happened; there is no cross-device "resume this run
  over there" yet. One run edited on two devices raises a `sim_projects` conflict through the
  existing chooser, which has not been exercised on real hardware for this entity — only in tests.
- **Cross-device sync of simulator saves is untested against a live second device.** The unit tests
  cover the local write path and the outbox; the two-device probe covers notes and learning
  records, not simulator runs.
- **The scheduled-event queue is only reachable from a scenario or the engine API.** The harness
  shows the queue and drains it, and the injector can create a future appointment, but there is no
  control for queuing an arbitrary event by hand; `schedule()` is covered by unit tests.
- **(Closed in Phase 15: all nine failure conditions are enforced; see Phase 15 below.) Two
  failure conditions, not nine.** A contact with no phone and a contact on do-not-disturb are
  enforced because they are properties of an outbound message. The rest of SIM-011 — invalid
  webhook auth, missing field, unavailable appointment, bad condition, workflow loop, integration
  failure — is Phase 15, and duplicate enrolment is enforced here only because re-entry is a
  property of the workflow definition.
- **The harness is a developer surface.** `/system/simulator` is behind the `system_diagnostics`
  flag and unreachable in production, by URL as well as by navigation. It is deliberately plain:
  it is not a Lab; the dark workspace is the Workflow Lab (Phase 12).
- **`Intl` is a dependency of the clock.** Calendar-day arithmetic and zone offsets use
  `Intl.DateTimeFormat` with an explicit `timeZone`. That is deterministic and never reads the
  device's zone, but it does mean the engine relies on the runtime's IANA database being present
  and current. A runtime without full ICU would resolve zones differently.
- **The tablet holographic interaction is confirmed fixed by the user. REAL TABLET USER CHECK:
  PASS.** The user tested diagnostic cards A to I on the actual tablet and reported all nine clean:
  no rectangular flash, no pointed-corner flash, touch-down, hold and release all correct, and the
  Skill Map's own holographic interaction clean on the same device. Case A is the card exactly as
  it ships, so what fixed it is one of the two WebKit version gaps closed alongside the diagnostic
  — most likely `button { -webkit-appearance: none }`, without which WebKit before Safari 15.4
  keeps the native button chrome and paints it on `:active` as a square fill over the button's box,
  which is the reported symptom exactly. The two shipped together, so this is a reasoned
  attribution rather than an isolated one. What the diagnostic settled is that **the material was
  never at fault**: every case that removed a piece of it came back identical to the card that
  keeps them, so nothing about the holographic interaction had to be weakened and nothing was
  (D-086, Phase 10 review §28).
- **`/system/holo` and the `surface="split"` prop are kept though the investigation is closed.**
  The diagnostic route stays behind the diagnostics flag, unreachable in production, and
  `HoloMaterial.surface` keeps its `split` value, whose only consumer is that route. This symptom
  was misdiagnosed twice from a desktop; if it returns, the instrument that named it should already
  exist. Both can be deleted in one commit if they are ever judged not to be worth their keep.
- **A second checkpoint at a log position already checkpointed keeps the first one's label.**
  Snapshot rows are addressed by `(run, generation, log length)`, which is content-addressed on
  purpose: two devices that checkpoint at the same position have checkpointed the same state, and
  the append union should treat those as one row rather than two. The cost is that marking a second
  checkpoint at the same position without advancing the run does not record the new label. No
  learner-facing surface takes checkpoint labels yet; the harness is the only caller.

## Phase 9 — exercise runner

- **(Superseded in Phase 12: five families are graded from real runs; see Phase 12.) Two of the seven Phase 9 families could be finished by a learner at the end of Phase 9.** Architecture Decision and What Would You Build read only what the learner chooses and writes, so they run, grade and record. Build It, Fix It, Run the Lead, Edge Case and Rebuild Blind have their brief, work capture, hint ladder, attempt lifecycle and grading contract, but their checks need the simulator core (Phase 10) and, for building, the Workflow Lab (Phase 12). The runner names the missing runtime and offers no submit; it never grades a description as if it were a build.
- **Both runnable families end in `partial`, not `passed`.** Each names a rubric, and rubric grading is the AI gateway (Phase 19). The deterministic checks run and are reported, the written work is preserved, and the evidence result is `partial` — which the mastery engine treats as not a pass, so a skill reaches LEARNING and no further. Nothing fabricates a rubric score.
- **The score is the share of required and quality checks passed** (D-067). Bonus checks are reported and excluded from the denominator; critical checks are a gate, never a number. The authored per-dimension weights were not applied until Phase 12, which assigns every assertion a dimension (D-113); this bullet stands as the Phase 9 record.
- **Written work is reduced only by an authored vocabulary** (D-070). `response_markers` in the exercise file lists the phrases that count as naming a fact; the runner matches them case-insensitively and exposes `decision.reasoning_mentions` and `answer.<marker>`. It decides one authored marker, never the quality of an argument, and the compiler refuses an assertion on written work with no vocabulary to decide it.
- **Active attempts are device-local.** The draft (attempt id, start time, revealed hints, response) lives in the local workspace and does not sync: a half-written attempt on a phone is not a fact about the learner. Finished attempts and their evidence sync normally.
- **Attempt timing is learner activity metadata only.** The start and completion timestamps come from the device clock; deterministic grading never reads a clock, and simulator-backed grading will use simulator time.
- **The runner renders a small Markdown subset** (paragraphs, ordered and unordered lists, bold, italic, inline code) for authored instructions and hints (D-071). It never interprets HTML, and prose stays in `content/`. A heading or table inside exercise instructions would render as plain text.
- **The prediction fields are derived from assertion paths.** Run the Lead shows a field for `prediction.tag` because an assertion reads it; its label comes from the path so the expected value never leaks. An exercise that asks for a prediction its assertions do not read captures it as prose only.
- **Touch, offline and reduced motion were verified by Chrome emulation**, not on a physical phone.
- **The retrieval integration has no vehicle in the seed content for most skills.** The session builder picks an authored practice or independent exercise; where a due skill has none, no retrieval is offered and no evidence is invented.
- **A retrieval through the runner can only end `partial` today.** Both runnable families name a rubric, and a partial result is not a demonstration, so a review cannot yet clear a NEEDS_REFRESH from the product. The scoping — one evidence row for the reviewed capability — and its mastery consequences are proven directly against the engine.
- **A review and a normal run of the same exercise are separate contexts** (D-072): separate drafts, separate current results, and evidence for the reviewed capability only. The exercise's complete history stays queryable; only what the runner calls "the current result" is scoped.
- **`EX-EDGE_CASE-late-booking-reminder`'s critical check reads an event field named `after`.** The grader matches `where` as exact field equality, so the simulator must label events with the reference they follow for that check to be judged. It is recorded here rather than rewritten, because changing authored content to suit the grader would be the wrong direction.

## Phase 8 — academy

- **Three units exist.** The Academy renders whatever `content/learning-units/` holds; today that is Funnel math, Tag / custom field / custom value, and What a workflow actually does. The rest of the curriculum is Phase 24.
- **The `<Simulation>` embed simulates nothing yet.** In the workflow unit it states the scenario, workflow and contact it will run and that the shared GHL simulator arrives with Phase 10; the workflow's structure is drawn by the `<Diagram kind="workflow">` above it. Nothing pretends to execute (CUR-036 PARTIAL).
- **Practice pointers now open the runner** (Phase 9). Whether the exercise can be finished there depends on its family; the runner says so on the page.
- **Two diagram kinds and one interactive kind.** `funnel` and `workflow` diagrams, and the `funnel-math` interactive, are what the compiler accepts; a unit that needs another kind needs a new renderer (validated at build time, never a broken page).
- **Finishing is one exposure per unit, for the learner and not merely for the device.** A completion row's id is derived from unit, skill and learner, so a second Finish writes nothing locally and two devices that finish the same unit offline converge on one row when they reconnect (D-062). The cost is that this one evidence row is re-keyed when a device links to a Sync Key; every other evidence row keeps a random id and an append union. Reading position is not stored; the contents list and browser scroll restoration cover navigation.
- **Offline was verified by emulation.** The Academy probe drives Chrome with the page and service worker offline; a physical phone in airplane mode was not used. `navigator.onLine` stays true under DevTools emulation, so the offline indicator is verified separately by the Phase 3 probe.
- **Keyboard arrow keys on the slider are verified in Chrome, not in jsdom**, which does not implement range-input key handling; the unit test covers focus, value change and Enter.
- **The Academy has no rail entry.** Units are reached from a capability's next step, the session plan and the capability sheet; a browsable index of units is not part of spec §73's rail and would become the "course sidebar" the spec rejects.

## Phase 7 — command center + skill map

- **Continue opens a unit or the capability, never an exercise.** Since Phase 8 a unit step opens in the Academy; an exercise step still opens the capability's sheet, which names it and says the runner arrives with Phase 9. Evidence other than exposure still enters through the diagnostic form on `/system`.
- **Some capabilities have no suitable next step yet.** The builder asks for a guided or practice exercise before an independent one; where the seed content authors only an independent-mode exercise (or none), the screens say "No suitable next exercise is authored for this capability yet." rather than pointing at the wrong thing. This is a content gap (`SKILL_NO_PRACTICE`, `SKILL_NO_UNIT` warnings), closed by Phase 24.
- **The rail has three of seven areas** (D-053). Simulator, Clients, Portfolio and Playground appear with their phases.
- **No active-client block on the Command Center.** The persistent-client system and its "active client" state are Phase 24; DES-010 stays PARTIAL until then.
- **The learner's focus is device-local.** It is a workspace record, not synced (D-057); a second device does not see it.
- **"Now" refreshes on data change, not on a timer** (D-058). A retrieval that becomes due while the app stays open and untouched shows on the next evidence write, sync pull or reload.
- **Recent evidence shows the last five rows; due retrieval, repairs and work-ahead show four each.** There is no full evidence history screen yet (portfolio and analytics, Phase 23 and INF-018).
- **Two Field Ready gates have no authored capabilities** (CUR-002), so the campaign screen says "The capabilities for this gate are authored in a later content phase." for them.
- **Touch was verified by emulation.** The holographic press → drag → release and the bottom sheet were driven with DevTools touch events at 390 px, not on a physical phone.
- **Versus the Doodlemon reference** the material is procedural (pearl, spectral bands, grain, glare, tinted rim) rather than a photographed foil, there is no idle float, and the territory objects are typographic rather than illustrated; see the Phase 7 review for the exact differences.
- **The developer rail links show icons only at 320 px** (their names stay for assistive technology) so five items fit; production has three items and shows every label at every width.

## Phase 6 — learning engine

- **Evidence enters through a diagnostic form.** Nothing produces evidence automatically yet: units are not rendered (Phase 8) and exercises are not run (Phase 9), so exposure and attempts are recorded by hand on `/system`. The write path they will use (`recordEvidence`) is the one verified here.
- **Mastery rules are v1 and deliberately strict.** One or two nudges make a pass *light* assistance, which counts toward PRACTICED but not INDEPENDENT; only a pass with no hints counts as independent. MASTERED needs at least two unassisted demonstrations on different days or exercises even when a skill declares one. The numbers live in `packages/mastery-engine/src/rules.ts` under `MASTERY_RULES_VERSION = 2026.09.03-r4`; changing them is a rules version bump and a recompute, and stored evaluations keep the version they were computed under.
- **Confidence is a heuristic reading, not a measurement.** It is a documented formula over state, extra independent passes, recent failure rate and overdue review; it exists so screens can order and soften, never to gate.
- **Review intervals are not calibrated.** 10 / 21 / 35 / 60 days by state, divided by importance and shortened by failure rate, with a 14-day grace before NEEDS_REFRESH, are explicit starting values (D-046). Calibration needs real learner history (Phase 24+).
- **The session builder cannot see time actually spent.** It plans against content `estimated_minutes`; sessions are not yet timed or recorded (that arrives with the exercise runner and analytics, INF-018).
- **Assistance dependence is shown in words, not as a gauge.** The value is on every session plan and derived from the last 14 days of evidence; Phase 7 surfaces it as "Passed with help" rows and a one-line note on the plan, by design without a meter graphic.
- **CUR-002 stays partial.** Field Ready's thirteen gates are competency gates in data and in the engine, but gates 6 (Conversion and Copy) and 12 (Capstone) have no authored skills, so their competencies are not mapped yet (Phase 24).
- **INF-018 (learning-event analytics, P2) is not started.** The evidence and attempt records already carry the events it lists; the aggregation is deferred.
- **Cross-device convergence relies on both devices recomputing.** Derived rows sync as simple state with deterministic ids, and each device recomputes from evidence after a pull; a device that never pulls the other device's evidence shows its own, older derived rows until it does. Nothing is lost: evidence is append-only.
- **No new D1 migration.** The five learning tables already existed from Phase 4's schema; the Worker stores them as JSON payloads by entity, so no production schema change was needed or made.

## Phase 5 — content engine

- **Seed, not curriculum.** 22 skills, 16 exercises and 3 units prove the types and relationships; Field Ready's Gate 6 (Conversion and Copy) and Gate 12 (Capstone) have no authored skills, seven gates have no project, and every seeded skill has at least one coverage gap. The compiler reports all of it (`npm run content:build`, 36 warnings) and the `/system` Content section lists the gaps. Authoring is Phase 24.
- **Three persistent clients, not twenty.** CNT-009 (≥ 20 clients across the §37 industries) stays NOT_STARTED; the client schema and hidden state are complete and exercised.
- **Registry verification depth varies.** 24 records were verified on their own (or a directly related) help-center article; 10 (Send Email, Remove Contact Tag, Assign to User, Send Internal Notification, Remove from Workflow, Survey Submitted, Pipeline Stage Changed, Opportunity Status Changed, Customer Replied, Payment Received) have their name confirmed on GHL's official trigger/action list pages or a related article, and their `supported_configs` are marked as not individually verified in `verification_note`. Filters and config fields are the compiler's vocabulary for the Workflow Lab (Phase 12), not a claim about GHL's exact UI.
- **Fidelity is declared, not yet exercised.** The simulator does not exist, so `simulation_fidelity` and `known_limitations` describe what Phase 10–14 must honour; the "Simulator approximations versus real GHL" section below fills in per feature once behaviour is implemented.
- **MDX is validated, not rendered.** Units are syntax-checked and their embeds resolved at build time; the bundle carries the raw MDX body. Rendering (and the embed components) is the Academy, Phase 8.
- **Attempt stamping is a contract, not a table yet.** The bundle carries `content_version` and `content_hash`; the attempt records that store them arrive with the learning engine (Phase 6) and exercise runner (Phase 9), so CNT-007, DATA-011 and INF-013 remain partial.
- **Learning units and rubrics are not versioned individually.** A rubric change is a new `_V<n>` file by rule; a unit change is a content_version bump. Per-record history relies on Git.
- **The content lock is a discipline.** `content:check` fails when sources change without a version bump; a developer can still bump-and-lock without reviewing what changed. Review happens in the pull request, where `content.lock.yaml` changes are visible.
- **Warnings are printed twice during `vite build`** (once per Vite environment: client and Worker); the compile itself runs once.

## Phase 2 — design system

- **Holo physics measured, not hand-tested.** Follow, settle, per-layer response, reduced motion and touch were measured on the production bundle with real DevTools mouse and touch events (`npm run review:holo`; numbers in `docs/reviews/phase-2-visual-review.md`). No physical phone, tablet or trackpad was available to this review, so the *feel* on a device — and the learner's own reaction to the hover — is still the real acceptance for DES-002 and HOL-005 and should be recorded here.
- **DATA-001 / SYNC-007 acceptance is two-thirds unreachable until Phases 9 and 12.** The end-to-end sync path is verified with notes; "moving a workflow node" and "completing a deterministic exercise" (and "dragging a node produces no sync operation") cannot be exercised before those features exist, so both stay PARTIAL on purpose.
- **Sync (Phase 4) — what is still thin.** Only `notes` has a local table today, so it is the only entity that actually travels; the other twelve entity kinds are declared and their D1 tables exist. When a later phase adds an entity's local table it must reset the pull cursor (`sync_state.all.server_cursor = 0`) once so history is fetched. `/api/sync/link` has no per-IP rate limit yet (the 256-bit key makes guessing infeasible; a Cloudflare rate-limit binding is the planned addition). The two-device verification ran in two headless Chrome profiles against the local preview and the deployed preview, not on physical devices. Headless Chrome shows no install prompt and denies persistent storage, as noted for Phase 3.
- **Pepper custody.** `SYNC_KEY_PEPPER` for preview and production was generated randomly and uploaded without being shown to anyone (D-034). If it is ever lost, every learner has to link again with their key; rotate it now with a value you keep if you want that control.
- **Install prompt not observed.** Chrome's installability check passes (`Page.getInstallabilityErrors` is empty on the production bundle) but headless Chrome never shows the prompt itself; confirm the "Install app" affordance on a phone and on desktop Chrome. Headless Chrome also denies `navigator.storage.persist()`, so diagnostics read "Persistent storage: no" there; real browsers grant it after engagement or installation.
- **DATA-001 acceptance interactions are future features.** The offline note, workflow-node move and deterministic exercise named in the acceptance test arrive in Phases 8, 12 and 9; Phase 3 proves the same path with the device rename and the diagnostics test note.
- **What still differs from the Doodlemon reference.** The reference's holo is a photographed foil card (warm gold-green base, hard diagonal rainbow, micro-sparkle) with a constant 4.5 s float and a mouse-driven background parallax; its tiles lift 8 px behind a saturated gradient ring. Bloomlab's material is procedural in the pastel palette on a light ground, so it reads softer and cooler; sparkle is a static grain with parallax rather than per-pixel glitter; there is no idle float or parallax (spec §148 / MOT-004); the rim is white at the light's angle with pastel tints elsewhere rather than a full-strength gradient ring; and cards lift 5 px with up to 6° of tilt (§68) where the reference lifts 8 px with none.
- Ink Faint is tuned from the spec value (`#8F8AA5` → `#86819C`) so it clears 3:1 on every light surface; it is still reserved for large or decorative text (D-017).
- `Popover` positions itself with `getBoundingClientRect` on open (flips above when there is no room below) rather than CSS anchor positioning; it does not reposition on scroll while open.
- `Sheet` relies on the native `<dialog>` for focus trapping and Escape; browsers without `showModal` get an open attribute without trapping.
- Icons are a hand-drawn set of 22 stroke glyphs; more will be added as screens need them, kept in one file to avoid a dependency.
- Semantic colours never appear as small text; success and warning glyphs sit below 3:1 on white by design because a text label always accompanies them.
- No dark theme exists and none is specified: ink workspaces (`InkSurface`) are per-environment surfaces, not a global mode.

## By design (spec-mandated constraints, not defects)

- Recovery limitation (SYNC-006): losing every connected device and the sync key means server recovery is impossible until account authentication exists.
- Call Room v1 is turn-based, not full-duplex realtime (CALL-002).
- Real-GHL fieldwork is manual with screenshots and configuration answers (FLD-002); API verification is deferred (FLD-003).
- Payments Lab, Companies, Custom Objects, Smart Lists and advanced calendar rules are post-Field-Ready (Phase 25).
- No Durable Objects, Queues, Redis, Supabase, Firebase, separate Node server, or vector database in v1 (INF-006, INF-007, INF-008).
- Environments are chosen at build time (`CLOUDFLARE_ENV` + Vite mode, D-013); one build artefact cannot be promoted between environments.

## Phase 11 — CRM Lab

- **No move between pipelines.** An opportunity's stage picker offers the stages of its own pipeline; `PIPELINE_STAGE_CHANGED` is scoped to the deal's pipeline and a stage from another is refused. Moving a deal to a different pipeline is not offered in Phase 11.
- **No deletion.** Contacts, opportunities, fields, pipelines, notes and tasks cannot be deleted from the Lab. Acceptance does not need it and no deletion event was added to claim CRUD.
- **One pipeline on the board.** The board shows the account's first pipeline; the training scenario authors one. Creating a second pipeline works and its deals can be created into it, but the board does not switch between pipelines yet.
- **Custom Values have no editor.** CRM-001's nine areas do not include them; the account's `custom_values` are untouched and a compact editor is later ARCHITECT work.
- **GHL verification method.** The build environment's egress proxy denies `help.gohighlevel.com`, so the three registry records added this phase (owners, notes, tasks) were verified through search-engine summaries of the official articles, dated and stated in each `verification_note`. Re-verify by direct read when a machine with access next touches them.
- **Physical two-device testing did not happen.** Cross-device behaviour is proved with two simulated devices in tests and the existing sync semantics; no CRM-specific sync protocol exists.
- **The consequence exercise is one exercise.** CRM-003's consequence is `EX-FIX_IT-jordan-treatment-interest`; other consequences the spec lists (merge-field output, a filter that cannot answer, an automation depending on one value) arrive with the Labs that produce them (Phases 12–15).

## Phase 12 — Workflow Lab

- **The whole run crosses to the Worker on every operation.** The Worker is stateless (D-109), so each op sends the run and receives it back. At 500 events the transfer is a few hundred kilobytes and the probe stays responsive (p95 43.5 ms per frame), but the cost grows with the run. A run of many thousands of events would need incremental transfer, which is Phase 26 polish work.
- **`EX-EDGE_CASE-late-booking-reminder`'s `after:` where-clause is still not evaluable.** The grader matches `where` as field equality and no event carries a field named `after`. EXR-007 stays PARTIAL for that exercise; the cancelled and missing-phone edge cases are judged from real runs.
- **Run the Lead's animation is the Lab's Replay, not the runner page.** The prediction is captured and the real run is graded, but the runner sends the learner to the Lab to watch it rather than animating inside the exercise. EXR-006 stays PARTIAL.
- **The help centre could not be read directly.** Every workflow registry record was re-verified on 2026-09-04 through search-engine summaries of the official articles because the build environment's proxy denies `help.gohighlevel.com`; each `verification_note` says so. Re-verify by direct read when a machine with access next touches them.
- **Conversations carries SMS and email only.** Calls, WhatsApp, Facebook and Instagram channels are not simulated and the surface does not pretend to show them.
- **The Playground has one sandbox scenario.** Every unlocked feature can be placed and run on it; a second sandbox with different starting data is content work.
- **Two of HighLevel's eight wait types are not modelled.** Trigger Link Clicked and Email Event waits need funnel and email tracking events that arrive with Phases 13 and 15.
- **Assign To User rotates by current load, not by HighLevel's split-traffic percentages.** The record says so.
- **Create/Update Opportunity keeps its combined name.** HighLevel states the combined action is being phased out for separate Create and Update actions; the registry record notes it and the palette shows the name learners still see in accounts today.
- **Touch, reduced motion and the frame timings were measured in headless Chromium on the build machine**, not on a physical phone or tablet. The rail and holographic checks were re-run on the same build.
- **REAL TABLET RAIL CHECK: PENDING.** The phone bar now shows four named areas and a labelled More; the rail was a user-reported design issue and the user inspects the new preview on the real tablet. Nothing here marks that check passed.
- **The trigger test covers the events the panel can make.** Every runnable trigger's events have a producer (bookings, status changes, reschedules, tags, replies, forms, surveys, deals, new contacts). Payment Received and Inbound Webhook are fidelity C: the panel says they cannot fire in the simulator and offers only the direct start.
- **Autoplay reveals the trace at a fixed cadence (650 ms a row).** A long trace can be skipped at any time; there is no speed control.
- **Positions are layout only.** Moving a node is a draft edit, never an event, so a node's position is not synced until the next save. That is D-107 working as intended, recorded here because a learner who moves nodes and leaves will find them where they were at the last save.

## Simulator approximations versus real GHL

| Feature | Fidelity | What differs | Why |
|---|---|---|---|
| `GHL-CRM-OWNERS` decoupled contact / opportunity owners | B | The opportunity owner defaults to the contact owner at creation and can then differ; the two follower-sync sub-settings are not modelled. | Phase 11 teaches ownership, not follower management. |
| `GHL-CRM-NOTES` | B | Plain text, on contacts and opportunities; no rich text, no company notes, no editing after the fact. | Companies are Phase 25; editing a note would need an event nothing in Phase 11 requires. |
| `GHL-CRM-TASKS` | B | Title, description, due date, assignee, linked record, complete / reopen; no recurrence, priority, reminders or Spaces. | The acceptance needs a usable task, not task-management parity. |
| `GHL-CRM-CONTACTS` do-not-disturb | A (one gap) | One global flag; HighLevel also allows DND per channel. | A per-channel model arrives when the Conversations Lab needs it. |
| `GHL-CRM-OPPORTUNITIES` | A (one gap) | One contact per opportunity; no followers or additional contacts. | Phase 11 acceptance needs the contact link preserved, nothing more. |
| `GHL-CRM-CUSTOM-FIELDS` | A | Seven types (text, number, date, checkbox, dropdown, phone, email) with dropdown options; no file, textarea, radio or multi-select types, no folders. | Unsupported types are not shown as supported (D-090). |
| `GHL-WF-WAIT` | B | Five engine kinds: period, date, appointment, reply, condition. No Trigger Link Clicked or Email Event wait. A wait whose target has passed proceeds at once and says so. | The Lab teaches timing and design; link and email tracking events are later phases. |
| `GHL-WF-WORKFLOW-SETTINGS` Time Window | B | A hold on outbound messages until the next opening, as documented. Other settings (sender address, stop on response, mark as read) are not modelled. | Phase 12 needs business hours, not the whole settings page. |
| `GHL-WF-IF-ELSE` | A | Eight operators over contact, tag, custom field, appointment, opportunity and message values. No date-relative or numeric-range operators. | The authored exercises need equality, containment, existence and simple comparison. |
| `GHL-WF-CUSTOMER-REPLIED` | B | Contains Phrase and Reply Channel filters. No intent detection. | Those are the documented filters. |
| `GHL-WF-APPOINTMENT-STATUS` and `GHL-WF-CUSTOMER-BOOKED-APPOINTMENT` | A | A run started by either is ended when the appointment is cancelled, marked no-show or invalid, or rescheduled, and a reschedule fires them again as a new booking. Runs started any other way are not touched. | That is the documented platform behaviour; the difference is what WAIT-004 teaches. |
| `GHL-WF-SEND-SMS` and `GHL-WF-SEND-EMAIL` | A | Recorded with rendered body and subject; no delivery, templates, attachments or tracking. Skipped for no phone, no email or do-not-disturb. | Deliverability is Phase 15. |
| `GHL-WF-ASSIGN-TO-USER` | A | One user, or equal rotation by current load among the listed users with an only-if-unassigned option. No percentage split. | Enough to teach assignment. |
| `GHL-WF-SEND-INTERNAL-NOTIFICATION` | B | Email, SMS and in-app, recorded as `NOTIFICATION_SENT`; no WhatsApp, no delivery. | The log is what the learner reads. |
| `GHL-WF-WEBHOOK` | B | Recorded with a simulated 200 response; nothing is sent. | The build environment has no egress and a learner's sandbox should not either. |
| `GHL-WF-CREATE-UPDATE-OPPORTUNITY` | A | Creates or moves the contact's opportunity in a pipeline and stage. HighLevel is phasing the combined action out. | The name learners still see. |
| `GHL-WF-REMOVE-FROM-WORKFLOW` | A | This workflow, all workflows, or a named one. The exact option labels could not be confirmed. | Stated in the record. |

## Phase 13 — Funnel Lab

- **The Funnel Lab is conversion architecture, not a page builder, and never becomes one.** There
  is no styling, no layout control, no section or column model, no template, no domain and no
  publishing anywhere in it, and none is planned: `Funnel` holds steps, the ordered blocks inside
  them and the account entity a capture block uses, and that is the whole model (D-118). The page
  a learner sees in Preview and Simulate is the product's typography and rhythm applied to their
  structure, not their design. Practising HighLevel's actual builder stays fieldwork.
- **Step purposes and block roles are Bloomlab's own vocabulary.** HighLevel has no "capture step"
  and no "proof block". The inspector says so on every block, and the `GHL-FUNNEL-FUNNELS` record
  says so as an approximation note. The four roles that connect to something — form, survey,
  calendar, checkout — name real HighLevel objects and keep HighLevel's own names.
- **Checkout records one payment and stops there.** A checkout block references a product the
  account holds and completing it fires the real `PAYMENT_RECEIVED` at that product's price
  (D-124). There is no product creation or editing, no second price, no subscription, no billing
  cycle, trial or setup fee, no payment provider, no order form, no coupon, no failed payment and
  no refund. Those are the Payments Lab (PAY-001, Phase 18). The visitor is told this in the
  checkout block itself rather than left to assume otherwise.
- **Booking from a funnel uses the smallest honest rule.** The slots offered are the next three
  openings on the hour, starting an hour after the run's own clock, inside a nine-to-five day in
  the calendar's zone. There is no availability, no buffer, no minimum notice, no staff, no round
  robin and no service calendar — all of that is the Calendar Lab (CAL-001, Phase 14). The picker
  says so under the field.
- **A funnel has no analytics.** FUN-004 (traffic source, conversion rate, scroll behaviour, form
  completion, booking rate, drop-off) is Phase 15 and nothing in Phase 13 shows a number that
  looks like one. The visitor run shows what the account actually did, read from the run's log.
- **The FUNNEL ASSEMBLY exercise reuses existing skills.** `SK-BUILD-lead-capture-form` and
  `SK-BUILD-consultation-calendar` are both genuinely exercised by it, but conversion architecture
  itself has no skill of its own yet; adding one is a curriculum change for the phase that owns
  Gate 6 (Conversion and Copy), not a Lab phase.
- **A visitor is a session, not a saved record.** Who the visitor is lives in the Lab while the
  run is open: leaving Simulate and coming back starts a new visitor. Everything the visitor
  *did* is permanent — the contact, the appointment, the payment and every event are in the
  account — but "the visitor I was halfway through being" is not restored by a reload.
- **Blocks move within their step, not between steps.** Moving a block to another step is a
  remove and an add. The step a block belongs to is part of what the exercise grades, so the
  operation exists; it is two actions rather than one.
- **One HighLevel funnel behaviour is deliberately absent: a step is reached only through the
  funnel.** There is no per-step URL, so a visitor cannot start halfway through, and nothing
  models a returning visitor picking up where they left off.
- **Registry verification was indirect again.** `GHL-FUNNEL-FUNNELS`, `GHL-FORM-SURVEYS` and
  `GHL-PAY-PRODUCTS` were checked on 2026-09-04 against search-result summaries of the official
  help-centre articles, because the build environment's egress proxy rejects
  `help.gohighlevel.com` outright. Each record's `verification_note` says exactly that rather
  than claiming the article was read.

| Feature | Fidelity | What differs | Why |
|---|---|---|---|
| `GHL-FUNNEL-FUNNELS` | C | Ordered steps, what each step is for, what is on it in order, and which account object a capture element uses. No page editor, sections, rows, columns, elements, styling, templates, domains, pixels, split tests, AI generation or publishing. | Bloomlab teaches conversion architecture; the builder itself is practised in GHL. |
| `GHL-FORM-SURVEYS` | B | Ordered questions mapped to contact fields; a submission creates or updates a contact and fires Survey Submitted. No multi-page surveys, conditional logic, scoring, disqualification or styling. | The chain into CRM and workflows is what Phase 13 needs. |
| `GHL-PAY-PRODUCTS` | C | A named product with one price, one-time or recurring, that a checkout block references and a completed checkout records a payment against. Nothing else about products or payments. | Everything beyond the one event is the Payments Lab (D-124). |
| `GHL-CAL-CALENDARS` from a funnel | B | Retired in Phase 14. A funnel's calendar block now asks the shared availability engine, so a visitor is offered the learner's real working hours, duration, buffers, minimum notice and free staff (D-129). | There is one answer to what is bookable. |

## Phase 14 — Calendar Lab

- **The Rescheduled appointment status is not offered, and the sources disagree (D-132).** The
  official Appointment Status trigger article lists six statuses — New, Confirmed, Cancelled,
  Showed, No-show, Invalid — and does not include Rescheduled. The Appointment scenarios article
  describes what happens "if the workflow has a trigger set to fire on Appointment Status =
  Rescheduled", and there is an open HighLevel feature request asking for a reschedule trigger.
  The two could not be reconciled from the summaries available, so the simulator keeps the
  reading both articles agree on: a reschedule is a new appointment, it exits the appointment's
  run and fires the appointment triggers again as New. Whoever verifies this next should open both
  articles directly and settle it.
- **Working hours are weekly windows inside one day.** Date-specific hours, holiday overrides and
  a window that crosses midnight are not modelled; a night shift is authored as two windows.
  Windows run from 00:00 to 23:59 in the calendar's own zone.
- **Not simulated at all, and named in the registry rather than approximated:** linked and conflict
  calendars, Look Busy, appointments-per-day and per-slot limits, calendar groups, recurring
  appointments, Class Booking, Collective, Group and Event calendars, rooms, equipment and other
  resources (Phase 25, CAL-002), and payment at booking (the Payments Lab).
- **Optimize for Equal Distribution is the documented rule minus one nuance.** Bloomlab counts
  each team member's bookings on that calendar in the slot's own month and gives the booking to
  whoever has fewest, ties broken by the order the learner arranged the team. HighLevel
  additionally limits a member's availability temporarily when they run too far ahead of the team;
  that part is not simulated and the registry record says so.
- **Zoom and Google Meet locations store a link.** Bloomlab creates no meeting on either platform
  and generates no dynamic link; a learner supplies one and the booking carries it. Ask the Booker
  records that the booker supplies the location, and the simulated booking does not collect it.
- **The booker's own cancellation and reschedule links are settings, not a surface.** The Lab
  configures Allow Cancellation, Allow Rescheduling and the cutoff, and those settings are stored
  on the calendar; there is no simulated booking confirmation page for a visitor to click them
  from. Somebody on the team can always change an appointment from inside the account, which is
  what the Lab's own appointment actions are.
- **The schedule shows the saved calendar, not the draft.** Unsaved edits are held in the editor
  and the schedule says so rather than previewing them; saving is the moment the account changes.
  A live preview of an unsaved definition would be a fourth answer to what is bookable.
- **Registry verification was indirect again.** `GHL-CAL-CALENDARS`,
  `GHL-WF-CUSTOMER-BOOKED-APPOINTMENT` and `GHL-WF-APPOINTMENT-STATUS` were re-checked on
  2026-09-04 against search-result summaries of the official help-centre articles, because the
  build environment's egress proxy rejects `help.gohighlevel.com` with a 403 at the CONNECT. Each
  record's `verification_note` says exactly that rather than claiming the article was read. Fourth
  phase running under this constraint.
- **The Workflow Lab frame-timing probe still misses its ceiling in this container.** Unchanged
  from Phase 13 and unrelated to Phase 14: `review:workflow` → `five-hundred-events` →
  `noFrameOver100ms` reported a maximum frame of 165 ms (mean 19 ms, p95 57 ms, engine compute
  87 ms for 504 events) against a 100 ms ceiling. Phase 13 established that pre-Phase-13 `main`
  reproduces the same numbers in the same container. PERF-002 must not be claimed for this
  scenario from container evidence; it needs one run on the reference desktop.

## Phase 15 — Troubleshooting and Reporting

- **The reporting window is the scenario's three weeks, and only that.** `SC-glowhaus-reporting`
  runs 1–21 September and the Lab reports on what happened inside it. There is no date picker, no
  comparison against a previous period and no custom range; a learner cannot yet ask what October
  looked like, because October has no events. Adding ranges before there is more than one window
  of history would be a control with nothing behind it.
- **Ten metrics, and they are the ten REP-001 names.** No cost, spend, ROAS, cost per lead,
  lifetime value or attribution model is calculated, because none of them can be derived from what
  the simulator records — an account has no ad spend in it. A learner who needs them meets them in
  the pricing and reporting curriculum, not as a number this engine would have to invent.
- **Attribution is the visit's own source and nothing cleverer.** A lead is credited to the source
  on the visit that captured them. There is no first-touch versus last-touch choice, no
  multi-session identity stitching and no channel grouping: a contact who arrives twice from two
  sources is two visits, and only the converting one carries the credit. Real attribution needs
  identity resolution the simulator does not model.
- **Time to contact is measured to the first outbound message, not to a call.** The account has no
  call records, so a business that phones its leads within a minute would read as never contacted.
  The metric says which channel it counted, and the two never-contacted rows say why they are
  excluded rather than being averaged in.
- **Scroll behaviour is three levels, not a pixel depth.** A step view records whether the visitor
  reached the top, the middle or the bottom of the page, because that is what the simulated visitor
  run can honestly produce. There is no heatmap, no scroll-depth percentage and no time-on-element:
  a heatmap over simulated visits would be a picture of nothing (REP-003, §70).
- **An incident is one authored fault at a time.** Each scenario carries one `incident` block naming
  one failure mode. Two faults interacting — the thing that makes real troubleshooting hard — is not
  yet authorable, and neither is a fault that appears only intermittently, because the engine is
  deterministic by design.
- **The Incident Room reads and reproduces; it does not repair.** A learner inspects the case,
  re-runs the fault and follows the links into the CRM, Workflow, Funnel or Calendar Lab to fix it
  there. There is no fix-it-here control on the incident page itself, and no automatic check that
  the incident is now resolved: the graded fix belongs to the FIX IT exercises, which run in the
  Labs that own the configuration.
- **External services are as deterministic as the scenario made them.** An endpoint answers from
  its authored profile: a URL, an expected credential, an ok status and an optional outage. There
  is no latency, no retry policy, no rate limit, no partial response and no flapping service. A
  learner meets the failure the scenario configured, on demand, every time.
- **The webhook action carries headers but not GHL's authorization pickers.** `GHL-WF-WEBHOOK`
  stays fidelity B. A learner writes an `Authorization` or `X-API-Key` header row, which is how a
  Bearer token or an API key is actually sent, but Basic auth and OAuth2 — including token refresh
  through Global Workflow Settings — are practised in GHL, not here. Query parameters are typed
  into the URL rather than offered as their own rows. Recorded in the record's
  `known_limitations`.
- **The loop bound is a bound, not a diagnosis.** `MAX_ENROLMENTS_IN_ONE_CHAIN` stops a runaway
  chain at ten enrolments and records what was going round, which is enough to teach the incident.
  It does not name the pair of workflows as a cycle before running them: static detection across
  workflow definitions (this one's tag trigger matches that one's tag action) is not implemented,
  so a learner who builds the same loop in the Workflow Lab meets it at run time.
- **Registry verification was indirect for the fifth phase running.** `GHL-WF-WEBHOOK` was
  re-checked on 2026-09-06 through search-result summaries of the official Custom Webhook article,
  because the build environment's egress proxy still rejects `help.gohighlevel.com` with a 403 at
  the CONNECT. The record's `verification_note` says exactly that rather than claiming the article
  was read.
- **The Workflow Lab frame-timing probe still misses its ceiling in this container.** Unchanged
  again, and unrelated to Phase 15: `review:workflow` → `five-hundred-events` reported mean 18.5 ms,
  p95 55 ms, maximum frame 130 ms and engine compute 79 ms for 504 events, against ceilings of
  50 ms (p95) and 100 ms (maximum). Those numbers sit inside the range Phase 14 recorded (mean 19,
  p95 57, max 165, compute 87), and Phase 13 established that pre-Phase-13 `main` reproduces them
  in the same container. PERF-002 must not be claimed for this scenario from container evidence; it
  needs one run on the reference desktop.

## Phase 16 — Sales Exercises

The prose-grading boundary below records Phase 16 at closure. Phase 19 now executes these exact rubrics; the deployed-preview Worker/provider path is verified by the live evidence below.

- **No prose is judged yet.** Every selling exercise is `mixed`: the deterministic half runs now
  and the written half names a rubric the AI gateway executes in Phase 19. A learner who does
  everything right sees a score of 100 and `rubric_pending`, not a pass. Nothing here reads whether
  an email is persuasive, whether a reason is good or whether an explanation is clear, and nothing
  pretends to (AI-006).
- **The client thread branches on the move, not on the words.** The learner writes the message and
  says what they are doing; the branch follows that. A reply sent without a move takes the authored
  fallback and the client asks what was meant. That is a real conversation with authored
  consequences, and it is not natural-language understanding: two different questions inside the
  same move reach the same reply.
- **Discovery is written, not spoken.** SAL-004 and SAL-005 are trained and measured over a written
  thread. At Phase 16, spoken discovery and `EX-SAY_IT-summit-discovery` still needed a runtime.
  Phase 21 now supplies the call implementation; its live acceptance gate is recorded above. Nothing in Phase 16 judges accent,
  pace or delivery, and it should not be read as having done so.
- **Jargon counting is one signal, not a measure of clarity.** `explanation.owner_jargon_count`
  counts distinct glossary terms that are not marked `owner_safe`, whole-word with an optional
  plural. It does not understand context: an owner explanation that names a term in order to say
  the reader will never have to touch it is still counted, and an explanation full of ordinary
  words arranged badly counts zero. The rubric is what judges the writing.
- **Frame coverage is authored markers, not comprehension.** `explanation.frame_covered` reports
  which of problem, consequence, system and outcome the exercise's own marker phrases found. An
  explanation that covers a part in wording the exercise did not anticipate reads as uncovered, and
  the learner is told what was counted rather than being marked down silently for it.
- **The prospects are three, and they are authored.** There is no live business research, no
  scraping and no real company data anywhere in Phase 16 — the evidence packs are fiction written
  for the exercise. The twenty-industry client library and the full Field Ready sales curriculum
  are Phase 24.
- **Nothing is sent.** No email leaves Bloomlab, no inbox is connected and no message reaches a
  real person. A payment reminder is an exercise about writing a payment reminder.
- **Pricing and negotiation are deliberately absent.** The closing thread stops at the decision and
  the next step; it never quotes, discounts or trades scope. `EX-PRICE_IT-summit-application-funnel`
  and `EX-NEGOTIATE_IT-summit-freelancer-quote` are untouched and remain un-runnable, waiting for
  Phases 17 and 18.
- **`review:learning` cannot complete in this container, on Phase 16 or on `main`.** Its second
  device fails to link (`bLinked: false`), so the two-device half of the probe does not run. The
  same failure was reproduced on `7e391ca` in the same container before the phase was reviewed, so
  it is the environment rather than a regression; the single-device half (recording evidence and
  the derived rows) passes on both.
- **The Workflow Lab frame-timing probe still misses its ceiling, unchanged again.**
  `review:workflow` → `five-hundred-events` reported p95 under 50 ms this time and still exceeded
  the 100 ms maximum-frame and long-task ceilings for 504 events. Phase 16 touches nothing in that
  path; PERF-002 still needs one run on the reference desktop rather than a container claim.

## Phase 17 — Pricing Arena

- **Removing a scope line does not change a price on the desk.** PRI-001 asks for a visible price
  change and EXR-016 forbids showing hidden economics before submission. The learner sets one
  project fee for the whole deal, so there is no per-line price to subtract, and the delivery cost
  of the removed line is exactly what may not be shown. What the desk does show is the structural
  consequence: what the line leaves the client with, and any requirement nothing in the deal
  answers any more. The economic consequence appears in full after submitting, where the floor
  moves with the scope. PRI-001 stays PARTIAL with the unmet half named (D-162).
- **Phase 17 closure boundary (superseded by the Phase 19 gateway below): no pricing reasoning was judged.** The Summit exercise is `mixed` and names
  `PRICING_REASONING_RUBRIC_V1`; the explanation is collected and kept with the attempt, and
  nothing reads it until the AI gateway (Phase 19). The rubric was not edited even though its first
  item now duplicates a deterministic check, because changing it would change a contract attempts
  were judged under. The Glowhaus exercise is fully deterministic and does pass end to end today.
- **The hourly delivery cost is a number an author chose, not a market rate.** $55 an hour is what
  both Phase 17 exercises say an hour of delivery costs this business. Nothing in the source
  establishes a universal rate and the engine does not carry one (D-161). A different business
  would author a different number and the same quotes would be judged differently, which is the
  intent, not a defect.
- **Margin is measured on one-time work only, and complexity is not priced separately.** The
  contingency comes from the scenario's single `risk` score. The other economics fields
  (`baseline_complexity`, `migration`, `locations`, `integrations`, `custom_development`) shape the
  scenario and the scope an author writes, and no formula reads them. Complexity moves the hours,
  which move the cost; there is no complexity multiplier on top, deliberately.
- **The proposal is written, not assembled.** `EX-WRITE_IT-summit-proposal` asks for the eight
  sections and checks they are answered, inside their caps, cite something observed and ask for one
  thing. It does not read the learner's own priced deal or check that the price section matches a
  prior quote, because the two are separate attempts. The Phase 17 drill now gives the learner an
  explicit priced scope in its own brief rather than pretending the previous attempt is linked. Nothing generates a proposal
  document, and nothing is sent.
- **Negotiation is still absent.** The desk quotes; it never defends the quote.
  `EX-NEGOTIATE_IT-summit-freelancer-quote` is untouched and remains un-runnable, and Summit's
  freelancer-quote and budget-objection injectables are authored and unused, waiting for Phase 18.
  `EX-SAY_IT-summit-discovery` still waits for Phase 21.
- **`review:learning` cannot complete in this container, on Phase 17 or on `main`.** Re-checked on
  this branch and on the stashed baseline in the same container: the Worker cannot reach the
  network to create a sync key, so the two-device half of the probe never starts. It is the
  environment rather than a regression, and it is the same limitation recorded at the end of
  Phase 16.


## Phase 18 — Negotiation

- At Phase 18 closure, NEG-003 was PARTIAL because only explicit actions were classified. Phase 19 now implements the Worker language classifier and fallback boundary; one live hold classification at 0.95 is now verified, but status remains PARTIAL because broad language quality is not established.
- At Phase 18 closure the Summit negotiation was mixed: deterministic success remained rubric_pending for `PRICING_REASONING_RUBRIC_V1`. Written quality and whether prose matches the selected move await Phase 19. The existing rubric is unchanged.
- One standalone starting deal and ten executable situations cover the required objections. This is not broad language coverage or persistent Boss Client continuity. New attempts start from client state plus scenario overrides, never another exercise's price or a completed attempt's hidden state.
- Phasing uses authored dependency-valid two-stage plans. It is not an unrestricted planner for restructuring an already-phased deal; incomplete or unsupported reconfiguration takes the clarification path without altering the offer.
- Hidden numeric state is absent from learner-rendered HTML. Local simulation state and bundled fictional content are inspectable in developer tools; they are not security secrets.
- Node 26 on the review host breaks an existing localStorage database test. The unchanged suite passes under the pinned Node 22 runtime. Browser probes requiring offline reload need the built service worker, not the development server.
- Phase 18 closed through PR #20 at `154a00a73d659b92f0cc871f636462a9cb094f4b`; main CI `34072172459`, Checks, production migration (none pending), and deployment succeeded (1,570 tests / 93 files). Preview correctly skipped on main. Phase 19 is now current; Phases 20/21/24 remain unstarted.

## Phase 19 — verification boundaries

- AI-009 is PASSED after real preview Anthropic evaluation, structured validation, D1 persistence/accounting and revoked-session verification (see `docs/reviews/phase-19-ai-gateway.md`). Ordinary tests still use injected providers. NEG-003 remains PARTIAL: one live hold classification at 0.95 is insufficient for broad language quality. The user is configuring production secrets separately; independent audit must confirm required production ANTHROPIC_API_KEY before merge.
- Structured validity does not establish judgment quality. The live rubric sample scored 58 with a critical issue and mischaracterized qualified “may” wording as “will”; no general grading-quality claim follows from the successful provider-path check.
- The governor reserves the full model input-context ceiling at cache-write pricing plus bounded output, for two calls. This deliberately conservative maximum includes unobservable structured-output overhead and can refuse small requests while a visible balance remains. It downgrades to Haiku before refusal. Unknown provider outcomes retain reservations for the UTC month rather than silently risking double spending.
- A Worker termination while a rubric run is active currently requires operational reconciliation; ordinary caught provider failures support retry. Reservations are not automatically refunded on timeout.
- Full permits optional work but adds no speculative coaching buttons. Settings are reached from Sync and devices; the rail and mobile navigation are unchanged.
- Historical finalized rubric_pending attempts remain unchanged. New successful evaluations finalize once; old rubric IDs retained in content remain resolvable. At Phase 19, voice-only SAY IT still needed its later runtime; Phase 21 now implements it with live acceptance pending above.

## Phase 20 — voice assets

- The library covers the five current fictional clients and six reusable line kinds. Account-catalog metadata informed selection; browser decoding, waveform levels and clipping checks provide technical audio inspection. No human listening assessment, accent certification or subjective character-performance sign-off is claimed.
- Speech rate, style and stability are transmitted as supported numeric settings. Language and allowed emotion range are authored direction for multilingual_v2, not guaranteed expressive controls. No unsupported language_code parameter is sent.
- The new media table implements private authored voice assets and an ownership primitive. DATA-006 stays PARTIAL because its full matrix scope also names screenshots, portfolio/fieldwork media, recovery backups and attachments, whose upload/storage flows belong to later phases. No learner recording or general upload endpoint exists yet.
- Historical Phase 20 boundary: VOI-003, VOI-006, VOI-007, CALL-* and EXR-015 were NOT_STARTED. Phase 21 supersedes those statuses as recorded above. The review surface preserves authored text on errors but does not claim the future transcription/retry contract. voice_calls remains off in production; /system/voice is a local/preview diagnostic route.
- Private audio is fetched as an authenticated no-store blob and released when its player unmounts. It is not persisted for offline playback. A revoked device cannot fetch new bytes; already delivered bytes cannot be recalled.
- Known provider rejections can be retried explicitly. Ambiguous or interrupted purchases remain claimed for manual reconciliation, so a lost response can require operator work before generation continues. Provider history recovery is documented but not automated. Promotion stops on unexpected existing bytes or conflicting metadata.
- Exact files may be promoted to the production R2 bucket before merge, but the production D1 migration/index and Worker deployment remain the independent post-merge CI path. The deployment credential must allow R2 reads and D1 writes. Production playback verification is pending that deployment, and no production ElevenLabs secret is required.
- SEC-001 remains PARTIAL across all phases. The required pre-merge rotation for the initial plain-text ElevenLabs variable is closed: on 2026-09-08 the user confirmed the old key was revoked/rotated and the replacement preview binding is a Worker secret. No secret value is committed or printed, and historical Worker version deletion is not claimed. Google credentials and future integrations remain outside this phase; production still needs no ElevenLabs key for saved playback.
- Existing content coverage warnings and the existing ExerciseRunner hook dependency lint warning remain. Phase 20 introduces no lint errors and does not broaden those unrelated changes.
