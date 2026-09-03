# KNOWN LIMITATIONS

Honest record of approximations, gaps and mismatches (spec §140). Updated at the end of every phase. Once the simulator exists, every approximation versus real GHL is listed here per registry feature.

Last updated: 2026-09-04 (end of Phase 9)

## Current state

- The product has curriculum content compiled in (Phase 5), a working learning engine over it (Phase 6), the Command Center, Campaign and Skill Map (Phase 7), the Academy (Phase 8) and the exercise runner (Phase 9). Two exercise families can be finished end to end; the five that need a simulated account, an execution log or a workflow build wait for Phases 10 and 12. Evidence that no runnable family produces still enters through the diagnostic form on `/system`.
- `/system` (diagnostics) and `/design` (gallery) exist only in local and preview environments; both are off in production by flag.
- The semantic components are presentational: Phase 7 wires SkillCard, HoloTerritory, MasteryBadge and StatusPill to the learning engine; the simulator components are wired by their phases. Prop shapes may still change when those data models land; they share tokens, so the visual language will not.
- Deployment is live: every push to `main` deploys the `bloomlab` Worker (https://bloomlab.cool-sunset-2169.workers.dev) and every pull request redeploys the single shared `bloomlab-preview` Worker (D-020). Both hosts are public `workers.dev` URLs serving the foundation app with no learner data. D1 databases and R2 buckets do not exist yet (Phase 4).
- The dev machine runs Node 22.18 while `engines.node` is `>=22.22.0` (react-router 8's floor). Everything works locally with npm engine warnings; CI uses the latest 22.x.
- GHL feature names are verified only for the 34 registry records (Phase 5); the gallery samples in `/design` still use illustrative labels and are not wired to the registry (GHL-005 / GHL-010 apply from the screens onward).
- The ~128k ElevenLabs credits have an expiry window; voice asset generation (VOI-005) is scheduled for Phase 20. Risk: credits expire before Phase 20. By design this is not a functional dependency.
- Prettier does not format Markdown (`*.md` is ignored) so the control documents keep their hand-laid tables.

## Phase 9 — exercise runner

- **Two of the seven Phase 9 families can be finished by a learner today.** Architecture Decision and What Would You Build read only what the learner chooses and writes, so they run, grade and record. Build It, Fix It, Run the Lead, Edge Case and Rebuild Blind have their brief, work capture, hint ladder, attempt lifecycle and grading contract, but their checks need the simulator core (Phase 10) and, for building, the Workflow Lab (Phase 12). The runner names the missing runtime and offers no submit; it never grades a description as if it were a build.
- **Both runnable families end in `partial`, not `passed`.** Each names a rubric, and rubric grading is the AI gateway (Phase 19). The deterministic checks run and are reported, the written work is preserved, and the evidence result is `partial` — which the mastery engine treats as not a pass, so a skill reaches LEARNING and no further. Nothing fabricates a rubric score.
- **The score is the share of required and quality checks passed** (D-067). Bonus checks are reported and excluded from the denominator; critical checks are a gate, never a number. The authored per-dimension weights (correctness, edge cases, architecture, maintainability, explanation) are **not** applied, because no authored assertion says which dimension it belongs to; EXR-023 owns that model in Phase 12.
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

## Simulator approximations versus real GHL

None yet — no simulator exists. When populated, each entry records: feature id, fidelity (A / B / C / REAL_GHL), what differs from real GHL, and why.
