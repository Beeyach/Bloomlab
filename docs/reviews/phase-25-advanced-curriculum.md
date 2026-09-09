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
Marketplace webhooks. Current documentation distinguishes v3/date-based versions and newer
Ed25519/legacy RSA signature handling. Every lesson and registry entry records its source boundary.

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
