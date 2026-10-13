# Bloomlab Field-Ready v1 code/audit closeout

Branch: `codex/field-ready-v1-code-closeout`

Base: `codex/navigation-shell-redesign` exact head `6a1ea64081e42a0dd6ea7efd3b78c0ee4abbd685`.

This is the next whole-product Field-Ready closeout pass after the independent audit, remediation, and navigation follow-up. It is intentionally **not a sidebar project**. The navigation work is the inherited base and must remain stable unless a regression from this work forces a narrowly scoped fix.

## Non-negotiable boundaries

Read these completely before editing:

- `AUDIT_REPORT.md`
- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `BLOOMLAB_MASTER_SPEC.md`
- `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md`
- `docs/reviews/field-ready-v1-remediation.md`
- `docs/reviews/navigation-shell-redesign.md`
- this handoff

Preserve the base architecture and evidence boundaries.

Do **not**:

- merge PR #24 through #31 or this closeout PR;
- target `main`, `audit/field-ready-v1`, or an earlier phase branch;
- reopen or redesign the sidebar merely because DES-009 is still `IN_PROGRESS`;
- convert automated fixtures into human, physical-device, provider, or real-GHL acceptance;
- modify the twelve parked human/real-GHL statuses listed below;
- silently pull P2/P3 work into this pass;
- access production learner data;
- deploy production;
- use real GHL credentials;
- incur provider spend without stopping first and reporting exactly why it is necessary.

If a requirement's remaining acceptance depends on human judgment or paid/live-provider breadth rather than missing product behavior, preserve its truthful non-PASSED status and document the exact boundary. The goal is to close every **objectively code/audit-fixable P0/P1 gap**, not manufacture a green matrix.

## Current authoritative scope

The following P0/P1 rows are the targets of this pass:

| ID | Starting status | Required closeout |
| --- | --- | --- |
| PRD-004 | NOT_STARTED | Whole-product AI-Off usability |
| PRD-009 | NOT_STARTED | No dead-end/single-learner learning-engine assumptions |
| EXR-006 | PARTIAL | Immutable prediction-before-execution checkpoint for RUN THE LEAD |
| EXR-008 | PARTIAL | Multiple valid open architectures with honest semantic-quality boundary |
| PRI-002 | PARTIAL | Complete pricing evaluation including reasoning-quality boundary |
| NEG-003 | PARTIAL | Seven-strategy language classification breadth / fallback behavior |
| DATA-006 | PARTIAL | R2 binary recovery-backup and scenario-attachment recovery contract |
| INF-011 | PARTIAL | Cross-environment failure isolation and local-state survival |
| GHL-005 | NOT_STARTED | Every supposed native GHL feature in UI resolves to registry |
| GHL-010 | NOT_STARTED | Exact current GHL terminology wherever real features are represented |
| DES-006 | IN_PROGRESS | Whole-product no-AI-slop / no-fabricated-number audit |
| DES-008 | IN_PROGRESS | Environment-specific information-density audit |
| DES-017 | IN_PROGRESS | Major-screen visual review at all required widths |
| DES-018 | IN_PROGRESS | Complete Screen × state/input coverage matrix |
| RSP-002 | IN_PROGRESS | Deliberate first-class tablet/mobile composition |
| RSP-003 | IN_PROGRESS | No critical desktop capability missing on mobile |
| RSP-004 | PARTIAL | Named environment-specific mobile recompositions |
| A11Y-001 | PARTIAL | Objective keyboard-only core-flow completion, with human/AT limits kept honest |

`DES-009` is **out of implementation scope for this pass**. Preserve it as `IN_PROGRESS` unless the learner separately supplies final visual acceptance and a control-doc-only reconciliation is explicitly requested. Do not use this closeout to keep revisiting sidebar width, style, or scrolling.

The following twelve rows remain parked exactly as `IMPLEMENTED_UNVERIFIED`:

`PRD-005`, `CUR-015`, `CUR-031`, `FLD-001`, `EXR-020`, `CALL-002`, `CALL-005`, `CALL-006`, `EXR-015`, `VOI-006`, `VOI-007`, `SEC-005`.

The following lower-priority/deferred rows remain outside this closeout unless a narrow dependency is unavoidable:

`PORT-003`, `DES-012`, `INF-018`, `FLD-003`, `SEC-006`.

## Acceptance facts that must not be weakened

Authoritative current acceptance includes:

- `PRD-004`: with AI Off and Worker AI routes disabled, Academy, Skill Map, Command Center, all Labs, deterministic exercises, mastery updates, portfolio and saved progress must function; only genuinely AI-graded families may report that AI coaching is off.
- `PRD-009`: learning-engine packages must expose learner identity on every persisted/sync record and contain no baked-in single-learner assumption beyond one learner per sync key.
- `EXR-006`: prediction must be captured **before** execution, execution must animate from actual observed data, and mismatch must be highlighted. The existing replay work does not satisfy the missing immutable pre-Lab checkpoint by itself.
- `EXR-008`: the prompt must not name the feature under test, at least two genuinely different valid authored architectures must be accepted, and AI must be used only where open-ended reasoning actually requires it.
- `PRI-002`: the scenario must retain all nine economics fields; evaluation must cover price, margin, scope, risk and reasoning; at least two defensible prices must pass. Do not invent one universal correct price.
- `NEG-003`: classifier behavior must support all seven strategies, authored reactions for each, and AI only at low classification confidence. Existing single/high-confidence evidence is not broad language-quality certification.
- `DATA-006`: R2 owns binary media; D1 stores metadata only. Full closeout also requires a real recovery/export contract for recoverable binary learner media/scenario attachments, not merely JSON references that cannot restore the bytes.
- `INF-011`: injected failure in Call Room, Workflow Lab, and AI client must leave other environments usable; sync failure must not destroy local state.
- `GHL-005/GHL-010`: every UI label representing a real HighLevel feature must resolve through the registry and use the registry `official_name`; feature-like strings outside that system must be either clearly Bloomlab-only terminology or corrected.
- `DES-006`: no fabricated analytics/numbers and no §70 AI-slop patterns across the whole product.
- `RSP-001/002/003`: major screens are reviewed at 1440/1024/768/390/320; tablet/mobile must be deliberate and mobile cannot silently omit critical desktop capability.
- `DES-017/018`: screen coverage must be evidence-backed, not a blanket claim from one generic width probe.
- `A11Y-001`: start session, open exercise, submit, and navigate Labs must complete keyboard-only. Automated Chromium can close objective failures but must not be described as physical Safari, screen-reader, or universal assistive-tech certification.

## C1 — Whole-product AI-Off, `PRD-004`

Establish one explicit AI-Off acceptance harness across the real application rather than scattered unit tests.

Requirements:

1. Run with the product AI setting Off **and** Worker AI routes disabled/unavailable.
2. Exercise the actual learner paths for:
   - Command Center / session start;
   - Academy;
   - Skill Map/mastery display;
   - CRM Lab;
   - Workflow Lab;
   - Funnel Lab;
   - Calendar;
   - Conversations/Inbox;
   - Reporting;
   - Pricing;
   - Negotiation deterministic/authored behavior;
   - Portfolio;
   - deterministic exercise completion and mastery update;
   - saved-progress reload/offline behavior where relevant.
3. No runtime AI request may be required to load, navigate, save, simulate, deterministically grade, or recover those paths.
4. Open-ended AI-graded families may remain partial/pending with truthful "AI coaching is off" behavior, but they must not break the rest of the exercise/session.
5. Add a negative control that would fail if a supposedly deterministic path begins depending on an AI route.
6. Record exact path-level outcomes. Do not promote PRD-004 from a source grep alone.

If all acceptance criteria are objectively satisfied, reconcile PRD-004 to PASSED. Otherwise retain the correct status with an exact failing surface.

## C2 — Learning-engine future-proofing, `PRD-009`

Audit actual schemas, engine packages, persistence adapters, sync envelopes, selectors and stores for hidden single-learner assumptions.

The Phase 30 remediation already fixed server sync identity collisions. This checkpoint must go wider than that one defect.

At minimum:

- inventory every persistent learner-owned record type in IndexedDB/D1 and every syncable entity;
- verify learner ownership/identity is explicit wherever the architecture requires it;
- search for singleton/global keys that incorrectly assume one learner where a future commercial wrapper would require learner scoping;
- distinguish valid device-global presentation preferences from learner records;
- verify engines accept learner context/data rather than importing Ary-specific or one-record global state;
- verify content remains static/Git-owned and is not incorrectly learner-scoped;
- add targeted regressions for every real assumption found;
- do **not** add billing, accounts, teams, instructor surfaces, tenancy UI or commercial infrastructure.

The criterion is "no dead end that forces rewriting the learning engine", not "build SaaS now".

## C3 — Exercise/pricing/negotiation closeout

### C3A — `EXR-006`

Implement the missing immutable prediction checkpoint.

The learner must commit a prediction before the relevant Lab execution can be used as the observed answer for that attempt. After commitment:

- the saved prediction is immutable for that attempt/run;
- reload cannot silently change it;
- operating the Lab/executing afterwards cannot rewrite the prediction;
- the actual execution/replay remains based on observed simulator events, not expected answers;
- the result shows prediction vs actual/mismatch clearly;
- historical attempts remain readable;
- reset/new attempt creates a new prediction boundary rather than mutating the old one.

Add direct unit/integration/browser coverage including an attempted post-execution edit that must fail or create an explicit new attempt rather than rewriting evidence.

### C3B — `EXR-008`, `PRI-002`, `NEG-003`

Separate **missing product behavior** from **semantic-quality evidence**.

For EXR-008:

- prove at least two structurally different, defensible architectures are accepted on actual later/open tasks;
- prove invalid architectures fail objective constraints;
- preserve AI only for genuinely semantic/unmatched judgment;
- do not turn open architecture into hidden multiple-choice matching.

For PRI-002:

- verify all nine economics fields flow through the scenario/evaluator as intended;
- verify price, margin, scope and risk feedback independently;
- retain at least two different defensible passing prices and a critical under-floor failure;
- implement missing reasoning evaluation only if the existing AI gateway can do so without violating objective-authority boundaries;
- do not expose hidden delivery economics before the learner commits the quote.

For NEG-003:

- preserve explicit action precedence and authored deterministic consequences;
- exercise broad paraphrase sets for all seven strategies and genuinely ambiguous/low-confidence language;
- high-confidence classification must be reproducible and not depend on lucky single phrases;
- low-confidence language may invoke the existing AI classifier when AI is available, with safe authored clarification/fallback when AI is Off/fails;
- do not call a paid provider during this closeout without stopping for approval.

If broad semantic quality still requires paid live-provider or human-language acceptance, leave the relevant row PARTIAL and state exactly what automated evidence cannot prove. Do not overfit a phrase list merely to force PASSED.

## C4 — Binary recovery contract, `DATA-006`

Close the actual recovery gap for learner-owned R2 media and scenario attachments without making R2 public.

First inventory all private binary asset classes currently used or planned by Fieldwork, Portfolio, Call/audio and authored scenario attachment flows. Distinguish reusable application voice assets from learner-owned private evidence.

Design the narrowest architecture consistent with the existing local-first/sync-key model. Required properties:

- R2 remains private; no public bucket/domain;
- D1 remains metadata/index/ownership, not binary payload storage;
- backup/export can include or package recoverable private binary assets with explicit bounded metadata and checksums;
- restore can validate ownership/schema/type/size/checksum before upload/write;
- restore is staged/confirmed and must not overwrite unrelated/newer existing learner data silently;
- partial binary failure must not leave metadata falsely claiming a successful asset;
- retry/recovery must be explicit;
- malformed, oversized, foreign-learner, wrong-checksum and unsupported attachments fail closed;
- no provider key or raw sync secret enters backup artifacts;
- ordinary JSON-only backup compatibility is preserved or versioned deliberately;
- if scenario attachments are not a real current product surface, implement the smallest real attachment path required by the spec rather than a placeholder.

Use synthetic/private Preview evidence only. Do not publish learner media. No production object inspection.

If a schema migration is genuinely necessary, apply it to Preview/dev only through normal CI. Production remains skipped.

## C5 — Failure isolation, `INF-011`

Create an exact injected-failure matrix, not a generic ErrorBoundary assertion.

Prove independently:

- Call Room failure does not break Workflow, CRM, Academy or local progress;
- Workflow Lab engine/worker/render failure does not break Call Room, CRM, Academy or local progress;
- AI client/gateway failure does not break deterministic learning/Labs/local progress;
- sync push/pull failure does not destroy or roll back valid local learner work;
- recovery/retry does not duplicate completed work or overwrite newer local state.

Use real application routing/state with controlled failures. Verify reload after each failure. Keep failure injection test-only or behind existing developer/test hooks. Never ship a hidden fake-success path.

Promote INF-011 only if the actual criterion is fully demonstrated.

## C6 — Whole-product GHL fidelity, `GHL-005` and `GHL-010`

Perform an exhaustive repository/UI audit of feature naming.

Do not rely only on the existing 90-day freshness report. Freshness and naming coverage are different requirements.

Build or strengthen a deterministic checker that:

1. inventories every learner-visible term intended to represent a native HighLevel feature/action/trigger/product/object;
2. resolves it to a registry entry;
3. verifies displayed native naming comes from or exactly matches that entry's `official_name` contract;
4. catches hardcoded feature-like strings that bypass the registry;
5. allows clearly Bloomlab-owned teaching terms only when they are explicitly classified as such;
6. scans Academy/content, Lab palettes/inspectors, Search, Playground, exercise prompts, setup surfaces and any other feature-bearing UI;
7. fails on stale aliases presented as current native names;
8. does not falsely classify generic prose nouns such as "contact" when they are not claiming a product label.

Fix concrete naming drift discovered. Do not refresh `last_verified` dates unless a genuine source verification occurs. Do not claim live GHL parity.

If exhaustive deterministic coverage proves the criteria, reconcile GHL-005/GHL-010. Otherwise leave exact uncovered categories visible.

## C7 — Whole-product design, responsive and objective accessibility closeout

Targets: `DES-006`, `DES-008`, `DES-017`, `DES-018`, `RSP-002`, `RSP-003`, `RSP-004`, objective portions of `A11Y-001`.

This checkpoint is **not permission for a broad redesign**. Audit first, fix only concrete failures.

### Screen inventory

Generate the authoritative set of major learner-facing routes/screens/detail states from the router/content/runtime rather than hand-picking pretty screenshots. Include at least:

- Command Center/session states;
- Campaign/Gates;
- Skill Map/detail;
- Academy unit/interactive embeds;
- Workflow, CRM, Funnel, Calendar, Inbox/Conversations, Reporting, Payments, Incident;
- Sales, Pricing, Negotiation;
- Call Room;
- Fieldwork;
- Portfolio;
- Clients;
- Search;
- restore/sync/recovery states;
- exercise runners and meaningful empty/loading/error/completed states.

Developer-only surfaces may be recorded separately and must not substitute for learner routes.

### `DES-006`

Audit the actual rendered product for every §70 prohibited pattern and fabricated-number issue. Fix concrete violations only. Do not mechanically remove legitimate semantic cards/containers just because "cards" appear in the banned-pattern wording.

### `DES-008`

Review actual information density by environment. Academy should read low-medium, Workflow medium-high, CRM high, Call Room very low, Pricing medium, Skill Map high-visual/low-text. Measure/inspect useful proxies, but final evidence must include rendered review, not token declarations alone.

### `DES-017` / `DES-018`

Produce or update one machine-readable screen/state matrix with evidence links/artifact references for required widths `1440 / 1024 / 768 / 390 / 320`.

For each major screen, record applicable:

- default/normal;
- empty;
- loading;
- error/failure;
- completed/result where relevant;
- keyboard;
- touch/mobile interaction;
- reduced motion where motion exists.

Do not mark impossible/non-applicable states as "passed". Use explicit `N/A` with reason.

A generic 180-layout sweep is useful but does not by itself satisfy missing semantic states.

### `RSP-002 / RSP-003 / RSP-004`

Compare desktop capability inventory to tablet/mobile composition. Every critical action available on desktop must have a deliberate mobile route, sheet, menu, vertical editor or other usable recomposition.

Pay special attention to complex Labs, inspectors, timelines, boards, drag alternatives, filters, tables, charts, Call controls, proof upload/review and pricing/negotiation controls.

Fix actual missing/inaccessible capability. Do not cram desktop layouts into phones.

### `A11Y-001`

Run a fresh keyboard-only core flow using native Tab/Shift+Tab/Enter/Space/arrows and visible focus:

1. start a session;
2. open its exercise;
3. complete/submit a deterministic exercise;
4. navigate to and operate representative Labs.

Add route/state coverage where the existing 22-flow probe is incomplete. Fix objective focus-order, trap, unreachable-control or hidden-focus issues discovered.

Keep screen-reader, physical Safari and broader assistive/manual boundaries explicit if they are not actually performed. Do not promote from axe alone.

### Navigation boundary

The inherited resizable/collapsible sidebar is regression coverage only in this checkpoint. Run the existing navigation/resize probes to ensure you did not break it, but do not redesign it or spend the closeout chasing subjective sidebar styling.

## C8 — Final exact-head reconciliation

After C1–C7:

1. Re-read every target requirement and its exact acceptance criterion.
2. Promote only rows fully evidenced on the final source head.
3. Preserve every human/real-GHL row exactly.
4. Preserve DES-009 as IN_PROGRESS unless learner acceptance has separately been supplied and the handoff has been explicitly amended.
5. Preserve P2/P3/deferred rows outside scope.
6. Update `IMPLEMENTATION_STATUS.md`, `REQUIREMENTS_MATRIX.md`, `ACCEPTANCE_TESTS.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md` and review docs only where current evidence requires it.
7. Create `docs/reviews/field-ready-v1-code-closeout.md` containing:
   - starting head;
   - exact target list;
   - checkpoint-by-checkpoint findings/fixes;
   - requirements promoted;
   - requirements retained and why;
   - failed attempts and corrections;
   - human/provider/real-GHL boundaries;
   - exact-head CI/Preview identities.

## Required final verification

Use Node 22 and run the complete existing CI path on the exact final head, including:

- typecheck;
- lint;
- format check;
- all unit/integration/Worker tests;
- simulator/content/docs/voice checks;
- adversarial suite;
- source/browser secret scans;
- accessibility suite and its negative control;
- production-mode client build for secret/bundle validation only;
- Preview build/deploy only.

Then run deployed Preview verification on the exact same head:

- C1 AI-Off whole-product harness;
- C3 changed exercise/pricing/negotiation probes;
- C4 backup/media recovery probes;
- C5 injected-failure matrix;
- C6 GHL naming audit;
- C7 screen/state/responsive/keyboard probes;
- all existing critical regression suites including sync, restore, Workflow performance and navigation/resize.

Browser DOM build ID and Worker `/api/health` build ID must match the exact Git commit before and after the deployed suite.

Production deploy must remain skipped.

## PR boundary

Open exactly one **draft PR**:

- head: `codex/field-ready-v1-code-closeout`
- base: `codex/navigation-shell-redesign`

Do not retarget PR #31. Do not merge anything.

Stop after exact-head CI + Preview verification for independent ChatGPT audit.

## Final report format

Return:

1. exact final HEAD SHA;
2. draft PR number and base;
3. checkpoint C1–C8 disposition;
4. every requirement promoted, with one-line evidence;
5. every targeted requirement still non-PASSED, with exact remaining blocker;
6. confirmation that the twelve human/real-GHL rows are unchanged;
7. confirmation that DES-009 was not reopened as implementation work;
8. test counts, adversarial/a11y outcomes and failed attempts retained;
9. Preview Worker version and matching browser/Worker build identity;
10. migrations/provider spend/production activity;
11. final count of remaining open P0/P1 rows;
12. explicit `Stop for independent ChatGPT audit. Do not merge.`
