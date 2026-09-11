# Changelog

Phase 22 — Fieldwork (2026-09-08): enriched the existing fieldwork schema compatibly and made the authored Snapshot portability task usable through the exercise runner. Added durable keyed proof, private PNG/JPEG/WebP screenshot recovery/deletion, a proof checkpoint before reasoning, explicit manual GHL confirmation and idempotent fieldwork mastery evidence. Added Dexie v6 and D1 migration 0006 without changing older schemas, direct FLD-004 regression, private asset security tests, sync/persistence/UI tests and a five-width browser probe. FLD-001/EXR-020 remain human-unverified; GHL API verification stays deferred and the PR remains draft for independent audit.


Phase 21 closure (2026-09-08): PR #23 merged as `59ec678910cb51559d84af3c4200590f9c7e29ec`. Main CI `34267608095` Checks and Production deploy succeeded; Preview skipped. Production migrations `0004`/`0005` succeeded; 40 voice metadata rows verified; Worker `291517ab-8f2b-44d3-96aa-6dd7a615cc6c`. All previously documented limitations and seven unverified rows remain.

All notable changes to Bloomlab. Format follows Keep a Changelog; versions follow `app_version` (spec §101).

## [Unreleased]

### Fixed — independent closeout continuation

- Diagnosed the retained exact-head Workflow failures with a Chrome trace: sync status/scheduling
  now use the existing IndexedDB status index instead of repeatedly cloning queued snapshot payloads.
  Performance ceilings remain unchanged; failed-work indicator behavior is preserved.
- Corrected CRM Custom Fields headings and sanitized asynchronous private-media export failures.
- Added real AI-Off learner routes and a failing dependency control, missing-binary Preview restore,
  held-fault isolation and newer-local-work retry assertions, and native keyboard Lab operations.
- Reopened GHL-005/GHL-010 and DES-018 where prior evidence overstated exhaustive naming/state
  coverage. Preserved all prior failed runs, the twelve human rows, and all performance thresholds.

### Changed — Field-Ready v1 code/audit closeout

- Added a whole-product AI-Off harness and learner-owned v9 local migration/inventory; every
  deterministic learning/Lab/save path is exercised without Worker AI, and every persisted record
  is scoped to its learner without adding commercial account infrastructure.
- Enforced immutable RUN THE LEAD predictions before Lab execution and replayed actual observed
  events with mismatch evidence. Exhaustive open-architecture, pricing and negotiation fixtures
  expanded, while broad semantic-quality rows remain PARTIAL.
- Added private R2 scenario attachments and checksum-verified staged `.blb` binary recovery with D1
  metadata only, plus controlled Call/Workflow/AI/sync failure-isolation probes. Preview-only
  migration 0008; no production action or provider spend.
- Added an AST/YAML/MDX HighLevel terminology registry audit. Corrected the previously conflated
  standard Webhook and distinct Custom Webhook records from current official sources without
  claiming live GHL parity.
- Replaced hand-picked screen lists with a router/content-derived inventory: 43 learner screens,
  all 17 exercise families, 215 five-width layout cells and explicit state/input/reduced-motion
  evidence. Added real phone assertions for Skill Map territory selection and Inbox composition.
  Human hierarchy/density/material/long-session review stays open; DES-009 is regression-only.
- Retained seven objectively evidenced P0/P1 promotions after independently reopening three unsupported claims. Preserved all twelve IMPLEMENTED_UNVERIFIED rows,
  all semantic/human/device/provider/real-GHL boundaries, and the independent-audit/no-merge gate.
  Draft PR #32 targets `codex/navigation-shell-redesign`; exact-head Preview evidence is attached to
  the PR rather than self-referenced inside the source commit.
- Bounded and memoized recent Workflow history while keeping older runs available, removed repeated
  date-formatter allocation, and hardened deployed navigation, restore-focus and controlled
  fieldwork-upload verification against commit-time races; the strict 500-event performance and
  five-width interaction thresholds remain unchanged.

### Changed — Field-Ready v1 independent-audit remediation

- Added actual active-client Home state and local Workflow draft checkpoint/reload recovery.
- Completed the interrupted R5 sync ownership fix: D1 migration 0007 preserves all existing rows
  while replacing global IDs with learner-scoped primary keys across 13 sync tables. Added
  collision/update/tombstone, byte-preservation and migration rollback/retry regressions; deployed
  sync probes now reuse curriculum IDs across learners and check each owner's data independently.
- General sync review now checks the saved note's persisted outbox payload while offline rather
  than assuming the diagnostics queue contains exactly one operation; negative cases remain failing.
- Fixed late-booking temporal grading and added in-runner actual-event playback with reduced motion;
  prediction-before-Lab enforcement remains an explicit gap. Proved later open architecture writing.
- Added learner-authored removable fee portions so scope changes can alter quote/payment without
  revealing hidden economics; broad pricing/negotiation semantic acceptance remains open.
- Added registry-native naming and exact B/C limitation projection, source credential regressions,
  read-only cloud privacy CI gating, and stable-only precaching with visited-route offline recovery.
- Reconciled only objectively supported audit rows, including authorized INF-015; kept all twelve
  human/real-GHL statuses parked. Added five-width short-height, keyboard/touch, offline and new-surface
  regressions; exact-head Checks/Preview use the source SHA. Preview-only migration/deployment;
  no merge or provider spend.

Evidence and remaining gaps: `docs/reviews/field-ready-v1-remediation.md`. Historical Phase 26
precache and Phase 17 scope-price limitations below describe their original closure checkpoints.

### Added — Phase 26 recovery, search and maintenance

- Strict bounded version/schema/ownership validation and explicit preview/confirm/cancel for local
  Restore Backup. Atomic add-missing merge keeps existing records and tombstones, safely replays
  compatible simulator history, recalculates progress and queues local changes without false sync.
- Private client-side search across skills, GHL features, lessons, glossary, clients and actual
  local attempts, with ranked results, fragment bookmarks, keyboard focus and offline recovery.
- Deterministic dated GHL freshness JSON/Markdown with a 90-day threshold and truthful status,
  source/date/fidelity/limitation metadata; no automatic research or provider call.

### Changed — Phase 26 restrained interaction and recurring hardening

- Polished the six existing signature moments with immediate readable results, quiet skippable
  independent/Field Ready recognition, live reduced-motion settlement and neutral offscreen Holo.
  Added five short optional default-off local sound cues with persistent mute and failure isolation.
- Added actual pinned axe-core CI across major routes and failed Sync linking, an unnamed-button
  negative control, and a committed six-area accessibility/state review. Fixed locked Skill Map,
  Incident and four recovery-copy contrast defects; Escape from phone More restores trigger focus.
- Added fresh-result adversarial CI covering all fifteen authoritative cases, with a missing-email
  fixture and registry-integrity checks. Expanded five-width/short-height browser evidence and
  strengthened native pricing-label and exercise/offline assertions. Academy's route execution is
  lazy, but the existing broad offline precache remains an explicit PERF-001 limitation.
- Twelve directly evidenced requirements promoted; all other statuses, twelve human-acceptance
  gates, PRI-001/002 and NEG-003 preserved. INF-015 remains independent-audit only. No provider spend,
  migrations, content/version changes, production deployment or merge; draft PR #28 targets Phase 25.

### Fixed — CUR-023 webhook freshness audit

- Current Marketplace webhook guidance now requires X-GHL-Signature with Ed25519 only after 1 September 2026. Removed stale transition guidance from the lesson and API registry notes; legacy RSA is historical/deprecated context only. Added a corpus-wide curriculum regression and negative stale-copy cases. The local-fixture practical and all requirement statuses are unchanged.

### Added — Phase 25 post-Field-Ready paths

- Seven compiler-enforced curated routes over the existing graph, with the recommended Bloomwired Operator Path. Campaign selection is bookmarkable and shares actual evidence; preview wording preserves unfinished Field Ready and manual human acceptance.
- Loading/error/retry, path-contract mutation and shared-progress regressions; committed five-width path/map, keyboard, touch, offline and reduced-motion probe. The independent 104 px rail and short-height regression remain intact.

### Added — Phase 25 GHL AI and supporting specialties

- Six deterministic-first GHL AI units/practicals cover current product roles, customer messaging/voice, workflow actions, knowledge, tools/permissions and operational risk. The compiler rejects AI skills that lose their deterministic prerequisites.
- Eight grouped units/practicals represent all 23 supporting specialties in the master graph, with 31 current official feature records and truthful conceptual fidelity. AI Off completes every new practical; no runtime model or live external action is introduced.

### Added — Phase 25 SCALE and retention checkpoint

- Nine units/practicals cover template release discipline, snapshot portability, agency boundaries, specialist distribution, evidence-based retention and four distinct Bloomwired vertical Demonstration Builds.
- Content-derived learn/practical enforcement and AI-Off contract mutation tests preserve real-GHL fieldwork and exclude specialist distribution from Field Ready. No live snapshot, account provisioning, client-outcome claim or paid call.

### Added — Phase 25 advanced Labs checkpoint

- Shared-account companies, typed custom objects, associations, narrow object notifications and live Smart Lists; class capacity and service-resource availability with booking/rescheduling enforcement.
- Payments Lab products/prices, links/invoices, explicit subscriptions, failure/retry/refund lifecycle and shared workflow/revenue consequences. Four sourced units and account-backed practicals use existing grading and persistence.
- Typed/reference/idempotency/replay regressions, loading/error/empty presentation tests and a committed five-width account-flow/grading probe. Synthetic data only, no migration or paid provider, no parked human-status change.

### Added — Phase 25 CONNECT checkpoint

- Nine sourced CONNECT units and nine local fixture practicals reuse the Academy, runner, deterministic grader and existing evidence persistence. Advanced learn/practical coverage is compiler-enforced and emitted as a derived report.
- Current HighLevel API version, Private Integrations, Get Contact and Marketplace webhook records state their local-only fidelity. No secrets, account connection, fake terminal, provider call or deployment exercise.
- Fixed long JSON help-text overflow at 320 px and labelled fixture work truthfully without an ungraded free-response box. Preserved independent rail scrolling and all parked human acceptance.

### Added — Phase 24 Field Ready

- Completed eight-area placement and Gates 1–12 with enforced topic/identity/time/Bloomwired coverage, nineteen-test QA, fourteen judgments and required sales/delivery work.
- Added twenty persistent clients, five practical starter projects and an eleven-stage Boss Client whose scope choice adds later QA. IndexedDB 8 and strict existing D1 metadata sync retain notes and canonical selections with explicit conflicts.
- Composed the independent capstone with nine inputs/actions, eight submitted reasoning answers and manual GHL proof. Completion requires all campaign/project evidence and ten independently evaluated readiness areas. Human acceptance stays unverified; no provider spend, GHL inspection, production deployment or merge.

### Added — Phase 23 portfolio and local data export

- Real Portfolio shell/list/detail routes collect saved project work into ten normalized artifact references with authored Simulation Project/Demonstration Build labels and explicit missing evidence. Submitted build representations are preserved with new attempts; existing private Fieldwork screenshots retain owner checks and truthful deletion/unavailability states.
- Dexie v7 and existing D1 metadata domains use the shared outbox/pull path, stable contribution IDs, tombstones and explicit reflection conflicts. Content `2026.09.20` completes ten categories in the two templates and links the existing consultation funnel exercise.
- Export Bloomlab Data creates a validated versioned six-group local JSON download, excludes session/provider secrets and binary media, and exposes retry without changing saved records. No restore, public sharing, GHL API verification or broader progression was added.
- Stacked draft against Phase 22 for independent audit, with focused/full tests and five-width browser review. Phase 22 human-acceptance statuses remain unchanged.

### Fixed — Phase 21 update-check recovery

- Failed app-update checks now show a visible retry even before a newer build is known. Retry shows progress, prevents duplicate checks and clears the notice when the loaded build is current. Discovering a newer build still requires an explicit reload after call work is safe.
- Added UI regressions and a five-width browser probe for failed checks, touch retry, keyboard recovery and no unintended reload. See `docs/reviews/phase-21-update-check-recovery.md`.

### Fixed — Phase 21 clean restart and PWA freshness

- Start fresh call now confirms deletion of all raw recordings, including retained audio, cleans up through authenticated routes and atomically replaces an unfinished attempt. Cleanup errors preserve the old attempt and remaining audio for retry. No abandonment grade or mastery evidence is written; private server transcript/turn metadata and generated client audio remain documented.
- A waiting/new service worker or uncached Worker build mismatch shows Update available. Reload requires a click and waits through capture, Blob saves, STT, transcript confirmation and final feedback. The browser and Worker expose the same public immutable CI head; offline precaching and API NetworkOnly remain active.
- Added restart/reload-safety regressions and real two-version PWA probes alongside fresh four-turn Northwind and existing loading/AI/voice checks. Existing conversation/loading components and all grading, speaker, privacy and budget safeguards retain their contracts. Physical Safari findings and broader unverified rows remain explicit; see `docs/reviews/phase-21-session-freshness.md`.

### Fixed — Phase 21 final UX polish

- Long Call Room actions now show a spinner, specific busy label and accessible live status at the invoked control. Confirmation and its retry keep the saved text/control visible; feedback, client replay, recording replay/deletion and audio updates explain their waits. Existing phases/request state own progress; reduced motion retains static busy indicators and text, and duplicate submission stays blocked.
- A delayed restore response can no longer replace newer local edits or a pending confirmed turn. Its regression holds the old response through confirmation and proves the same text and retry identity survive.
- Guided/practice authored fallbacks show a secondary cue from the current move label or existing anchor/objective. The cue clears on progress and never mounts in independent/pressure calls. No scenario, turn limit, grading, provider, privacy or microphone lifecycle change. Scripted conversation and the Safari browser findings remain limitations.
- Focused UI regressions and delayed browser probes cover loading/error/retry, exact saved confirmation, two fallback loops, advanced-aid DOM absence, five widths, touch, keyboard, reduced motion and local-first persistence. See `docs/reviews/phase-21-final-ux-polish.md`; no broader human acceptance promotion.

### Fixed — Phase 21 proposal feedback reliability

- A repeatable proposal failure exhausted the generic rubric array and then citation validation during repair. The call-specific provider schema now requires all eight named dimensions, converts them to the unchanged saved/public array, and guides the single repair using a fixed validation cause. Speaker, critical/required, citation, timeout, token-cap and budget safeguards remain in place.
- Content-free diagnostic metadata is recorded with each accounted response through additive migration `0005`. A saved four-turn proposal can retry the same failed run without recording again; concurrent retries are refused, successful feedback replays without spend, and unknown prior billing stays reserved.
- Human evidence now includes iPhone Safari microphone capture and completed Mac Chrome proposal mechanics. Mac Safari Private Blob failure, repeated microphone permission prompts, slow interaction and scripted conversation remain limitations. The deployed correction accepted a fresh eight-dimension proposal on its first response ($0.022658) with reviewed attribution and zero-cost replay. The original human four-turn proposal then recovered feedback on its first corrected response ($0.0154112, no remaining reservation), confirmed by the user and scoped metadata, with no re-recording. CALL-003 returns to PASSED; no unrelated acceptance promotion.

### Added — Phase 21 · Call Room (live acceptance pending)

- One content-driven dark Call Room in the existing exercise runner: cold call, discovery, proposal presentation, negotiation and client explanation. Explicit recording/transcript/branch/audio/recovery phases, notes drawer, guided anchors and advanced aid exclusion.
- Native bounded MediaRecorder capture into a separate local-only Dexie v5 Blob table before authenticated upload. Private R2 recording CRUD, R2-first recovery, metadata-only additive migration `0004`, retained-audio replay/deletion and transcript-first default cleanup.
- Worker-only Google STT V2 with RS256 service-account OAuth and in-memory token reuse; original/corrected transcript review and explicit confirmation. Existing conversation/negotiation/pricing engines are shared with the Worker, with durable turn claims, authored fallback, bounded classification and private cached authorized TTS.
- Exact eight-dimension call rubric and `call_feedback` accounting. Server-confirmed text feeds feedback; objective critical/required gates stay authoritative. Guided assistance labels and fresh-attempt history are preserved correctly.
- Content/grader `2026.09.18`; app, simulator and mastery unchanged. Controlled browser/provider tests and a dedicated five-width touch/keyboard probe; secure setup/recovery runbook and review evidence. Preview now has the Google `secret_text`, preview-only call gates and a required-secret deployment check. Supplementary live prerecorded-audio diagnostics verify recognition, private storage/recovery and grading; real microphone/full phone and keyboard calls remain outstanding; dynamic TTS and minimum grading acceptance are recorded below. Production stays off; Phase 21 is not marked complete.
- Preview acceptance found inherited 14px call inputs. Notes, transcript and move controls now use 16px, with a browser regression at 390/320. Production refusal is also pinned by a regression even when preview-style settings and a test provider are supplied.

### Fixed — Phase 21 acceptance remediation

- Call feedback now receives numbered client context and confirmed learner evidence, with explicit attribution rules for every rubric explanation. Existing saved rubric runs retain their identity and are not repurchased.
- Authorized open-response text selects a bounded literal quote deterministically; strong-model extraction is removed. Dynamic ElevenLabs usage receipts persist in the existing generation ledger and private R2 recovery metadata, including cache and uncertain-purchase regression coverage.
- The full-suite run exposed an existing AI-settings test race: the default Limited selection was mistaken for a completed server refresh. The regression now waits for loaded account usage before checking persisted mode.
- First deployed remediation acceptance proved dynamic ElevenLabs synthesis (69 billed characters) and cache reuse, but exposed a further client-only ServiceTitan citation in grading. Call feedback now verifies quoted evidence against confirmed learner text before accepting it, using the existing single repair path. Live validation also exposed the shared 30-second grading deadline; call feedback now gets a speaker-aware provider envelope and a tested 90-second bound. One fresh eight-dimension grade now passes manual attribution review ($0.018342, no reservation); the second proposal sample is a documented validation failure. CALL-003 and VOI-003 advance to PASSED. Seven rows still require real phone/desktop microphone acceptance, where execution stops for the user. Production stays disabled. An older timed-out review purchase retains its conservative reservation pending billing reconciliation.

### Added — Phase 20 · Voice Assets

- Five first-class voice-character YAML records with verified ElevenLabs catalog IDs, the seven-field identity/settings contract and eight reusable lines per client. Bidirectional client references, line uniqueness, emotion bounds and generation inputs are validated; content advances to `2026.09.17` with a regenerated lock.
- Authenticated preview/local generation for authored IDs only, centralized multilingual_v2 / mp3_44100_128 configuration, bounded/sanitized provider responses and atomic durable generation claims. Immutable R2 keys preserve purchased audio; failed metadata writes recover from R2 without another TTS call.
- Private development/production R2 bindings and migration `0003_media_assets.sql` for metadata and generation jobs. Authenticated playback supports ranges and learner ownership with no provider import or runtime key dependency.
- `/system/voice` diagnostics with stable client selection, transcript fallback and real saved-audio playback. Voice calls stay off; recording, transcription and the Call Room remain later phases.
- Repeatable audition/generation/promotion commands, a reviewed metadata manifest and CI coverage/indexing gates. Exact bytes go to production R2 without a second purchase; production migration and Worker deployment remain post-merge.
- Focused schema/security/Worker tests, browser secret scans and a real-infrastructure five-width voice probe; existing sync and navigation probes re-run. See the Phase 20 review for measured usage and complete evidence. Simulator, mastery and exercise-grader versions are unchanged.
- Security closeout (2026-09-08): the user confirmed revocation/rotation of the old ElevenLabs key and a replacement preview Worker secret, completing the required pre-merge remediation. Documentation/evidence now records the completed rotation; SEC-001 remains PARTIAL, audio is not regenerated, and production needs no ElevenLabs key for saved playback.


### Documentation — Phase 18 closure

- PR #20 merged at `154a00a73d659b92f0cc871f636462a9cb094f4b`. Main CI `34072172459` SUCCESS: 1,570 tests across 93 files, Checks SUCCESS, production D1 migration SUCCESS with none pending, production Wrangler deploy SUCCESS; preview correctly skipped on main. Historical Phase 18 review evidence remains unchanged. Phase 19 is current.

### Added — Phase 18 · Negotiation

- Standalone Summit NEGOTIATE IT with six actions, seven authored strategies, ten executable objections, configurable scope/phase/concession terms and natural multi-turn client replies.
- Pure attempt-local transition engine and authoritative negotiation grading projection. Typed hidden overrides, bounded deltas and state-dependent reactions/decisions; no hidden numeric UI.
- Phase 17 economics reused per real scope and delivery stage. Harmful offers remain in grading history; professional loss can score highly and an accepted below-cost deal fails critically.
- Shared queued persistence for every draft field and turn, completed transcripts, fresh retries and legacy saves. Save failure prevents stale sending; incomplete conversations cannot finalize.
- Build-time strategy/target/fallback/scope/economics/coverage/reachability/path validation, engine and screen regression tests, and `review:negotiation`.
- Content and grader version `2026.09.16`; simulator/mastery/rubric unchanged. NEG-003 remains PARTIAL for real language interpretation; mixed success stays rubric_pending. No Phase 19/20/21/24 work.

### Added — Phase 17 · Pricing Arena

- The authored half of pricing in content: `pricing` on a PRICE IT exercise carries the currency, the hourly delivery cost, the risk contingency per point, the margin band, the timeline policy, what a revision round costs, the client's own requirements and the scope lines that answer them. Each line names its hours, what removing it leaves the client with, what it depends on, whether it can be removed at all, and which of SAL-016's thirteen dimensions it makes the learner think about. Strict validation refuses a dependency loop, a removable line with nothing said about removing it, a requirement pointing at scope that does not exist, a scope-training exercise missing a dimension, a pricing block on anything but PRICE IT, and a proposal that is not all eight sections.
- A sixth learner-state root, `price`, and the pricing engine behind it in `apps/web/src/exercise/pricing/` (D-160, D-164). Money is whole dollars rounded once at the boundary, a percentage over nothing is `null`, margin divides by revenue and never counts the retainer, and the deposit becomes one canonical dollar figure whichever way the learner expressed it. Grader `2026.09.15`.
- The deal desk in the runner: seven areas of one object — what the client asked for, what is in the deal, the price, how it is paid, how long it takes, what recurs, and what is not included. The learner's own arithmetic is in front of them the whole time (the total, what is due on signature, what is left on delivery, what a monthly fee comes to over a year) and none of the hidden economics are (D-162). Taking a line out says what it leaves the client with, marks any requirement nothing in the deal answers any more, and names a line left depending on something removed.
- The reveal after submitting: the hours the kept scope came to, what revisions and a compressed timeline added, what it all cost to deliver, the contingency the scenario's risk asked for, the margin the quote carried and what a target margin would have needed. No correct price is stated, because there is not one.
- The floor is derived rather than authored (D-161, D-163). The seed exercise's untraceable `price.total gte 1200` is now `price.at_or_above_floor`, computed from the 22 hours its scenario authors at the rate its exercise authors, and the content build fails when a pricing block's scope hours and its scenario's `estimated_labor_hours` disagree.
- Content: `EX-PRICE_IT-summit-application-funnel` rewritten as a real deal desk against Summit's economics; `SC-glowhaus-two-locations` and `EX-PRICE_IT-glowhaus-two-locations`, the scope training that walks all thirteen dimensions with an opening date twelve days out and grades deterministically end to end; `EX-WRITE_IT-summit-proposal`, eight sections a client can say yes to; and `LU-pricing-models` and `LU-pricing-the-number`, which teach the ten pricing concepts PRI-003 names. The Application Funnel Proposal project gains its proposal stage. Content version 2026.09.15.
- 96 new tests (1456 total) and `npm run review:pricing` (17 sections), which prices a real deal in Chrome across the five review widths, checks at each one that no hidden economics have reached the page, submits an underpriced quote and reads back the critical failure, and drives the whole desk by keyboard.

### Fixed — Phase 17 audit

- Independent review found that invalid negative pricing inputs could lower the internal delivery cost, because a negative revision count was multiplied directly into hours. Pricing parsers and quote normalization now reject impossible negative values, and the deal basis clamps malformed legacy revisions before they can affect cost (D-165).
- PRICE IT required constraints are now gates. A missing one of the eight required answers, a broken requirement, or another failed required deal constraint cannot be averaged away by unrelated quality checks and still pass (D-165).
- Margin policy no longer uses the rounded whole-percent label as its boundary. A true 39.6% margin may display as 40% but still misses a 40% floor; the reveal labels the percentage as rounded and names the exact dollar floor (D-165).
- The Summit proposal no longer claims to read the learner's prior PRICE IT attempt. Phase 17 has no cross-exercise Boss Client continuity, so the proposal drill now carries an explicit priced scope of its own and says it is standalone (D-166).

### Known limitation — Phase 17

- PRI-001 asks for a visible price change when a scope line is removed and EXR-016 forbids showing hidden economics before submission. The structural half is done; the price half waits until after submit, where the floor moves with the scope. Recorded in D-162 and left PARTIAL rather than reworded.
- PRI-002's reasoning feedback is not evaluated. `PRICING_REASONING_RUBRIC_V1` is named and the explanation is preserved, but the Summit exercise reports its deterministic score and `rubric_pending` until the AI gateway (Phase 19). The rubric was not edited: its first item duplicates a check the engine now makes deterministically, and changing it would change a contract attempts were judged under.

### Added — Phase 16 · Sales Exercises

- The authored half of the selling families in content: `sales` on an exercise (the evidence a learner can see, the hidden prospect briefs, the minimum findings, the presentation frame) and `conversation` (a branching client thread). Strict validation refuses what could not honestly be done or judged — an AUDIT IT with nothing observed first-hand, a prospect list where no business is right to skip, a Maybe that does not name what it is waiting on, an EXPLAIN IT with one audience, a thread that branches nowhere or ends nowhere, and a check on a sales figure the family does not produce. A hidden fact copied into learner-visible copy now fails the build (`HIDDEN_FACT_EXPOSED`).
- Five learner-state roots and the pure projections behind them (D-151): `prospects`, `audit`, `message`, `explanation`, `conversation` in `apps/web/src/exercise/sales/`. One word counter, one talk share, one evidence rule, used by the work area and by the grader. Grader `2026.09.13`.
- Four work areas inside the one runner: a business at a time with its evidence beside it and Contact / Maybe / Skip; a finding composer held to Verified / Likely / Unknown with the support rule said on the spot (D-153); a message with its cap counted as you type, the one next step it asks for and the evidence it may cite; and the same system explained twice for two readers.
- The written client thread (D-154, CONV-002): the client writes, the learner picks what they are doing and writes back, and the branch follows the move. Sending without picking one takes the authored fallback and the client asks what was meant. The exchange survives a reload and travels with the finished attempt; nothing anywhere says "Correct."
- Talk share and the early pitch as deterministic figures (D-156): a whole percent of the thread, penalised above 60 and not at it, and a pitch at or before the turn the client agreed on, which is a critical failure in the discovery exercise.
- Jargon counted against the glossary, which gains `owner_safe` for the terms an owner already uses (D-155), and frame coverage read from the exercise's own markers rather than from the words "problem" and "outcome".
- The selling families now write their own evidence kind: `sales_use` for PROSPECT IT, AUDIT IT, WRITE IT, SAY IT, PRICE IT and NEGOTIATE IT, `explanation` for EXPLAIN IT. The finished response is kept on the attempt record, so a thread is still there after it is submitted.
- Content: `CL-ridgeline-roofing` and `CL-halcyon-yoga` (two businesses that are genuinely prospects, one of them right to skip), evidence packs for Northwind's outside-in audit, `EX-PROSPECT_IT-three-businesses` with hidden per-business evaluation (D-152), eight WRITE IT briefs covering all fifteen pieces EXR-014 and SAL-013 name, `EX-EXPLAIN_IT-no-show-system` for two audiences, and two authored threads: written discovery with Marcus and the nine days of silence after the proposal (D-159). `SALES_DISCOVERY_RUBRIC_V2` and `WRITTEN_COMMUNICATION_RUBRIC_V2` carry their topics and concepts as data (D-157); V1 of each is untouched. Content version 2026.09.13.
- 164 new tests (1360 total) and `npm run review:sales` (24 sections), which drives the real screens across the five review widths, the keyboard path and reduced motion.

### Fixed — Phase 16

- **Attempt persistence had two lost-work races (D-158).** Every keystroke saves, and a sales work area has many fields. Writes are now queued per attempt so two edits cannot overwrite one another. Independent review found the submit-side race as well: pressing Run it while the latest save was queued could grade and preserve the older React snapshot. Submission now flushes pending writes and reloads the persisted attempt before grading; a failed latest save refuses finalization instead of recording stale work.
- **PROSPECT IT schema now enforces the EXR-012 minimum of three businesses.** The Phase 16 exercise authored three, but the family validator still accepted a future two-business exercise. The schema and regression fixture now refuse fewer than three.

### Added — Phase 15 · Troubleshooting and Reporting

- Funnel visit telemetry in the shared engine (D-134). Five events join the catalogue (51): `FUNNEL_VISIT_STARTED`, `FUNNEL_STEP_VIEWED`, `FUNNEL_SCROLL_RECORDED`, `FUNNEL_FORM_STARTED` and `FUNNEL_VISIT_ENDED`. A visit records where it came from, which steps it saw, how far down each one it got, which forms it started and how it ended. Reach only ever deepens, and a visit that has ended refuses more telemetry.
- `packages/simulator-core/src/reporting/`: one reporting engine and nothing anywhere else (D-136). Ten metric definitions with a one-sentence rule and a named denominator, one projection over the run's log, and a `MetricValue` that carries its numerator, its denominator and the ids of the events behind it (D-137). A rate over a zero denominator is `null`, and every surface prints Not enough data rather than 0%.
- `funnelAutopsy`: the six views EXR-010 and FUN-004 both name — traffic source, conversion rate, scroll behaviour, form completion, booking rate and drop-off — from one projection serving both the Autopsy lens and the Funnel Lab, so they cannot disagree.
- External services as account configuration (D-138): `external_endpoints` holds a URL, an optional auth header and token, an ok status, an unauthorized status and an optional outage. `answerFor` decides the response from those alone, so a webhook fails the same way every time and no request leaves the browser. Credentials are checked before an outage so auth failure and integration failure stay distinguishable, and header names are recorded while values never are (D-139). Webhook success is the HTTP status class, which is HighLevel's own rule (D-140).
- A bounded, teachable workflow loop (D-141, D-142, D-148). Two workflows re-triggering each other are stopped at an enrolment ten deep in one chain of causation, with a `workflow_loop` failure naming the workflow and the count. The account, the contact's tags and the runs that already completed are left exactly as they were, so the incident can be read afterwards. A run may also enter one node at most twenty-five times.
- `/reporting`, the Reporting Lab: the stage chain first, then the ten metrics as a table where each row opens to its calculation and to the events behind it, source performance with a detail view per source, response speed, and a diagnosis exercise. Run the window advances the account clock through the ordinary execution door.
- `/incident`, the Incident Room: a case list and a case file showing the symptom, the client's own words, the execution logs and the system state, with Reproduce it and links into the Lab that owns the configuration. Understated by design (DES-013): no animation, no siren colour, no fake terminal, no learner-facing monospace, and status said in words as well as in colour.
- The Autopsy lens inside the Funnel Lab's SIMULATE mode, showing the same six views over the visits the learner's own funnel actually received.
- `written` as a fourth learner-state root (D-146). An exercise authors `written_fields`, and the grader asserts on `written.<key>`, `written.<key>_mentions` and `written.<key>_answered`, so a FUNNEL AUTOPSY grades the problem and the hypothesis separately.
- Content: `SC-glowhaus-reporting` (three weeks of Glowhaus as 269 scheduled events and no totals — 40 visits from three sources, 14 leads, 11 bookings, 4 shown, 3 won, one refund, one failed payment, two contacts never reached), nine incident scenarios (`SC-glowhaus-incident-*`), `EX-FUNNEL_AUTOPSY-glowhaus-consult-traffic`, `EX-FIX_IT-glowhaus-reporting-bottleneck`, the scenario `incident` block and `external_endpoints` (D-143), and `GHL-WF-WEBHOOK` re-checked on 2026-09-06 for headers and authorization. Content version 2026.09.12.
- Ten regression fixtures with stable ids (PHONE-001, DND-001, WEBAUTH-001, FIELD-001, SLOTS-001, REENTRY-001, CONDITION-001, LOOP-001, INTEGRATION-001, BOOKING-001) and 48 new tests (1192 total).
- `npm run review:reporting` (21 sections) and `npm run review:incident` (20 sections), both PASS; `review:funnel` extended with `autopsy-lens` and `autopsy-empty` (18 sections).

### Fixed — Phase 15

- **An injected booking fired no appointment trigger (D-145).** Both appointment trigger matchers read `appointment_id` off the event, but a booking that does not name one has its id minted by the reducer — so a scenario or a Lab booking created the appointment and started nothing. `appointmentIdOf` now derives the id exactly as the reducer does, and both matchers use it. Pinned by fixture `BOOKING-001`. This is a Phase 12 behaviour corrected, not a Phase 15 workaround.
- **Scenario reference validation assumed everything existed at t0 (D-144).** A three-week history creates contacts, appointments and opportunities as it goes, and the validator rejected every reference to them. It now walks the scheduled events in queue order and remembers what each one creates before checking the next, so an honest history validates and a genuine dangling reference still fails.
- **The first loop bound called ninety test runs a loop (D-148).** It counted enrolments sharing an account instant, and a Workflow Lab Test Contact run never moves the account clock. The bound now counts enrolments in one chain of `caused_by`, which is one for a test and unbounded for a loop. Caught by `review:workflow` → `five-hundred-events` and pinned by two tests that run the same workflow twenty-five times, by hand and through its trigger.
- **The loop incident's Reproduce it action named a contact the account did not yet hold.** Once injectables were validated against the authored starting account (D-150), `SC-glowhaus-incident-workflow-loop` failed its own compile check: Linus arrived through a scheduled form submission, so an action a learner can fire at any moment referred to somebody who might not exist. Linus is now on the books from the first instant; the form submission and the loop it starts are unchanged.
- **The Reporting Lab computed one rate of its own.** The source table divided leads by visits instead of reading the report, which is exactly the second implementation REP-003 forbids. `SourceRow` now carries `conversion` and the screen reads it; `noFakeAnalytics.test.ts` fails the build if another one appears.
- **Funnel telemetry raced the learner's action (D-147).** Telemetry committed separately from the action it described used the run captured by the render that started the first commit, and undid it. Telemetry now rides in the same commit as the action, and an abandoned visit is queued rather than committed on its own.

- **Reporting now counts reducer-minted appointment ids.** A booking with no payload `appointment_id` already created `appt-<event id>` and fired appointment workflows through D-145, but the Phase 15 report initially ignored it. The projection now uses `appointmentIdOf` too, so the account, triggers and report identify the same booking.
- **Funnel booking attribution stays on the visit that produced it (D-149).** Live booking and payment actions carry `visit_id`; Funnel Autopsy uses that exact link when present instead of giving every funnel that ever saw the same contact the booking. Older unlinked authored history keeps a conservative contact fallback.
- **Injectables no longer validate against future scheduled creations (D-150).** Scheduled history still grows its known entity set in queue order, but an injectable is checked against the starting account because it may be fired before any scheduled event. An action can no longer pass content validation and then fail simply because its target has not been created yet.

### Added — Phase 14 · Calendar Lab

- Calendars as configuration in the shared account (D-126): type, timezone, duration, Slot Interval, pre and post buffer, Minimum Scheduling Notice, booking window, weekly working hours, an ordered team, an assignment rule, staff selection, services, meeting locations, a default location, booker permissions with a cutoff, and a version. Two events join the catalogue (46): `CALENDAR_CREATED` and `CALENDAR_UPDATED`, validated, logged and replayable like a workflow and a funnel definition.
- `packages/simulator-core/src/calendar/`: one availability engine, one assignment rule and one validation layer (D-127). Slots come from the simulator clock, the calendar's own zone, its hours, duration, interval, buffers, notice, existing appointments and who is free. A buffer is padding around an appointment and a slot is refused when either side's padding reaches the other's real time, so a 10:00–10:30 appointment with a fifteen-minute buffer leaves 10:45 bookable. A host is picked deterministically and the reason is recorded. Validation separates an impossible definition from one that simply has no times today.
- Appointments record what they were booked for (D-128): length, host, service, location and whether the customer or the team made the booking. Re-configuring the calendar never rewrites an existing appointment. The host is its own reference and is never the contact's or the opportunity's owner (D-130).
- `/calendar`, the Calendar Lab: a run of days showing what is booked and what is open in the calendar's own zone, the configuration beside it in five groups — Basics, Availability, Staff & assignment, Service & location, Booking rules — a test booking that can only use a time the engine offered, and confirm, reschedule, showed, no-show and cancel as real account events with the resulting chain printed underneath. One column with a settings sheet on phones; every control is a labelled form control with a keyboard path.
- Content: `SC-glowhaus-calendar` (a consultation calendar with no buffer, no notice and one host, two back-to-back appointments, a service calendar whose services are names, and reminder, recovery, confirmed and nurture workflows), scenario support for the whole calendar model, registry records `GHL-CAL-CALENDARS`, `GHL-WF-CUSTOMER-BOOKED-APPOINTMENT` and `GHL-WF-APPOINTMENT-STATUS` re-verified 2026-09-04 through search summaries of the official articles, content version 2026.09.09.
- Twelve regression fixtures with stable ids (SLOT-001, BUFFER-001, NOTICE-001, ROBIN-001/002, RESCHED-002/003, CANCEL-001/002, STATUS-001/002, CALDEF-001) and 108 new tests (1144 total).
- `npm run review:calendar` (22 sections across five widths with keyboard, touch and reduced motion), PASS.

### Fixed — Phase 14

- **A cancelled appointment can now start a workflow (D-131).** The Appointment Status trigger never listened to `APPOINTMENT_CANCELLED`, so a workflow filtered to Cancelled was unreachable through the shared engine and the no-show recovery skill could not be taught. The adapter now listens to all four appointment events and a cancellation exposes the status `cancelled` to filters. The appointment-scoped exit still runs first, so a reminder is pulled out before recovery starts. Pinned by fixture `CANCEL-001`. This is a Phase 12 behaviour corrected, not a Phase 14 workaround.
- **The Funnel Lab's own slot rule is retired (D-129).** Phase 13 computed the next three openings on the hour inside a hardcoded nine-to-five day; a funnel's calendar block now asks the shared engine, so changing the working hours, duration, buffers, notice or team changes what a visitor is offered. There is one answer to what is bookable.
- **A chosen slot is re-checked before it is booked or moved to (D-133).** The screen holds a slot from a render that may be seconds old, and the reducer only checks references and shapes — so a time somebody else had taken, or one a saved calendar edit had removed, could still be booked. Booking and rescheduling in both Labs now ask the engine again at the moment of the action and refuse in a sentence when the answer has changed. `slotAt` is also as strict as the picker now: the instant has to sit on the interval anchored to its working window's opening and inside the booking window, and a move keeps the length the appointment was booked for.
- **A staff booking stays a staff booking through a reschedule.** How a booking was made is recorded on the appointment, so Customer Booked Appointment does not fire for a rescheduled staff booking that carried no `booked_by` of its own.

### Added — Phase 13 · Funnel Lab

- Funnels in the shared account (D-118): `AccountState` gains `funnels`, a versioned definition of steps, the ordered blocks inside them and the account object a capture block uses. No styling, no layout, no pixel position anywhere in the model. Two events join the catalogue (44): `FUNNEL_CREATED` and `FUNNEL_UPDATED`, validated, logged and replayable like a workflow definition (D-119).
- `packages/simulator-core/src/funnel/`: validation that names what would stop a visitor and where, reading order and reachability, where a completed step sends someone, and what a visitor may do on a step with the account object behind it. Booking slots are computed from the run's own clock, never the device's.
- `/funnel`, the Funnel Lab: a step list, a block editor with eleven roles, a contextual inspector, a live rendering of the step being built, and a problem list — three columns on desktop, two on tablet, one column with labelled sheets on phones. Add, configure, connect, reorder, remove, undo, redo, save as one account event. Every reorder is a button, so there is no drag-only path.
- BUILD, PREVIEW and SIMULATE, with the mode and the preview width kept as device preferences (D-120) so a reload comes back where the learner left. Preview renders the built funnel at 1200 / 768 / 390 with real reflow inside a local scroller — nothing is scaled.
- SIMULATE walks a visitor through the learner's own architecture with the same renderer Preview uses. Every action is the account event it means through the Phase 12 execution door: `FORM_SUBMITTED`, `SURVEY_SUBMITTED`, `APPOINTMENT_BOOKED` and `PAYMENT_RECEIVED`. What the account did is read from the run's own log, in the run's order, with the generated events marked as caused.
- The funnel exercise runtime (D-121) and funnel architecture assertions in `packages/exercise-engine` (D-122): `funnel_step_exists`, `funnel_step_order`, `funnel_block_exists`, `funnel_block_absent`, `funnel_block_order`, `funnel_reference_connected`, `funnel_step_count_max` — partial-order and existence rules, never an expected sequence. Grader `2026.09.08-r2`.
- Content: `SC-glowhaus-funnel` (the pieces a funnel connects to and no funnel), `EX-FUNNEL_ASSEMBLY-glowhaus-consult-funnel`, registry records `GHL-FUNNEL-FUNNELS`, `GHL-FORM-SURVEYS` and `GHL-PAY-PRODUCTS` verified 2026-09-04 through search summaries of the official articles, scenario support for surveys, products and funnels, content version 2026.09.08.
- Four regression fixtures with stable ids (FORM-002, FORM-003, FORM-004, FUNNEL-001) and 96 new tests (1036 total).
- `npm run review:funnel` (16 sections across five widths with keyboard, touch and reduced motion), PASS.

### Fixed — Phase 13

- **FUNNEL ASSEMBLY now grades one complete funnel, not a composite of every funnel in the account (D-125).** Multiple saved funnels are evaluated independently; one incomplete funnel cannot supply capture while another supplies booking. Required architecture checks are gates for this exercise family, so quality points cannot make an answer pass when a required structural constraint is missing.
- **SIMULATE visitor history now starts from the last real event sequence.** Event sequence numbers also advance for execution records, so using log length could leak an older funnel-definition event into a later visitor session after several saves. The visitor chain now uses the event sequence watermark and has regression coverage.

- **A form submitted by someone the account had never met now fires its trigger (D-123).** The workflow matcher asked whether the contact existed at a moment when the submission's own generated `CONTACT_CREATED` had not been processed yet, so a brand-new lead enrolled in nothing — the whole of FUN-003 for the case that matters most. Reactions are now told which contacts the event is about to create, and the enrolment stays behind the creation on the same frontier, so the run never walks a contact that is not there. Pinned by regression fixture `FORM-002`. This is a Phase 12 behaviour corrected, not a Phase 13 workaround.

### Added — Phase 12 · Workflow Lab

- The workflow engine in `packages/simulator-core`: capability adapters keyed by `ghl_feature_id` for 21 runnable triggers and actions (D-105), trigger matching with data-only filters, one-node-per-event traversal with effects before continuation (D-101), five wait kinds (D-100), the Time Window hold on outbound messages (D-102), If/Else with ordered branches, AND within a group, OR between groups and an automatic None (D-103), re-entry, Remove From Workflow, appointment-scoped exits on cancellation and reschedule, graph validation (D-106), definition versioning (D-104), merge fields without `eval`. Six events join the catalogue (42): `WORKFLOW_CREATED`, `WORKFLOW_UPDATED`, `WORKFLOW_ADVANCED`, `WORKFLOW_RESUMED`, `NOTIFICATION_SENT`, `EMAIL_RECEIVED`, plus the `scheduled` origin.
- Twenty-three regression fixtures with stable ids (WAIT-001..004, RESCHED-001, BRANCH-001..005, TIME-001/002, REPLY-001/002, ENROLL-001/002, OVERLAP-001, MSG-003, EXIT-001/002, REM-002, TRIGGER-001/002, REPLAY-002) and 37 engine tests.
- `/workflow`, the Workflow Lab: canvas, palette, inspector, test panel, execution timeline with Replay on desktop; two columns on tablet; a vertical step editor with sheets on phones. Add, filter, configure, connect, reorder, undo, redo (D-110), save as an account event (D-107), enrol a contact, move time, watch the run travel. Every drag has a keyboard or menu path.
- One execution door with a stateless Web Worker and the same handler on both paths, crash-safe (D-109); one current-run rule shared with the CRM Lab (D-108).
- `/conversations`: SMS and email threads with workflow attribution; a reply as the contact releases reply waits and fires Customer Replied.
- `/playground`: every unlocked feature, by a stated rule (D-111), on a sandbox with no exercise.
- The workflow exercise runtime (D-112) and EXR-023 weighted scoring with critical override in `packages/exercise-engine` (D-113), grader `2026.09.07-r1`; BUILD IT, FIX IT and REBUILD BLIND are graded from real runs.
- The Academy's `<Simulation>` embed runs the engine and lists its execution records.
- Content: workflow config schemas, compile-time graph validation, assertion `dimension`, registry record `GHL-WF-WORKFLOW-SETTINGS`, all 21 runnable workflow records re-verified 2026-09-04 through search summaries of the official articles, content version 2026.09.07.
- `npm run review:workflow` (14 sections incl. frame timing over 500 events) and `npm run review:rail` (five widths), both PASS.

### Fixed — Phase 12

- **The default workflow test fires the configured trigger instead of enrolling by hand (D-114).** The test panel makes the event the trigger listens for from the smallest real context (an appointment and a status, a tag, a reply, a booking, a form) and the engine's matcher and filters decide who enrols; the outcome is read back from the account, including "the event happened but the trigger did not match". The direct path is a separate, labelled "Start at the first step", recorded by the engine as `enrolled_by: direct`, and the timeline row says the trigger was not fired. Fixtures TRIGGER-003 (no-show filter ignores a cancellation) and TRIGGER-004 (direct enrolment labelled, replay parity); the Academy embed uses the same real-trigger path.
- **The first execution plays its own trace (D-115).** A successful test starts playback automatically: rows, node statuses, connectors and the travelling dot are revealed from the engine's execution records, with Pause, Skip and Replay; reduced motion shows the whole trace at once; nothing beyond the playhead is shown as done; skipping never changes the account. The Lab's panels are memoised so playback ticks re-render only what they change.
- **Phone navigation shows its names (D-116).** The bottom bar no longer hides every label below 480 px: four areas show with their names and a labelled More opens the rest as a small labelled list; every area stays reachable and 44 px. The rail probe proves it at 390 and 320.
- The primary rail is drawn from one token (`--bl-size-rail`) with the page offset by the same token; it was 72 px with a separate hard-coded offset. Phase 12 first set it to the spec's 80 px, then D-117 widened it to 104 px with more padding, row height and title-case labels after a real screenshot showed the labels crowding the edge. The rail probe checks the token against the 96–112 px band; the real-tablet check of the 104 px rail is pending.
- Reordering the entry step downward in the Lab refused because the entry has nothing above it; it now moves the step after it up.
- The `ExecutionEvent` component dropped data attributes passed to it; it now spreads them onto the list item.
- The `REQUIREMENTS_MATRIX.md` heading carried a stray run of status words from an earlier edit; restored to `# REQUIREMENTS MATRIX`.

### Added — Phase 11 · CRM Lab

- `/crm`, a lazy route where the learner works one real training account: contacts as dense rows with a record inspector (standard fields as one form, do-not-disturb, owner, tags, custom fields, opportunities, activity, notes, tasks), the pipeline as a board with a stage picker on the deal, and Setup for custom fields and pipeline stages. CRM joins the rail with its own icon.
- One CRM command layer (`apps/web/src/crm/commands.ts`, D-094): every screen mutation is a simulator event processed by the engine and persisted by the Phase 10 store, returning the new run or a structured refusal. No CRM store in React; a source-level test fails if a screen cuts a second door.
- Ten internal simulator events — `CONTACT_ASSIGNED`, `OPPORTUNITY_ASSIGNED`, `FIELD_DEFINED`, `FIELD_UPDATED`, `PIPELINE_CREATED`, `PIPELINE_UPDATED`, `NOTE_ADDED`, `TASK_CREATED`, `TASK_UPDATED`, `TASK_COMPLETED` — with reducers, validation, replay and 35 engine tests. None is a HighLevel workflow trigger and nothing implies one is (D-092).
- State: `users`-referenced `owner_id` on contacts and opportunities that may differ (D-089); typed custom fields with an object and dropdown options (D-090); opportunity name, status and custom fields; notes and tasks attached to a contact or an opportunity (D-091). Scenarios author users, notes, tasks, owners and options, and validation refuses what dangles.
- A pipeline edit that would strand deals is refused unless the same event says where they go; Setup asks for the destination (D-093).
- Activity history derived from the event log in simulator order, with wording kept apart from meaning and ids resolved through the account at render (D-095).
- `SC-glowhaus-crm`, the CRM training account: five contacts with the gaps a learner has to notice, two users, a six-stage pipeline, four deals, notes, tasks, and Jordan's three `wants-*` tags as the seeded CRM-003 case. The Lab resumes the newest run and never merges or discards another (D-096).
- CRM-003's consequence: the CRM Lab is the first registered exercise runtime (D-097), and `EX-FIX_IT-jordan-treatment-interest` is graded from the learner's own account — failing while the interest is three tags, passing once it is one field. A runtime with nothing to read refuses the grade rather than failing the learner. Every workflow exercise stays exactly as un-runnable as before.
- Registry: `GHL-CRM-OWNERS`, `GHL-CRM-NOTES`, `GHL-CRM-TASKS` (fidelity B, verified 2026-09-03 through search summaries of the official articles because the build environment's proxy blocks the help centre — stated in each record).
- `npm run review:crm` (27-check flow probe: mutate, reload, offline, reconnect, reset, post-reset) and `npm run review:crm-review` (seventeen states at five widths, keyboard, touch stage move, reduced motion), both PASS.

### Fixed — Phase 11

- **Task due dates no longer depend on the device timezone (D-098).** The task form sent `${date}T09:00:00` with no offset, which `Date.parse` reads in the host's zone, so two devices would have stored two due dates for one choice. A chosen day now becomes 09:00 in the account's zone with that zone's offset on that day through `instantForDay` in simulator-core, and the engine refuses an offset-less `due_at` on `TASK_CREATED` and `TASK_UPDATED`. Nine regressions cover canonicalisation, device-zone independence, DST, display, refusal, replay, reload and sync.
- **Several saved CRM accounts are now offered, as D-096 said (D-099).** The Lab showed only a notice; it now offers a "Working in" selector, switches through the existing `switchRun`, records the choice on the device record, and the CRM exercise runtime grades that same run. Switching touches no run.
- The stage editor used a raw `<textarea>` inside `<Field>`, so its label pointed at nothing; it now uses the `Textarea` primitive and names its pipeline.
- Tag chips were 34 px on a coarse pointer; they are 44 px there now (A11Y-007).
- Two GlowHaus dropdown custom fields had no options; the content was fixed rather than the rule weakened.
- CRM screen files no longer export non-components (a `fullName` helper, a stray `Stack` re-export), which broke fast refresh; `fullName` lives in `crm/words.ts`.

### Added — Phase 10 · Simulator Core

- `@bloomlab/simulator-core` is the shared deterministic GoHighLevel engine: pure TypeScript importing nothing outside its own modules, with a source-level test enforcing no React, DOM, IndexedDB, Dexie, Cloudflare, `fetch`, Claude, `Math.random()`, `Date.now()` or any read of the machine's timezone. One simulated account across twenty-one id-addressed collections plus the run's event log, scheduled queue, execution records, clock and generator position — the twenty-two domains §43 names — transitioned by `State + Event + Configuration → New State + Generated Events + Execution Records`.
- All 26 catalogue events (§44) have real transitions, and a test proves the reducer map covers the catalogue exactly. Contacts, tags, opportunities and stages, appointments and their status, SMS and email in one conversation per contact with opens stamped on the message, payments and refunds with revenue, form and survey submissions that create or update the contact they name, workflow enrolment / step / exit with re-entry enforced, webhooks, and the clock's own event. Outbound messaging respects the two conditions GoHighLevel enforces — no phone, and do-not-disturb — as recorded skipped actions rather than silent drops.
- Transitions never mutate their input (proved by hash, `structuredClone` equality and per-collection checks) and generated events travel the same processing path as injected ones, so there is no second route into the state.
- Scenario-local clock (spec §45): ISO instants carrying their offset, absolute minutes and hours, and a calendar day that holds 09:00 across a daylight-saving change. Zones are data and are validated; nothing reads the device. The Time Machine's +1 minute, +1 hour, +1 day and Next Event really move the clock and run what is due, including consequences generated at the same instant.
- Deterministic scheduler with a documented total order — timestamp, insertion sequence, stable id (D-077) — and cascade protection that stops an unbounded same-instant cascade at 500 events per operation with an explicit diagnostic rather than a silent drop (D-078).
- Event Injector where the scenario decides what may be injected, refusing an action it does not offer and a malformed payload rather than coercing either into success; all seven §47 action kinds are proved injectable.
- One structured execution-log model with stable ids and deterministic order that stores data rather than display strings, so the interface derives its words and a later wording change cannot rewrite history.
- Seeded randomness (mulberry32) whose live generator word travels in the run, so a snapshot resumes the sequence rather than restarting it (D-081); snapshots as scenario + append-only log + a checkpoint every 25 events, each hashed and validated on restore (D-080); replay that re-runs only root events and regenerates consequences, so it reproduces a run exactly without duplicating an id or appending to the live one (D-079); `rewind` as replay to an earlier index; and reset that returns to the authored state without mutating the content object.
- Workflow data contract with behaviour separated from layout: moving a node from x=100 to x=900 leaves the behavioural view, the event log and the execution records identical (SIM-016).
- Scenario validation rejects duplicate ids, dangling references, impossible timestamps, invalid zones and seeds, unknown event types, duplicate node ids, dangling edges and — with the registry supplied — unknown or `REAL_GHL` features. The content compiler now validates authored event names, which caught three real bugs: `client.message` and `enquiry.response` are roleplay events (spec §39), not account events, and are now named as such rather than loosened into the catalogue.
- Simulator regression fixtures with stable ids (SIM-017): eleven that execute real behaviour, six reserved for Phase 12 that assert nothing and name their owner.
- Simulator saves ride the existing local-first sync path — `sim_projects`, `sim_events`, `sim_snapshots` on Dexie v4 and the D1 tables that already existed, so **no migration was required** (D-082). A run, its history, its queue, its clock and its generator position survive a reload; replay after a reload equals the live run; a reset persists; and no event fires twice because the page reloaded.
- Simulator → grader adapter in the app, outside both engines, proved against real simulator output: state, event, timing and sequence assertions all read from a real run, and `architecture` is never claimed (D-083). `EXERCISE_RUNTIMES` stays empty on purpose — no authored exercise can be graded until a workflow executes, so EXR-004 … EXR-007 and EXR-019 are unchanged.
- Internal harness at `/system/simulator` behind the `system_diagnostics` flag: scenario, simulator time, seed, engine version, account summary, scheduled queue, event log, execution records, Time Machine, injector, checkpoints, step back, replay and reset — all driven by the real engine, with the scenario in the URL so a reload returns to the run being inspected.
- The Academy's `<Simulation>` embed now shows the account the simulator actually compiles instead of describing a later phase; stepping a contact through a workflow still needs Phase 12, so CUR-036 stays PARTIAL.
- `SIMULATOR_VERSION` is `2026.09.05-r1` and is stamped on runs, saved runs, the health endpoint and evidence — the Phase 9 stamp is no longer fictional.

### Fixed

- **Tablet holographic corners (D-075, correcting D-074).** Real-tablet testing proved the D-074 fix incomplete. Re-measured under real touch at 1024 px and 768 px with a probe that samples computed style *and* decoded corner pixels at every pointer stage, three causes were found, none of them the layer clipping D-074 fixed: the global `:focus-visible` rule set `border-radius`, collapsing a focused card from 24 px to 6 px; the selection and focus rings were offset outlines, which older WebKit paints square around a transformed element; and the platform tap highlight was never disabled. The focus rule no longer reshapes what it focuses, every ring on a holographic card is a spread `box-shadow` plus a transparent outline for forced-colours mode, selection and focus compose instead of replacing each other, and the native tap highlight is cleared on controls that answer a touch themselves. Keyboard focus visibility is untouched and now follows the rounded shape.
- **Tablet holographic corners: REAL TABLET USER CHECK: PASS (D-086, correcting D-075).** The user tested diagnostic cards A to I on their actual tablet and reported all nine clean — no rectangular flash, no pointed-corner flash, touch-down, hold and release all correct, and the Skill Map's holographic interaction clean on the same device. The D-075 issue is confirmed fixed. Getting there took a change of method: three fixes in a row had been chosen from desktop evidence against a symptom only a real device showed, and each automated PASS had been mistaken for an answer, so this round shipped the instrument instead: `/system/holo`, behind the diagnostics flag, renders nine copies of the real interactive card with exactly one thing changed each — as it ships, no tilt, no shadow, no glare or grain, an explicit rounded `clip-path`, the tilt outside with the rounded clip on an inner element, no forced compositor layer, the glare and grain kept inside the card's box, and no blending — labelled A to I so the answer comes back as a letter. A tap counts itself and nothing more; selection is a separate control. `HoloMaterial` gained a `surface` prop (`single`, unchanged, and `split`) so case F is a real structure rather than a mock. The holographic touch probe drives all nine and reports them outside its verdict. Case A is the card exactly as it ships, so the fix is one of the two WebKit version gaps below — most likely the missing `-webkit-appearance`. What the diagnostic settled is that the material was never at fault: every case that removed a piece of it came back identical to the card that keeps them, so nothing about the holographic interaction was weakened. `/system/holo` is kept behind the diagnostics flag rather than deleted, because this symptom was misdiagnosed twice from a desktop.
- **Two WebKit-version defects fixed, and one of them is the likely cause of the tablet rectangle (D-086).** `button { appearance: none }` gained `-webkit-appearance: none`, without which D-075's stated suppression of the native `:active` chrome never happened on WebKit before Safari 15.4 — an older iPad is exactly the device it was for. `.rim` gained `-webkit-mask` and `-webkit-mask-composite: xor`, without which the conic rim gradient is never cut back to 1.5 px on those engines and washes the whole card under a finger.
- **A selected holographic card is lit, not fenced in (D-088).** The Skill Map's selected territory wore a 2 px ink ring, which read as a black-bordered form control among nine soft holographic cards. Selection is now drawn in the material's own vocabulary: a 2 px spectral edge in `--bl-color-lavender`, a soft lilac pool beneath the card, and the material itself waking up — its rim to full white, its glow to lavender — through `--holo-ring`, `--holo-glow` and `--holo-glow-ambient`. Both shadows are spread shadows on the untransformed button, so they follow its 24 px radius on every engine; no offset outline was added, and selection touches neither the radius, the clip, the tilt nor the layer promotion, so the holographic interaction is exactly the one the tablet passed. A selected card also says "Showing", so the state is never carried by colour alone, and it names what selection does: that territory's capabilities are open below. `HoloTerritory` now owns selected, focused and both-at-once in one place and the Skill Map draws no ring of its own; selected-and-focused composes as lavender at 2 px, focus blue at 5 px, the pool under both. Five design-rule tests lock it, two of which go red if the ink ring comes back.
- **Simulator reset identity (D-087).** A reset now starts a new **generation** of the run: a token minted at start and again, freshly random, at every reset, carried as a column on every append row and as part of every append id (`se:<run>:<generation>:<sequence>`, `ss:<run>:<generation>:<log length>`). Before this, a reset soft-deleted the run's history and returned the engine's sequence to zero, so the second life asked for the ids the first life had used and `saveRun` — which read every primary key for the run, tombstones included, as already saved — skipped them: a reset run recorded nothing and a reload came back to an empty log. Reset now touches no history row at all, so the earlier generations stay exactly as written, immutable and replayable, while the run keeps its id and its single header row and no second run appears in the list. Rows written before generations existed read as generation `0`, so a run saved by the earlier build still loads and resumes. Covered by four unit tests and a two-device sync test, each of which fails when the colliding identity is restored, and by a browser probe that runs, resets, works again and reloads to find the new work still there.
- A skill card's mastery badge holds the top-right corner at every width instead of dropping below a long title.
- The exercise brief's allowed-feature list no longer prints a separator before its first item, and the assistance line no longer repeats the heading above it.

### Changed

- **No eyebrows, kickers or overlines in user-facing UI (DES-021).** Thirty-nine tiny-uppercase rules de-eyebrowed and thirteen labels recomposed into subtitles, metadata rows, headings or the sentences they belonged in — campaign and gate context, Academy area and reading time, exercise family and mode, territory scope, skill-card territory, gate numbers. The `--bl-font-tracking-eyebrow` token is retired. The navigation rail keeps its own labels, deliberately.
- **No monospace typography in user-facing UI (DES-022).** Forty-seven declarations removed across twenty stylesheets; where the intent was aligned digits it became `font-variant-numeric: tabular-nums`. The `--bl-font-mono` token, the IBM Plex Mono webfont and the `@fontsource/ibm-plex-mono` dependency are gone, and `code`, `pre`, `kbd` and `samp` are told explicitly to inherit so they cannot fall back to the user agent's monospace.
- Both rules are enforced by `apps/web/src/styles/designRules.test.ts`, which tests the treatment rather than class names.

### Verification

- 679 tests in 57 files, up from 453 in 47: 199 simulator-core, 14 adapter and persistence, 13 design-rule.
- Chrome probes: `review:simulator` (scenario, clock, Time Machine, Next Event, injector, checkpoint, replay comparison, reload, offline continuation, offline reload, reset, reset reload, typography, keyboard) and `review:holo-touch` (real touch frames with decoded corner pixels at 1024 and 768), plus the existing capture, keyboard, touch and holo probes.
- Five-width audit at 1440, 1024, 768, 390 and 320: no horizontal overflow, no control under 44 px on any Phase 10 surface, no input under 16 px, no text under 12 px.

### Added — Phase 9 · Exercise Runner

- `@bloomlab/exercise-engine` is now the deterministic grader: pure TypeScript with no React, DOM, IndexedDB, network, AI, randomness or wall clock. `GradingContext` (state tree, events with simulator timestamps and a stable emitted index, named reference instants, normalized architecture, and the sources the run actually provides) plus an authored exercise produce a `GradeReport` (outcome, reason, score, pass threshold, assistance, hints, failed critical ids, the four tiers with per-assertion expected/observed, counts, rubric owed, grader version).
- All six assertion types with structured evidence: **state** (seven operators, safe dotted paths that never resolve through the prototype chain), **event** (exactly / min / max with `where` field equality), **timing** (named instant plus offset within tolerance, the closest matching event judged, never the wall clock), **architecture** (trigger, action, branch, feature used or not, node limit, re-entry — over normalized workflows with no node positions), **negative**, and **sequence** (earliest occurrence, equal timestamps broken by emitted index). An assertion whose source the run cannot supply is reported `unevaluated`, and the report is then `partial` and never `passed` (D-067, EXR-024).
- Critical-failure semantics (MAS-004): critical assertions are a gate, not a number. A failed one fails the attempt at any score, its ids reach `exercise_attempts.critical_failures` and every evidence row, and no later AI grading can override it.
- Exercise runner at `/exercise/:exerciseId` (`?skill=`, `?run=retrieval`): one route for every family, branching on `exercise.type` and never on an id. Brief with the authored objective, client or scenario context and the allowed features from the verified registry; work area derived from the exercise (authored decision options, prediction fields taken from assertion paths, written response); the authored hint ladder with the assistance roll-up shown quietly; submit; and a result that leads with the outcome, puts a critical failure first, then required, quality and bonus checks with expected beside observed, the assistance used, and the engine's real next step.
- Attempt lifecycle (D-068): a stable attempt id from the first keystroke, the draft in the local workspace so a reload resumes the same attempt with its hints, and finalization through `recordEvidence` with the attempt id and derived evidence ids — one attempt row and one evidence row per taught skill however many times finalization is retried, while Try again is a new attempt and the earlier one is immutable. Real start and completion timestamps are recorded.
- Content: assertion `tier` (`required` / `quality` / `bonus`, critical implied by placement), `response_markers` (the authored vocabulary that lets a deterministic check read written work, D-070) and `decision_options` (the architectures an exercise offers at its level). The compiler now rejects an event assertion with no bound, an architecture requirement with no feature or a non-numeric node limit, a state comparison with no value, a check on written work with no vocabulary, a decision the exercise never offered, and a tier on a critical failure. `content_version` 2026.09.04.
- Phase 7 and 8 navigation: Continue, session-plan items, the capability sheet and the Academy practice pointer open the runner; a retrieval session item runs the authored exercise as a review vehicle and records retrieval evidence that never counts toward an independent demonstration (D-072).
- Retrieval identity (D-072): the exercise is the vehicle and the skill is the capability under review, and that pair is the run's identity. A normal run and a review keep separate drafts (`exercise.attempt.<exercise>` against `…:retrieval:<skill>`) and separate current results, so neither resumes or replaces the other; a review writes evidence for its reviewed capability only, and a retrieval naming no capability of the exercise is refused rather than widened to every taught skill.
- `HoloMaterial` renders flat with the card's radius on every layer (D-074): `transform-style: preserve-3d` had been defeating the root's `overflow: hidden`, so the square glare and grain layers painted past the rounded corners while the pointer was on a card. The tilt, follow, settle and touch physics measure identically after the change.
- Review tooling: `scripts/review/exercise-probe.mjs` (touch at 390 px through a whole attempt, the hint ladder, submit, reload, retry, pressure, the runtime-dependency state, reduced motion, and an offline submission that survives an offline reload and queues for sync); the capture list gains four runner pages.
- Verification: 101 new tests — 52 in the engine, 40 runner and authored-grading tests over the real bundle, 9 content-compiler tests — plus the five-width capture audit, the keyboard probe and the exercise probe; `docs/reviews/phase-9-exercise-runner.md`.

### Added — Phase 8 · Academy

- Academy unit screen at `/academy/:unitId` (`apps/web/src/academy/`): the authored MDX rendered as an editorial reading surface — masthead, contents list with the current section, prose components (headings with anchors, lists, tables for concept comparisons, code), and the embed vocabulary: `Callout`, `Depth` (native disclosure), `Feature` (registry-backed technical note with fidelity and official documentation), `Exercise` (practice pointer to the authored exercise), `Simulation` (the shared-simulator host, honest about Phase 10), `Diagram` (`funnel` from four rates, `workflow` from the scenario's definition) and `Interactive` (`funnel-math`: sliders and numbers recompute counts, revenue, profit, the biggest leak and what each single lift buys; reset).
- Build-time MDX: the content plugin serves `virtual:bloomlab-content/units` and compiles each unit body to its own lazily imported React module (`@mdx-js/mdx`, no MDX parser in the client, one chunk per unit) (D-063). The compiler validates `Diagram` and `Interactive` kinds and their attributes (`MISSING_WORKFLOW` for a workflow a scenario does not define).
- Content: the funnel-math unit gains its funnel diagram and interactive; the workflow unit gains the booking-confirmation path diagram; `content_version` 2026.09.03.
- Completion identity (D-062): a unit-completion row's id is `ue:<unit>:<skill>:<fnv1a(learner)>` rather than random, so one logical completion is one row per taught skill across devices — two devices that finish the same unit offline converge through the append merge (`superseded`, no conflict dialog) instead of keeping both rows, and linking to a Sync Key re-keys a completion recorded beforehand. All other evidence keeps random ids and append-union semantics.
- Completion: "Finish this unit" records exposure evidence for the unit's skills through `recordEvidence` (source `learning_unit`, result `exposed`, no score, no attempt); opening a unit records nothing; a finished unit is never recorded twice (D-062). The finish panel then shows the engine's next step for the capability — another unit to read, or the exercise that arrives with Phase 9.
- Phase 7 navigation: Continue and session-plan items open a unit directly when the next step is a unit; the capability sheet links "Read this unit" (D-064).
- Review tooling: `scripts/review/academy-probe.mjs` (keyboard on the interactive, disclosure and Finish; the evidence row; reload; offline unit and offline completion; reduced motion; touch at 390 px); the capture list gains the three units.
- Verification: 14 Academy tests over the real bundle (`academy.test.tsx`) plus the updated Phase 7 tests; the five-width capture audit; the Academy probe; `docs/reviews/phase-8-academy.md`.

### Added — Phase 7 · Command Center + Skill Map

- App shell rail (`AppRail`): a 72 px left column from 768 px and a 64 px bottom bar on phones with Home, Campaign and Skill Map (System and Design behind their flags); `aria-current` on the active area, 44 px targets, visible focus (D-053). Three icons (`IconHome`, `IconCampaign`, `IconMap`) join the design system.
- Command Center at `/` over a live evaluation of the learner's evidence (`useLearnerSnapshot`, D-058): the holographic continuation object (campaign, gate, next required capability or the learner's focus, its state in words, the engine's next step, gate and map capability counts), Build my session on the real session builder (30 min / 1 hour / 2 hours / Deep Session, Continue past finished items, the assistance-dependence note), due retrieval, capabilities needing another run, work ahead with gate names, recent evidence in the §159 words, focus clearing (D-054, D-057).
- Campaign screen at `/campaign`: Field Ready as competency gates with status, capability counts, pass criteria in words, per-capability state and prerequisites by name; the content's pace hint; never a date lock.
- Skill Map at `/skills` and `/skills/:skillId`: ten HoloMaterial territory objects with JUDGMENT central at every width (D-055), real "n of m capabilities demonstrated" counts (D-060), a territory panel of SkillCards with availability in words (D-056), and the capability sheet — state sentence, prerequisites, what it opens, next step with the unit or exercise text, evidence history, review due, Set as focus; a side sheet on desktop and a bottom sheet on phones; focus returns to the card on close.
- `ScreenErrorBoundary` around every route (INF-011, D-059). `nextStepForSkill` in the mastery engine (the builder's per-skill rule as a public function). The device rename panel moved from the retired Phase 1 home to `/sync`.
- Review tooling: `scripts/review/keyboard-probe.mjs` (tab order, focus visibility, Escape on the sheet) and `scripts/review/touch-probe.mjs` (phone-sized touch flow through territory → capability → sheet); the holo probe accepts `HOLO_PAGE` / `HOLO_CARD` to measure a product screen; the capture audit waits for entrance animations.
- Verification: 13 screen tests over the real content bundle (`phase7.test.tsx`, `App.test.tsx`, `ScreenErrorBoundary.test.tsx`), the five-width capture audit, the holographic, keyboard and touch probes, and the deployed preview; `docs/reviews/phase-7-command-center-skill-map.md`.

### Added — Phase 6 · Learning Engine

- `@bloomlab/mastery-engine`: deterministic, versioned mastery rules (`MASTERY_RULES_VERSION`): the eight states with NEEDS_REFRESH as an overlay on the earned ladder, evidence kinds (exposure, quiz, guided practice, deterministic / independent exercise, pressure test, explanation, sales use, fieldwork, real-GHL, retrieval), the assistance table (nudge / concept reminder / worked example → independent / light / guided / heavy), the evidence schema with the full §30 field set, skill evaluation (state, confidence, missing requirements, review priority), the evidence-based review scheduler, prerequisite and campaign-gate evaluation with no clock input, and the session builder (30 min / 1 h / 2 h / deep; retrieval → repair → focus → campaign → fieldwork / project; Continue). A retrieval passed with guided or heavy assistance neither restores a NEEDS_REFRESH skill nor postpones its review (D-050); which evidence resets the review clock is an explicit, tested rule — `DEMONSTRATION_RULES` (D-051); retrieval maintains mastery and never advances it — `REVIEW_DEMONSTRATION_KINDS` vs `INDEPENDENT_KINDS` (D-052). No React, no network, no AI (D-044 … D-050).
- Learner records on the Phase 3/4 path: Dexie v3 adds `skill_evidence` and `exercise_attempts` (append-only, version-stamped with app / content / content hash / simulator / rules) and the derived `skill_progress`, `campaign_progress` and `review_queue` rows, recomputed from evidence on every device and after every sync that pulled something; all five sync through the existing outbox and Worker with no new migration (D-043, D-049).
- `recordEvidence` — the single write path for evidence: attempt + evidence rows in one IndexedDB transaction, schema-validated (an incomplete record aborts the write), then recompute. `buildLearnerSession` — the session builder over the compiled content and the learner's evidence.
- `/system` gains a diagnostic Learning section: skills with evidence (state badge, confidence, counts, review due, missing requirements), campaign gates, review queue with pass / fail retrieval, a record-evidence form (skill, optional exercise from content, kind, result, difficulty, hints, real-GHL proof) and Build my session with Continue.
- Verification: 51 engine tests over the required scenarios, 9 web tests for persistence, version stamping, content-change safety, prerequisite unlock, session building, two-device convergence and link-time re-keying; `npm run review:learning` drives two headless browsers (A records → syncs → B links and receives the same derived rows → B records a worked-example pass offline → reconnect → both devices agree). The sync probe now shares its browser helpers with the learning probe (`scripts/review/probe-lib.mjs`).

### Added — Phase 5 · Content Engine

- `@bloomlab/content-schema`: strict Zod schemas for all eleven content types (Skill, GHLFeature, Campaign, LearningUnit front matter, Exercise with the six assertion types, Scenario with account state and pricing economics, Client with the fifteen §38 fields and §39 hidden state, Rubric, Project, Portfolio, Glossary) plus the workflow-as-data definition (SIM-016) and the release manifest.
- Compiler `source → validate → resolve → compile`: YAML and MDX loading, ID/file-name rule, duplicate detection, cross-reference validation (skills, prerequisites and cycles, GHL features, clients, scenarios, campaigns, projects, exercises, rubrics, portfolio), campaign prerequisite order, REAL_GHL-never-simulated, removed-feature and feature-type checks, MDX syntax and embed checks; every error reported at once with file, path and message. Warnings list coverage gaps without failing the build.
- Compiled bundle: sorted records, skill graph (topological order, depth, dependents, territories), campaign paths, relationship indexes, the §137 content coverage matrix, the §138 GHL coverage matrix, the §151 freshness review list, a search index and the warnings; `npm run content:build` writes them to `.content/` (JSON + Markdown).
- Content versioning: `content/content.yaml` (`content_version`, `schema_version`), `content/content.lock.yaml` (source hash per version), `npm run content:lock` / `content:check`; CI runs `content:check` (D-038).
- Vite plugin `@bloomlab/content-schema/vite`: compiles at build time, fails the build on content errors, serves `virtual:bloomlab-content` (app) and `virtual:bloomlab-content/version` (Worker), rebuilds and reloads on content edits in `vite dev` (D-037). `/system` gains a Content section; `/api/health` reports the compiled content version.
- Seed content proving every type and relationship: 22 skills across all ten territories, 34 GHL registry records verified on help.gohighlevel.com (dated, sourced, limitations and approximations labelled), Field Ready (13 gates) and Advanced Automation campaigns, 3 MDX units with live embeds, 16 exercises across 13 families, 4 scenarios, 3 persistent clients, 5 versioned rubrics, 2 projects, 2 portfolio templates, 8 glossary terms.
- Tests: 71 content-engine tests — schema rules, the real tree, and fixture builds that fail on every broken-reference class (`docs/reviews/phase-5-content-engine.md`).

### Added — Phase 4 · D1 + Sync

- D1 schema `migrations/0001_init.sql`: the §93 tables in six domains plus `notes` (D-029); databases `bloomlab-dev` (local, preview) and `bloomlab-prod` (production) bound as `DB`; CI applies migrations to dev on pull requests and to prod on `main` before each deploy (D-033).
- Worker `/api/sync/*`: link with a Bloomlab Sync Key (server keeps `SHA-256(secret + pepper)`, pepper in a Worker secret), per-device revocable session tokens (stored hashed), push with the shared merge rules (simple / append / snapshot, `base_revision`, `force`), pull from the learner's change log, connected-devices list, revoke and rename. Tests run inside workerd against the real migration (D-032).
- Shared sync contract in `@bloomlab/shared`: entity kinds, envelope, API types, `decideMerge`, and the sync key (256-bit, Crockford base32 `BLM-XXXX-…` display, tolerant normalisation).
- Client sync engine: `linkThisDevice` (re-keys local records to the real learner), `syncNow` (push → pull, shadows, conflicts), `resolveConflict`, background scheduler; Dexie schema v2 adds `sync_shadow` and `sync_conflicts`.
- Screens: `/sync` (create or enter a key, recovery warning, copy / download recovery file / QR / "I saved it", connected devices with revoke, show key), the "Two versions were changed" chooser in the app frame, the indicator now links to sync; the device rename reaches the server; diagnostics show link state, cursor, last error and a newest-note editor.
- Idempotent pushes: a retry after a lost response is confirmed at the existing revision without a new log row; soft deletes propagate as tombstones and a stale edit of a deleted record is a conflict, not a resurrection.
- Verification: `npm run review:sync` drives two headless browsers through create-key → A writes and syncs → B links and receives → offline divergent edits → conflict chooser → convergence → deletion → revoke.

### Added — Phase 3 · Local-First Data

- `apps/web/src/data`: Dexie database `bloomlab` (v1: `device`, `notes`, `workspace`, `sync_queue`, `sync_state`), the SYNC-007 envelope and stamping helpers, `createSyncableStore` (record + outbox in one transaction, soft deletes, coalesced queue rows), the sync-queue primitives, device identity with a provisional learner id, workspace checkpoints, `useSyncStatus`, `useDevice`, `useNotes`, `useWorkspace` (D-025 … D-027).
- Quiet sync indicator in the app frame ("Offline · saved on this device" / "Saved on this device" / "Syncing…" / "Synced"); "This device" tile on the foundation home with an offline-safe rename; "Local data" section in System diagnostics (database, persisted storage, usage, record counts, sync queue, test-note actions).
- Installable PWA: `vite-plugin-pwa` service worker precaching the shell and stable assets, `/api/*` never cached, manifest and icons (`scripts/make-icons.mjs`), persistent-storage request (D-028).
- Verification: `npm run review:offline` (service-worker control, installability, offline shell, uncached API, offline write) and 37 web tests (Dexie layer on `fake-indexeddb`, hooks, device rename UI).

### Added — Phase 2 · Design System

- `packages/design-system` primitives: `HoloMaterial` modelled on the reference's foil trading card (pearl base, sweeping spectral bands with pointer-driven hue shift, metallic grain with parallax, edge-boosted glare that follows the pointer, iridescent rim light at the pointer angle, direction-aware shadow that deepens with the lift (D-023); ≤ 6° tilt with a 5 px lift, ≈ 120 ms follow easing and 420 ms eased settle in a frame loop (D-022), touch press/drag/release, reduced-motion and off-screen gating; soft / collectible / mastery / legendary), `Surface`, `InkSurface` (inverted roles), `ToolPanel`, `Inspector`, `Sheet` (native dialog), `Popover`, `Field` + `Input` / `Select` / `Textarea`, `Button`, `IconButton`; layout `Stack` / `Cluster` / `Grid` / `VisuallyHidden`; 22 stroke icons.
- Motion: state / spatial / execution / reward classes, `ExecutionTrack`, skippable `RewardReveal` clamped to 1.5–3 s, `usePrefersReducedMotion`, `useOnScreen`.
- Semantic components: `MasteryBadge`, `SkillCard`, `HoloTerritory`, `ClientCaseCover` (+ deterministic `IdentityMark`), `WorkflowNode`, `ExecutionEvent`, `ContactRow`, `PipelineCard`, `ExercisePrompt`, `PricingScopeItem`, `CallParticipant`, `StatusPill`.
- Contrast tooling: `contrastRatio` / `WCAG_AA` with tests enforcing every token pairing; role tokens `--bl-color-link` / `--bl-color-focus` (`#3B69BD`) and Ink Faint tuned to `#86819C` (D-017).
- `/design` gallery behind the `design_gallery` flag (local/preview), `?section=` deep links; Phase 1 screens moved onto the primitives.
- 76 unit tests across the design system, shared, worker and web.
- Visual-review tooling `scripts/review/` (`npm run review:capture`, `npm run review:holo`; a DevTools-Protocol driver for headless Chrome, D-024) and the Phase 2 review log `docs/reviews/phase-2-visual-review.md` (five widths, sixty page audits, HoloMaterial measurements against the live reference, §136 coverage matrix).

### Fixed — Phase 2

- `SkillCard`: the header wraps, so the mastery badge no longer pokes past the card edge or splits the title into hyphenated fragments in three- and four-column grids (found in the 768–1440 review).

### Deployed

- Production Worker `bloomlab` (https://bloomlab.cool-sunset-2169.workers.dev) deploys on every push to `main`; preview Worker `bloomlab-preview` (https://bloomlab-preview.cool-sunset-2169.workers.dev) redeploys on every pull request (D-020). Verified end to end from PR #1.

### Added — Phase 1 · Repository Foundation

- npm-workspaces monorepo per spec §102: `apps/web`, `worker`, `packages/{shared, design-system, simulator-core, exercise-engine, mastery-engine, content-schema}`, `content/`, `migrations/`, `tests/`, `public/`.
- `apps/web`: React 19 + TypeScript 6 + Vite 8, React Router 8 declarative routing with a flag-gated route registry and per-screen lazy chunks; Phase 1 foundation home, flag-gated `/system` diagnostics, not-found screen, skip link, visible focus styles.
- `worker`: Cloudflare Worker (Workers + Static Assets, `run_worker_first: ["/api/*"]`) with `/api/health` returning the version triplet and environment; local / preview / production environments in `wrangler.jsonc`.
- `packages/shared`: `APP_VERSION`, `CONTENT_VERSION`, runtime environment parsing, feature flags per environment.
- `packages/design-system`: full token set as CSS variables (color, spacing, radius, shadow, motion, typography, holographic material, density, z-index, breakpoints) with a TypeScript mirror, reduced-motion overrides, and self-hosted fonts.
- Tooling: ESLint 10 + typescript-eslint (strict, `no-explicit-any`), Prettier, Vitest 4 projects (jsdom for web), `strict` TypeScript everywhere.
- GitHub Actions CI: typecheck · lint · format · unit tests · control-doc validation · build on PR and `main`; preview/production deploy jobs gated on `CLOUDFLARE_DEPLOY`.

### Added — Phase 0 · Spec Package

- `CLAUDE.md`, `PRODUCT_VISION.md`, `CURRICULUM_MASTER_MAP.md`, `DESIGN_SYSTEM.md`, `TECH_ARCHITECTURE.md`, `CONTENT_ARCHITECTURE.md`, `SIMULATOR_SPEC.md`, `EXERCISE_ENGINE.md`, `REQUIREMENTS_MATRIX.md`, `ACCEPTANCE_TESTS.md`, `IMPLEMENTATION_STATUS.md`, `KNOWN_LIMITATIONS.md`.
- `docs/DECISIONS.md` decision log and `scripts/validate-requirements.mjs` control-document validator.
- Repository baseline: `.gitignore`, `.gitattributes` (LF), `README.md`.

### Versions

- app: 0.1.0
- content: none (`CONTENT_VERSION = null` until the content compiler exists)
- simulator: 0.0.0 (no engine yet)

### Added — Phase 19 · AI Gateway (initial implementation evidence)

- Worker-only Anthropic HTTP provider, model catalog verified 2026-09-07, structured rubric validation with one repair, learner settings, usage accounting, atomic budget reservations and exact rubric records in the existing D1 tables (`0002_ai_gateway.sql`).
- Queued recoverable rubric submissions, pure minimum-of-independently-passing-halves combination, and persisted rubric feedback. Grader `2026.09.17`; content, rubric, simulator, mastery and IndexedDB versions unchanged.
- Cheap negotiation language classification selects authored strategies only; settings at `/settings/ai`. At initial implementation, live Anthropic verification awaited the Worker secret; the live closeout below supersedes that boundary.

- Phase 19 local verification: 1,634 tests across 95 files; typecheck, lint, format, docs, content and production build pass. AI, exercise, sales, pricing, negotiation, keyboard and touch probes pass. At that initial verification, AI-009 and NEG-003 were PARTIAL pending live-provider evidence; see the later closeout below.

- AI-003 accounting hardening: usage insertion and reservation reduction are atomic; storage failure after either provider response cannot release unrecorded paid usage.

## 2026-09-07 — Phase 19 independent audit fixes (AI-002)

- Correct the provider fixture to return a fresh response for Sonnet and Haiku without changing provider behavior.
- Reconcile canonical settings into the existing local AI mode cache before Settings displays them. Selecting Off suppresses local requests before Save, during settings writes and after network failure; older responses cannot undo it.
- Add seven client/UI regression cases; full Node 22 suite passes 1,642 tests across 97 files. Required preview/production secrets and server-side policy gates remain intact.

## 2026-09-07 — Phase 19 live-provider evidence closeout

- Real preview Haiku evaluation returned HTTP 200 for `WRITTEN_COMMUNICATION_RUBRIC_V2`, version 2, passed structured validation, and persisted matching D1 feedback, completed rubric run and non-zero usage. One permitted repair retry cost $0.013323; a real `hold` classification at 0.95 brought total cost to $0.013774. Reservations returned to $0; the disposable device was revoked and subsequent access returned HTTP 401. The deterministic negotiation engine retained authored consequences and explicit structured-action precedence.
- AI-009 moves to PASSED. NEG-003 remains PARTIAL because one live sample does not establish general language quality. All adjacent statuses remain unchanged.
- CI `34105051578`, attempt 3: Checks and Preview deploy SUCCESS on implementation head `264794eb8f2cf9efec252f782394c951c9a004d0`; preview health HTTP 200. Current local implementation verification: 1,642 tests across 97 files.
- Documentation/evidence only: no runtime or version changes. Production required-secret readiness remains for the independent pre-merge audit; PR #21 stays open.
