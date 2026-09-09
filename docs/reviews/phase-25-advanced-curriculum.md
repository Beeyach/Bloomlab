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
