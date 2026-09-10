# Phase 25 — Advanced curriculum

## Checkpoint A — baseline

Implementation branch: `codex/phase-25-advanced-curriculum`, based on audited Phase 24
`60305ad7b207fd7d6f77ddc2f0fdaca2213f485d`; handoff commit `a4668b297a4441873b7af6d3236aa02925b31751`.
The draft PR must target `codex/phase-24-field-ready`, never `main`.

| Requirement | Starting evidence and missing work |
|---|---|
| CUR-023 | CONNECT has one webhook skill, no learning unit or practical. Add nine connected technical foundations with safe, deterministic practical work before broadening scope. |
| CRM-002 | Shared account has companies but no company editor, custom-object schemas, records, associations or workflow consequences. Extend this account and its event door. |
| CRM-005 | Field Ready teaches segmentation judgment; no saved smart-list editor or dynamic query over shared contacts exists. |
| CAL-002 | Shared availability engine supports weekly hours, buffers, notice, staff and round robin. Classes, resource capacity and complex availability are absent. |
| PAY-001 | Shared products/payments and funnel checkout emit Payment Received; no Payments Lab, price management, invoices, subscriptions or failed-payment/refund workbench exists. |
| SAL-015 | Reporting and delivery foundations exist. Retention, maintenance, expansion, referrals and account strategy lack a complete post-Field-Ready unit/practical path. |
| CUR-026 | SCALE snapshot skill has manual fieldwork but no unit. Templates, deployment discipline, four named vertical demos and agency architecture need authored coverage. |
| CUR-027 | No GHL AI curriculum. Runtime Bloomlab AI is separate and must not become a training prerequisite. Current official names, safe deterministic judgment fixtures and specialist boundaries are required. |
| CUR-028 | Supporting specialties are not represented comprehensively in the graph. Registry coverage and truthful tier/learn/practical coverage must be authored without pretending every feature has a Lab. |
| CUR-032 | Two campaigns reference one graph. The existing Advanced Automation path is incomplete; seven curated post-Field-Ready paths are required. |

The starting bundle has 24 skills, 18 units, 68 exercises, 20 clients and five projects.
Field Ready enforces 169 learn/practical topic contracts. Its `future_boundaries` are descriptive
STRATEGIZE/AUTOMATE metadata, not completed advanced instruction. The compiler already validates
IDs, prerequisite graphs, registry references, runnable assertions and coverage. Extend these
contracts rather than creating parallel content or learner stores. The exercise runner already
captures named answers, dependency plans and review decisions; objective technical fixture
checks can reuse that work capture and the existing deterministic grading/evidence path.

CRM, Workflow, Funnel, Calendar and Reporting share simulator runs, events and snapshots;
business rules remain outside React. Current navigation is the 104 px independent scrolling
desktop/tablet rail and phone bottom bar/More menu, including Phase 24's short-height regression.
New surfaces must preserve these compositions and test 1440/1024/768/390/320 px widths.

All ten rows start NOT_STARTED. This baseline promotes nothing. FLD-001, EXR-020, PRD-005,
CUR-015, CUR-031 and the parked Phase 21/22 human-acceptance rows remain unchanged.
No real-GHL connection, automatic verification, provider purchase, migration, merge or
Production deployment is authorized by this implementation record.

## Checkpoint B — CONNECT complete locally

CUR-023 has nine authored units and nine independent local practicals (18 structural JSON checks),
using eight new graph skills and the existing webhook skill. No one-off page or second store:
the Academy, named-answer runner, queued draft writes, finalizer and immutable evidence path are
reused. The pure fixture projection parses JSON; it never executes submitted code or network work.
Four official API registry entries cover Private Integrations, versioning, Get Contact and
Marketplace webhooks. Documentation distinguishes v3/date-based versions. The original webhook
signature freshness claim was corrected by the CUR-023 audit follow-up below: current delivery
is Ed25519-only after 1 September 2026. Every lesson and registry entry records its source boundary.

`advanced_topics` citations produce `.content/coverage-advanced.json`. Enforced topic gaps,
unrelated learning/practical skills, stale referenced features, invalid JSON expectations,
unknown fields and ungraded fixture checks fail authoring. Field Ready's coverage and acceptance
remain unchanged. Content/grader versions are `2026.09.22`; no storage migration.

Verification before checkpoint C:

- Complete pinned Node 22 `npm run ci`: **1,947 tests / 136 files passed**, typecheck, lint (the
  pre-existing hook warning only), formatting, docs, content lock, voice inventory and Production
  build/provider-secret scan passed. Focused compiler/grader/runner set: **19 tests / 4 files**.
- Built browser, AI explicitly Off: **90 cases** (all nine units and nine runners at
  1440/1024/768/390/320); all nine empty-fail/correct-retry flows, queued draft reload, persisted
  result reload and keyboard focus passed. Touch retry and reduced motion passed at 480 px height.
  Artifacts: `.review/phase-25-connect/built/connect-probe.json` and Academy/work-area screenshots.
- The probe caught unbroken JSON help overflowing at 320 px; `overflow-wrap: anywhere` fixes the
  shared help style without hiding content. A fixture-specific treatment removes the inaccurate
  business-problem stance and ungraded prose box while retaining the shared runner.
- Phase 24 rail probe with visible scrollbars: all five widths and all ten 480 px normal/reduced
  cases passed (`.review/phase-25-connect/rail/rail-probe.json`). No rail redesign or width change.
- Development hot reloads interrupted early navigation probes; final evidence above is from the
  immutable built app. Chromium emulation is not physical-device acceptance.

CUR-023 is PASSED for its authored-unit/practical contract, not a live infrastructure certification.
Checkpoints C–F and final exact-head remote CI/Preview verification remain to be completed.

## Checkpoint C — shared-account advanced Labs

CRM-002/005, CAL-002 and PAY-001 now have four authored units and four account-backed practicals.
Company links, typed object schemas/records/labelled associations and narrow created/updated
notification rules use the shared event reducer. Smart-list membership is a live typed AND/OR
projection over contacts, not a stored count. Classes enforce overlapping seat occupancy;
service resource alternatives use peak concurrent capacity, shared buffers and authoritative
booking/rescheduling checks. Ordinary calendar event fixtures remain unchanged.

The Payments Lab models products, immutable prices, payment links, single-line invoices,
explicit subscription charges, failed/retried payments and full refunds. Received/failed/refund
events traverse the existing workflow engine and revenue projection. All payment attempts are
synthetic; there is no processor, automatic renewal clock or real delivery. Optional account
collections preserve old checkpoint hashes. Content `2026.09.23`, simulator `2026.09.23-r1`;
no migration, parallel learner store or runtime provider requirement.

Evidence before checkpoint D:

- Complete pinned Node 22 CI: **1,963 tests / 139 files passed**, typecheck, lint (existing hook
  warning only), format, control docs, content lock, voice inventory and Production provider/secret
  scan. Visible-scrollbar rail probe passes five widths and ten 480 px normal/reduced cases,
  including the added Payments destination (`.review/phase-25-labs/rail/rail-probe.json`).

- Focused content/core/presentation regressions: **19 tests / 4 files passed**. They cover typed
  atomic refusal, reference checks, replay, dynamic membership, overlapping classes, cancellation,
  rescheduling, peak-versus-sequential resource occupancy, service-bypass refusal, payment
  idempotency, workflows, revenue reversal and subscription lifecycle. Loading/error/empty
  Payments presentation has direct tests.
- Built Chromium probe, AI Off: all four practicals grade actual saved Lab accounts. Company
  rename/link reload, object automation/refusal/reload, live segmentation, failed invoice retry,
  duplicate paid invoice refusal, refund, offline subscription renewal/reload, two class attendees,
  cancellation/released seat and resource booking pass. All **45 surface/width cases** pass at
  1440/1024/768/390/320, plus keyboard visible focus, touch and reduced motion at short height.
  Artifact: `.review/phase-25-labs/graded-final/advanced-labs-probe.json`.
- The grading probe caught an unsupported array-length assertion; checking absence of the third
  smart-list rule now uses the grader's supported numeric path. The calendar probe waits for the
  cancellation write before clicking the deliberately disabled resource-save control. Resource
  saves now announce persistence success or failure.
- Checkpoint B exact-head CI **34337363569** passed on `42b16caea13b82b8bc830de1c293fd2029d1338d`.
  Final Phase 25 exact-head CI/Preview evidence remains pending until checkpoints D–F finish.

Current official feature records explicitly delimit company fields, contact-only object
associations, narrow object notifications, one-group segments, one resource per service booking,
USD single-line billing and full successful refunds. First Lab price remains the legacy Funnel
default; later prices are explicitly selected in Payments. No physical Safari or human transfer
acceptance is inferred. All parked statuses and unrelated partials remain unchanged.

## Checkpoint D — SCALE and retention

Nine authored unit/practical pairs cover naming/templates/release checklists, snapshot portability,
agency account ownership, specialist SaaS/white-label/Marketplace scope, retention and the four
named vertical systems. Each vertical is a distinct Demonstration Build blueprint with manifest,
entry/exit decisions, exclusions, measurement contract and failure-case QA. They are training
work, not imported native snapshots or claimed client outcomes. Existing snapshot fieldwork remains
required separately; its registry execution fidelity stays REAL_GHL.

The retained shared fixture runner checks eighteen supplied policy contracts with AI Off. It
does not claim to assess arbitrary prose or execute a rollout. Retention includes reporting
denominators/percentage points, maintenance duties, bounded retainer versus expansion, referral
permission and account strategy. Specialist distribution is outside Field Ready. Current official
snapshot refresh/push, account designation, white-label desktop and Marketplace distribution
sources were read on 9 September 2026 and recorded in the feature registry.

Focused compiler and grading regressions: **7 tests / 3 files passed**. They derive all nine
learn/practical pairs and exact four vertical names, preserve fieldwork and specialist tier, and
check empty/correct/individually corrupted answers. Content `2026.09.24`; no migration or provider
spend. Checkpoints E/F and final exact-head CI/Preview remain pending.

Typecheck, lint (existing warning only), formatting and Production build/provider scan pass.
Built Chromium with AI Off passes **90 cases**: all nine lessons and nine runners at exactly
1440/1024/768/390/320, nine empty-fail/correct-retry/draft/result-reload flows, keyboard visible
focus, touch retry and reduced motion at 480 px height. Artifact:
`.review/phase-25-scale/built/connect-probe.json`. CUR-026 and SAL-015 are PASSED for these
authored curriculum/practical contracts, not live client or real-GHL acceptance.
Checkpoint C exact-head CI **34342382869** passed on
`5385480f3e58bc920b03212fb6742958ec3031d7`; final remote identity will be reverified after F.

## Checkpoint E — GHL AI and supporting specialties

Six units/practicals cover twelve AI topics: deterministic-first judgment, Conversation AI,
Voice AI, escalation, Workflow AI actions, agents, knowledge, tools, permissions, irreversible
actions, cost/logs and hallucination risk. Every AI graph node depends on the deterministic
workflow foundation and AI-boundary judgment; removing that chain fails compilation. Runtime
AI is not required. Fourteen new units/practicals total include eight related specialty groups,
with explicit learn/practical citations for all 23 named supporting specialties.

Thirty-one official registry records distinguish conceptual C work from existing B Labs.
The current product comparison uses **Managed Agents (formerly Super Agents)**; Flow Agents
are the existing visual-agent maintenance path, and older pages retain SuperAgents wording.
MCP and logging availability is scoped to the particular official product article, not assumed
universal from Skills Platform. Knowledge sources and model output never grant authority in the
training policy. No native agent, connector, phone, publisher, crawler or payment provider runs.

Focused content/grading checks: **9 tests / 3 files passed**, including all new empty/correct/
individually corrupted contracts, deterministic-prerequisite mutation, exact 23 specialty topics,
non-Field-Ready tiers and current product/fidelity records. Content `2026.09.25`; no migration
or provider spend. Final curated paths and exact-head remote verification remain pending.

Typecheck, lint (existing hook warning only), formatting and Production provider/secret scan pass.
Built Chromium, AI Off: **140 width cases** and all fourteen empty-fail/correct-retry/draft/result
reload flows pass, with visible keyboard focus, touch retry and reduced motion at short height.
Artifact: `.review/phase-25-ai-specialties/verified/connect-probe.json`. The first run encountered
a blank document during navigation; the committed probe now captures URL/resource/browser-error
diagnostics, and a fresh full rerun passed. Chromium emulation is not physical-device acceptance.
CUR-027/028 are PASSED for their curriculum/graph contracts. Checkpoint D exact-head CI
**34343170304** passed on `177b3434cd1351a9a861e23fd71ee5a2d99a7f4a`.

## Checkpoint F — seven post-Field-Ready paths

Automation Specialist, Funnel & Conversion Specialist, Sales Operator, Technical GHL Specialist,
Agency Systems, GHL AI Specialist and the recommended Bloomwired Operator Path are authored
campaigns over existing skill IDs. The compiler requires exactly those seven distinct paths,
one recommendation, Field Ready foundations and real unit/practical coverage. All advanced
unit skills appear in the curated routes. The original Advanced Automation campaign is retained.

The existing Campaign screen now has a native labelled selector, bookmarkable `?path=` URLs,
foundation links and a seven-path directory. It reads the existing live learner evaluation,
shows loading/storage error/retry, and explicitly distinguishes preview/work-ahead from earned
Field Ready. Selecting or passing a path neither duplicates evidence nor replaces personal
acceptance. Gate demonstrations remain separate from full skill mastery/manual fieldwork.

Focused path/compiler and existing campaign/Field Ready regressions: **25 tests / 4 files pass**.
The compiler caught and rejected two prerequisite-order mistakes during authoring, now corrected.
Typecheck, lint (existing hook warning), formatting and Production build/provider scan pass.
Content `2026.09.26`, 400 source files; no migration or provider spend.

Built Chromium with AI Off: **45 path/directory/map layouts** at 1440/1024/768/390/320 pass,
including every path's exact graph links, recommendation and unfinished Field Ready boundary.
A real independent exercise result appears in both AI Specialist and Bloomwired Operator, while
Field Ready remains incomplete. Bookmark reload, unknown bookmark, visible keyboard focus,
offline route/progress, touch and reduced motion pass. Artifacts:
`.review/phase-25-paths/verified/advanced-paths-probe.json`. Desktop/320 screenshots were inspected.
The first probe used a touch coordinate during resize scroll anchoring; the corrected probe
waits for layout and verifies the hit target before dispatching touch. No app change was needed.
The rail probe passes five normal widths and ten 480 px normal/reduced cases with visible
scrollbars (`.review/phase-25-paths/rail/rail-probe.json`), retaining the 104 px independent rail.

CUR-032 is PASSED for the curated-path contract. Checkpoint E exact-head CI **34344650661**
passed on `4d7491d07eec5aa054c8fc8c15ba722faca23bfc`, with Production deploy skipped.
Final complete Node 22 and exact-head remote verification follow this implementation checkpoint;
independent audit remains required and no stacked PR is merged.

## Final verification — local source checks

Complete `npm run ci` on Node **22.23.2** (repository `.nvmrc`: 22) passes **1,978 tests /
142 files**, all workspace typechecks, lint (one pre-existing ExerciseRunner hook warning),
formatting, control-doc validation, content lock/coverage, voice inventory and Production build
with browser provider/secret scan. The first complete run exposed an old single-campaign outbox
expectation; its regression now verifies all three applicable campaign rows while requiring just
one shared evidence/attempt/skill record. Focused learning persistence: **10 tests / 1 file pass**.
The entire check chain was then rerun successfully, not just the failing test.

Exactly the ten assigned Phase 25 rows changed to PASSED against the audited Phase 24 base:
CUR-023/026/027/028/032, CRM-002/005, CAL-002, PAY-001 and SAL-015. All twelve existing
IMPLEMENTED_UNVERIFIED rows, including FLD-001, EXR-020, PRD-005, CUR-015, CUR-031 and the
seven Phase 21 rows, remain unchanged. PRI-001/002 and NEG-003 remain PARTIAL. Totals:
313 registered, 246 PASSED, 8 IN_PROGRESS, 22 PARTIAL, 12 IMPLEMENTED_UNVERIFIED,
2 DEFERRED, 23 NOT_STARTED. No migration, paid provider call or production deployment.

The final Lab probe also covers each new Lab learning unit and account-backed runner work area:
**85 width cases** (nine Labs plus eight lesson/runner surfaces at every required width), with
all saved-account, failure/refusal, offline, grading, keyboard, touch and reduced-motion flows
passing. Artifact: `.review/phase-25-final/labs-local/advanced-labs-probe.json`. The unchanged
ordinary Calendar probe also passes booking, notice/buffers, working hours, round robin, staff,
services, confirmation, reschedule, cancellation/recovery, shared Funnel availability, persistence,
keyboard and five-width/reduced-motion checks (`.review/phase-25-final/calendar-local`).
Both local Production and Preview builds pass the browser provider/secret scan. Final bundle:
58 skills, 54 learning units, 104 exercises, ten campaigns, 89 registry entries; content hash
`02c0e3b709765e1ba3a5bc9f6dcbbdf4e577d7b15e7144a8b8c7c7694135d28b`.

## Deployed implementation verification

Source **`af9483d39f88db62e8a3ce71267bb32b7c4e2e5d`**:
[CI 34346294789](https://github.com/Beeyach/Bloomlab/actions/runs/34346294789) passed Checks
and Preview deploy; Production deploy was skipped. Remote Node 22 checks passed **1,978 tests /
142 files**. Both build jobs passed the browser provider/secret scan; the migration step reported
**no migrations to apply**. Preview Worker version **`310e1573-bd0a-47d7-af5d-6cfa81555069`**.
The health endpoint and browser `data-build-id` matched the full source SHA exactly, with content
`2026.09.26` and simulator `2026.09.23-r1`.

The deployed, AI-Off probes all passed on that source:

- **320 curriculum width cases / 32 fail-retry-draft-result persistence flows**, covering every
  CONNECT, SCALE, retention, AI and specialty unit/practical. Visible focus, touch and reduced
  motion passed. `.review/phase-25-final/preview-curriculum/connect-probe.json`.
- **85 Lab/lesson/runner width cases**, actual account-backed grading and all typed-object,
  dynamic-list, class/resource, failed/retried/refunded/subscription, reload and offline flows.
  `.review/phase-25-final/preview-labs/advanced-labs-probe.json`.
- **45 path/directory/map width cases**, real shared exercise evidence, bookmark reload, unknown
  bookmark, unfinished Field Ready, keyboard, touch, offline and reduced motion.
  `.review/phase-25-final/preview-paths/advanced-paths-probe.json`.
- All five normal rail widths and ten 480 px normal/reduced cases passed with visible scrollbars,
  independent page/rail scrolling and every navigation/bottom action reachable.
  `.review/phase-25-final/preview-rail/rail-probe.json`.
- The existing ordinary Calendar probe also passed in Preview, including its five widths,
  keyboard, shared-account transitions and reduced motion (`.review/phase-25-final/preview-calendar`).

All required width sets are exactly 1440/1024/768/390/320. Remote desktop Payments and 320 px
object layouts were inspected. Controlled synthetic data only; **$0 provider spend**. This does
not establish physical Safari/touch-device acceptance or any personal real-GHL transfer.

Verification caveat for independent audit: one additional local full-suite run observed the
existing AUDIT reload/remove timing assertion (`salesRunner.test.tsx`); its focused **30 tests**
passed, and the complete Node 22 chain was rerun successfully. The remote full suite also passed.
No unrelated sales implementation change or status promotion was made to hide that observation.

This evidence/probe follow-up changes no application, engine or content bytes from the verified
implementation source. The **final immutable-head CI, Worker version and repeated Preview probe
record belongs in draft PR #27's final verification comment**, after this documentation commit
deploys; earlier checkpoint IDs are not substitutes for that final head. Keep PR #27 based on
`codex/phase-24-field-ready` and draft. Stop for independent audit; PR #24/#25/#26/#27 remain
unmerged. All parked human-acceptance and unrelated partial statuses remain unchanged.

### Rail probe synchronization follow-up

Evidence-only source `f7729d1d80ee448cb9d5175941672d23b2cd7f0f` also passed complete exact-head
[CI 34347574054](https://github.com/Beeyach/Bloomlab/actions/runs/34347574054): 1,978 tests /
142 files, both bundle scans, no pending migrations, Production skipped. Worker version
`13d5af96-f52e-4408-a733-e9a68995a249`; browser and Worker identities matched. All 450 new-surface
width cases, 32 practical fail/retry/persistence flows and the ordinary Calendar probe passed
again (`.review/phase-25-final/exact-head-{curriculum,labs,paths,calendar}`). Chromium recorded a
non-fatal service-worker preload-resource warning; no failed practical or runtime exception.

The old rail probe twice stopped during the first phone touch case with no visible link to
focus. It reopened More after a fixed 300 ms pause, which did not establish that lazy navigation
had committed; the component closes a menu associated with the previous pathname. This exposed
a synchronization gap in the probe. The probe now waits
for React's active navigation and a visible menu, refreshes its scroller reference and measures
touch coordinates after navigation. All scroll, focus, activation and overflow assertions remain.
The corrected probe passes all five widths and ten short-height motion cases against the same
deployed application (`.review/phase-25-final/rail-navigation-settled/rail-probe.json`). One
preflight TCP timeout was retried after the health endpoint returned the correct source ID.
No AppRail styling, width, component or navigation behavior changed in this follow-up.

The final source-head CI and Preview record in PR #27 must include this probe synchronization
commit. The application/content remain byte-identical to the fully reviewed implementation.

## CUR-023 independent-audit correction — webhook freshness

Re-read the [official Webhook Integration Guide](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/)
on **9 September 2026**. Its dated deprecation notice says that post-1-September-2026 delivery
uses **X-GHL-Signature with Ed25519 only**. Older transition examples remain on the same page;
they are not current guidance after that deadline. This corrects the checkpoint B freshness claim,
not any other Phase 25 acceptance evidence.

The CONNECT webhook lesson and GHL-API-WEBHOOKS registry now require current Ed25519 verification
and rejection of missing/invalid signatures. The only curriculum RSA reference is an explicitly
historical sentence recording the deprecated header and date, with no current support. Removed
copied stale signature claims from the Private Integrations and Versioning registry notes; those
records point to GHL-API-WEBHOOKS for signature guidance. A branch-wide search found no other
learner-facing legacy signature/fallback/transition guidance. Unrelated JavaScript nullish,
workflow, phone and UI fallback/transition wording is unchanged.

`webhookFreshness.test.ts` scans the entire content corpus, permits only the reviewed historical
sentence, and rejects the original stale lesson/registry wording and other current fallback
claims even beside a correct dated disclaimer. It also requires post-deprecation verification
metadata, Ed25519-only/fail-closed guidance and the existing conceptual-fixture boundary.
Focused freshness/advanced-content/CONNECT grading checks pass **15 tests / 3 files**.
The CONNECT browser probe additionally checks the rendered corrected guidance and captures the
affected lesson at each required width. Content version is **2026.09.27**, 400 source files.

The webhook practical, all runtime/application behavior, requirement statuses, parked Phase 22/24
human acceptance, PRI-001/002 and NEG-003 are unchanged. No migration or paid provider call is
needed; no earlier PR is changed or merged.

Correction verification:

- Complete Node **22.23.2** `npm run ci`: **1,985 tests / 143 files passed**, typecheck, lint
  (existing ExerciseRunner hook warning only), formatting, control docs, content lock/coverage,
  voice inventory and Production build. The separate Preview build also passed; both builds
  passed the browser provider/secret scan.
- Built CONNECT probe with AI Off: **90 layouts** (nine lessons and nine practicals at exactly
  **1440/1024/768/390/320**), all nine empty-fail/correct-retry/draft/result reload flows, visible
  keyboard focus, touch retry and reduced motion at 480 px height passed. The corrected webhook
  text and retained fixture disclaimer passed at every width. Artifact:
  `.review/phase-25-webhook-freshness/local/connect-probe.json`.
- The first browser launch could not start because a previous temporary Chromium dependency
  directory was absent. Restored the missing libraries in a new temporary directory, without
  repository or system-package changes; the full probe then passed. This was not an app failure.
- Content lock: `f14486b89eaa1e66a9326128385748b31c1ad6986c7f25c81549db7d0cb899fc`.
  Chromium emulation does not establish physical-device or personal real-GHL acceptance.

The [CUR-023 correction verification record in PR #27](https://github.com/Beeyach/Bloomlab/pull/27#issuecomment-5610563595)
holds the final immutable correction source SHA, exact-head CI, Preview Worker version and
matching browser/Worker build IDs, plus the repeated deployed CONNECT probe results after this
review commit deploys. Earlier Phase 25 verification heads are not substitutes for this correction.
PR #27 remains draft against `codex/phase-24-field-ready`; stop for independent re-audit.

Correction implementation source `9e51cdc9c04ef684dd911c46d171afeed1b39373` passed
[CI 34420067407](https://github.com/Beeyach/Bloomlab/actions/runs/34420067407): **1,985 tests /
143 files**, both bundle scans, Checks and Preview deploy successful, Production skipped,
no migrations to apply. Preview Worker version `7fc2a522-8dd8-480c-b881-ae26103b813c`.
The first deployed text probe asserted after the Academy title rendered but while the lazy MDX
body still displayed “Opening the unit…”. The correction probe now waits for the actual
Ed25519-only body text before measuring/asserting/capturing it; no application behavior changed.
The complete Node 22 chain passed again after this probe adjustment (**1,985 / 143**).

The corrected probe passed against that deployed implementation: **90 layouts / nine practical
fail-retry-draft-result flows**, five-width freshness text, keyboard focus, touch, reduced motion,
AI Off and exact browser/Worker identity. Artifact:
`.review/phase-25-webhook-freshness/preview-settled/connect-probe.json`. Desktop and 320 px
correction screenshots were inspected; current guidance and deprecated historical context wrap
without horizontal overflow. This is implementation evidence; the final exact-head CI and
repeated deployed CONNECT result for the probe/documentation follow-up are in the linked
correction verification record, not inferred from this earlier source.
