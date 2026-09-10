# Field-Ready v1 remediation

> Navigation follow-up: D-202 and [the navigation redesign review](../reviews/navigation-shell-redesign.md) supersede this document’s fixed-104 px/containment contract. Historical PASS evidence is preserved, but the learner’s contradictory real-use report requires fresh two-state genuine-input verification. All unrelated acceptance remains unchanged.


Implementation branch: `codex/field-ready-v1-remediation`. Draft PR base must be
`audit/field-ready-v1` at `a2466d3651ac5544f6baa113c46ae472385fa8f5` (audited Phase 26
`6b58d3c54bae3c7759ac238dc9dc9651ae5298ee` plus the independent report only).
`AUDIT_REPORT.md` is the authoritative input, unchanged; this is remediation evidence, not a new audit.

## Resumed checkpoint inventory (2026-09-10)

Resumed on `20b61295d863a1b189a8e4c3d9ad85eae157a49c`, tracking the same remote branch.
`3c6e732` contains the R1–R9 implementation and initial R10 reconciliation; `20b6129` contains
probe failure-exit hardening and corrected fieldwork touch evidence. Both commits were preserved.
The six uncommitted files were the R5 ownership correction discovered by R10 Preview probes:
`0007_sync_learner_keys.sql`, `ownership.test.ts`, `sync/db.ts` and the three sync drivers.
No checkpoint was restarted and no prior implementation or failed evidence was discarded.

| Checkpoint | State at resumption | Remaining work in this continuation |
| --- | --- | --- |
| R1 | Reconciliation/negative checks recorded; INF-015 already PASSED from the independent report. | Preserve evidence/statuses; final control validation. |
| R2 | Inventory and rubric-copy fix committed and tested. | Final regression sweep. |
| R3 | Home fix, five-width short-height states and matrix committed/tested. | Final browser sweep; preserve open broader design cells. |
| R4 | Keyboard core-flow probe committed/passed; A11Y-001 remains PARTIAL. | Final keyboard/axe runs, no human promotion. |
| R5 | Local draft/envelope work complete; deployed same-ID ownership defect reopened this checkpoint. | Finish preserved migration/writer/test/probe patch, then verify deployed ownership. |
| R6 | Source/config/private-media checks committed; cloud gate passed on intermediate CI. | Repeat source/build/privacy gates on final head. |
| R7 | Naming corrections and all B/C limitations committed/tested. | Final content/registry checks; GHL-005/010 remain open. |
| R8 | Precache and visited-Lab offline fix committed/tested. | Final network/cache/offline probe. |
| R9 | Replay, temporal grading, open decision and quote changes committed/tested. | Final changed-surface probes; retain explicit incomplete criteria below. |
| R10 | Interrupted: deployed sync failures and final immutable attestation unresolved. | Complete Node 22 checks, Preview-only migration/deploy, full browser sweep and PR #30 attestation. |

Checkpoint completion here means the recorded bounded remediation work, not acceptance of every
target row. The complete remaining P0/P1 ledger below retains the actual code/audit gaps.

## R1 — control and negative constraints

Read the entire handoff, independent report, master, CLAUDE, requirements, acceptance tests,
implementation status, known limitations and Phase 26 review before implementation. Also read
the working product, technical and content architectures. Current stack and personal-first
route inventory retain the existing local learning engines; simulated client subscriptions in
Payments are training data, not Bloomlab billing. No commercial product infrastructure is added.

The parsed Worker configuration and every tracked package manifest contain no Durable Object,
Queue or prohibited infrastructure dependency. A direct regression now guards these negatives
and all twelve parked statuses. The independent report covers all ten §141 categories and
explicitly decides INF-015 PASS; reconciliation uses that independent evidence, not self-certification.
INF-006/007/008 and INF-015 are eligible for PASSED on this evidence. PRD-004's whole-product
AI-Off check remains for final browser verification; no partial subset promotes it here.
PRD-009's engine records/ownership need exact contract evidence, not a speculative rewrite.
SEC-002/003 and GHL-005/009/010 continue to their dedicated R6/R7 checks before reconciliation.

All group-B human/real-GHL statuses remain IMPLEMENTED_UNVERIFIED. No provider spend, migration,
production data access, earlier-PR modification or merge. Focused verification is recorded below
before proceeding to R2.

R1 verification: 28 tests / 4 files passed (boundary, flags, AI client, app); after locating the
Node-based guard in the existing web test environment, its four tests and web typecheck pass.
Control-document validation passes with 262 PASSED and ten NOT_STARTED.

## R2 — learner-facing inventory

Inventory includes tracked app, Worker, package implementation and curriculum sources, excluding
test/generated/dependency trees. TODO/FIXME, coming-soon, console-only actions, hardcoded-success
and screenshot-only patterns have no implementation hits. Placeholder hits are native input hints,
CSS placeholder rules, SQL parameter construction and the voice-schema placeholder rejection;
none substitutes for interaction. The developer gallery is flag-gated. Sheet consumers are real
Skill Map, conflict choice, reporting evidence, Workflow/Funnel/CRM/Calendar inspectors and Call
notes/restart flows; their existing interaction tests/probes remain required.

One current-copy defect was found: rubric-pending results still promised the already shipped
Phase 19 gateway. They now state saved work and genuinely pending coaching, without awarding a
pass or weakening deterministic checks. A direct regression creates a real mixed grade and checks
both PARTIAL and truthful copy. Missing runtime data still refuses full evaluation. Existing
no-fake-analytics source checks and real fixture/grading tests are rerun.

At the R2 checkpoint EXR-024 remained PARTIAL while the exercise-family work proceeded to R9.
R10 reconciles the no-stub criterion from the completed inventory, direct missing-source/fake-pass
guards and interaction sweep; this does not promote incomplete exercise families. Local-fixture
and private-media limitations are preserved, not deleted to manufacture a clean inventory.

R2 focused verification: 47 tests / 4 files passed. Typecheck caught a test-only operator spelling
(`eq` instead of the schema's `equals`); corrected without changing the production grader and
reran the direct copy test. Full current-head verification remains required at R10.

## R3 — Home and responsive scope

Home now reads the most recently updated, owned, non-deleted client with an actual journal entry
or selected project result. Initialized records, foreign/deleted/unknown clients and empty
engagements do not manufacture an active client. The rule is visible as “Most recently worked
with”; relationship and destination come from existing local records. Empty state links to Clients;
loading/read failure/retry are explicit. No new datastore, migration, achievement or client redesign.

Focused tests: 46 tests / 4 files (active-client, Command Center, design rules, Playground unlocks),
web typecheck and Preview build/secret scan pass. `remediation-home-probe.mjs` passes 30 states:
all five widths at 480 px, empty/active, both motion modes, held loading, failed storage/read retry,
actual keyboard focus and desktop Enter/phone touch navigation. Fault injection of the shared
client table correctly reaches the existing whole-screen boundary before the child mounts;
the probe records that boundary and retry, while the child-specific failure is covered by its unit
test. An initial non-Boolean CDP wait and a wrong fault-scope expectation were corrected in the
probe, not hidden as application passes. 320 px full-page composition was inspected.

The existing 104 px independent rail and phone four-plus-More are untouched. DES-010 has direct
new code evidence; final full-width verification is still required before promotion. PRD-014's
existing capability/Playground unlock tests pass, but no blanket unlock-breadth promotion follows.
Broader design/comfort and manual matrix cells remain open, including physical Safari acceptance.

## R4 — objective keyboard flows

`remediation-keyboard-probe.mjs` passes 22 flows at 1440/390 × 480 px with reduced motion:
Tab/Enter builds a session and opens its first item; Search opens a CONNECT practical; native
typing answers both fixtures and Enter submits a real deterministic PASS; rail/More navigation
reaches nine Labs and their controls with visible focus. No scripted element focus/click or paid
provider call. The probe allows rendering to settle between native keystrokes; an initial race
while lazy routes mounted was not treated as an application pass. Focused app/session/exercise
checks pass 55 tests / 3 files. No objective app accessibility change was needed in these flows.
A11Y-001 remains PARTIAL for the audit's broader manual/physical acceptance boundary; this adds
direct core-flow evidence, not blanket assistive-technology certification.

## R5 — local-first draft recovery and sync envelopes

Workflow drafts now checkpoint in the existing local-only Dexie workspace, keyed by run/reset
generation/workflow. Unsaved definitions, layout and undo/redo survive reload; explicit Save is
still the single account-event/sync boundary. Read failure blocks replacement with a blank draft;
write failure retains the in-memory edit, warns to keep the page open and offers local retry.
No schema migration, new persistence service or coordinate outbox was introduced.

32 focused tests / 5 files pass (draft recovery, screen integration, sync failure/conflict, stores,
workspace); the additional full-envelope/tombstone regression passes for all 12 local sync entities
(17 store tests). Web typecheck and build/secret scan pass. The new draft browser probe passes all
five widths at 480 px with page **and service-worker networking offline**, then reload: layout
nudge on desktop/tablet and the actual vertical editor's step insertion on phone both recover,
with unchanged event and outbox counts. Initial probe failures were a selection-render race and
an invalid assumption that the phone used a canvas; the final probe exercises the real compositions.

DATA-006 remains PARTIAL: R2 screenshot/audio ownership is implemented, but repository JSON
export/restore is not binary recovery backup and authored scenario attachment recovery is absent.
No binary-backup or real-cloud recovery claim is made. Final offline/sync/restore probes remain
required in R10 before reconciling DATA-001/SYNC-007/INF-011.

### R5 reopened by deployed ownership evidence

The intermediate Preview client/portfolio probes failed when their first pull returned no record.
Their IDs (`cp:CL-glowhaus-medspa`, `pp:PF-consultation-booking-system`) are learner-local, but
the legacy D1 primary key and UPSERT matched only `id`. A later authenticated learner could
overwrite the earlier learner's payload while leaving the row's owner unchanged. Read isolation
alone and randomized record IDs failed to expose this write collision.

The preserved migration `0007_sync_learner_keys.sql` rebuilds all **13 server sync tables** with
`PRIMARY KEY (learner_id, id)` and copies every existing envelope/payload byte. The writer uses
the matching composite conflict target. Identity, Call/media, AI and `sync_operations` tables
remain intact. The **12 browser-sync entities** are a separate existing count. No Dexie version
change or second persistence architecture is introduced.

Focused Node 22 evidence: **29 tests / 2 files pass**, including 15 new ownership/migration cases.
Every server entity tests colliding IDs, independent updates/deletions and isolated pull logs;
HTTP client push/pull ignores forged ownership. The migration test preserves live/deleted legacy
rows, Unicode/whitespace payload bytes, indexes and cursor history, injects a late uniqueness
failure to prove the entire rebuild rolls back, then successfully retries. The first resumed test
run failed 13 assertions because cases shared learner IDs/log history; the fixtures now isolate
learners per entity and compare the entire cursor log before new writes. No product assertion
was removed to hide an ownership failure.

The two deployed metadata drivers retain real curriculum IDs and deliberately reuse each across
two disposable learners, checking forged owner rejection, both pull payloads, snapshot conflicts
and independent tombstones. The general sync probe holds page and worker offline before checking
the outbox, so the automatic scheduler cannot drain it before observation. All drivers still fail
on false evidence. Required final deployed results belong to the final PR attestation.

Deployment order follows existing CI: Checks → `bloomlab-dev` migration with `--env preview` →
Preview Worker. The old writer is incompatible with the composite schema during the short
migration/deployment interval; local data and queued changes survive failed sync and can retry
after deployment. Do not roll back only the Worker to the old writer. Migration prevents future
collisions; it cannot reconstruct payloads overwritten before it. No production learner data was
queried and no claim is made about recovering historical collisions. Production stays skipped.
Cloudflare guidance informed the use of the existing transactional D1 migration/batch path;
the rollback and byte-preservation claims are also exercised directly in local workerd/D1.

## R6 — security and infrastructure checks

Tracked/unignored source scanning now runs in complete CI, alongside the existing production
browser scanner. Canary regressions cover provider/key literals without exposing values. A bare
PEM format marker is not a private key: the scanner requires encoded key bytes, preserving the
legitimate Google credential parser and ephemeral test-generated keys. Initial marker false
positives were corrected; no credential was found or printed. The scan covers 1255 current files.

Environment regressions prove local/preview dev D1 identity, distinct production D1 and R2,
locally simulated bindings, Preview-only migration/build and the main-only production job. The
initial guard incorrectly counted a comment mentioning production; it now checks executable
configuration. All 65 tests / 4 files pass, including authenticated owner/foreign/anonymous/revoked
screenshot, audio and Call access. Private responses stream R2 bodies with no-store; screenshot
handlers never disclose object keys or expose a public media route.

Local Wrangler cannot read cloud configuration without a token. A read-only Preview CI gate now
checks both media buckets' managed-domain disabled state and absence of custom domains using the
official R2 API. It makes no D1 query, object listing or mutation. SEC-003 is not promoted until
that exact-head gate succeeds. No platform secret value or production learner data is requested.
Cloudflare skills informed environment/non-inheritance and private streaming checks; no new
infrastructure or compatibility-date change was needed. SEC-005 remains human-unverified.

## R7 — exact registry naming and limitation projection

Conversations now has a B registry record for the existing synthetic SMS/email screen, based on
the official Conversations guide read on 2026-09-10. The screen names that record and explicitly
excludes live delivery/full inbox/composer parity. Existing native CRM Contacts/Companies/Custom
Objects/Smart Lists and Class Booking labels resolve through the registry; capitalization drift
is corrected. Workflow palette, Academy feature notes, Search and Playground already consume
registry names. Singular record nouns and Bloomlab conversion roles are not presented as invented
native features. Missing native-label IDs throw rather than fabricate a name.

KNOWN_LIMITATIONS now contains a checked, exact projection of **every B/C registry record**,
including approximation, exclusions, original source and verification caveat. The projection
regression fails for omissions or drift. The 89 inherited verification dates are not refreshed;
the 90-day queue remains maintenance, not manual acceptance. Webhook content remains current
Ed25519-only, with its existing post-deprecation regression and local-fixture boundary unchanged.
Content version 2026.09.28 records the added mapping (90 records); no new skill or exercise status.

Native-name/projection and Workflow integration checks pass 12 tests / 2 files. CONNECT,
advanced-contract and advanced-path focused checks are recorded in the final verification ledger.
No live-GHL competence or blanket feature parity is claimed.

## R8 — stable precache and demand-loaded offline Labs

The build now walks Vite's **static** import graph from shell/Home/Sync/Academy and compiled MDX
roots. It does not follow dynamic Lab imports. A direct regression fails if Workflow or the
simulator worker enters that stable graph. Same-origin hashed public route assets are cached on
actual use; first-visit resource completions are retained even when they started before service
worker control. API/private media are never included. Updates still require an explicit safe reload.

Precache falls from 164 entries / 3500.90 KiB to 107 / 2761.70 KiB. The strengthened lazy-route
probe asserts zero Workflow requests and cache entries during Academy, then actual Workflow
execution and offline revisit. The draft probe additionally passes all five widths at 480 px
with genuine page+worker offline first-visit reload. Initial failures revealed late resource
completion and Vite's Origin-varying stylesheet response; both were fixed, not hidden by removing
offline tests. `ignoreVary` applies only to hashed same-origin public route assets, never API/media.

The web-perf skill's Chrome DevTools MCP trace workflow is paused because that server is not
configured. Repository CDP/network/cache evidence is the explicit fallback, not a new whole-repo
audit or a Lighthouse/CWV/reference-device performance claim. Stable curriculum remains offline;
an unvisited Lab requires one online visit, after which its actual assets are cached for reuse.

## R9 — actual exercise events and learner-authored pricing

The `after:` constraint now compares real ISO event instants with a named runtime reference,
strictly after the boundary (an event at the boundary is not after it). Missing/invalid references
or event times remain unevaluated, never a false pass. Seven direct temporal cases and the actual
simulator/adapter integration prove immediate late-booking confirmation passes while an hour-delay
text fails the critical check. Synthetic Jordan has a phone for this isolated regression; the
authored missing-phone fixture is unchanged. Grader version is `2026.09.28`.

RUN THE LEAD saves a contact-filtered snapshot of observed events and the submitted prediction,
then plays that actual sequence inside the runner. It does not animate expected outcomes or
re-run/mutate the account. Pause, replay, full-execution and reduced-motion views share the same
saved event data. Historical/other-device attempts without a local playback explicitly say so.
The animation gap is fixed, but EXR-006 remains PARTIAL: the application still does not enforce
a separate immutable prediction checkpoint before the learner operates the Lab. This is a code
gap, not human acceptance, and is not concealed by the successful predict-first probe path.

The existing later-level veterinary architecture task has no choice options or forced choice
assertion. Its open prompt now explicitly covers all five data mechanisms. A direct regression
checks no radios, writing/reload and all five names. Two distinct open business architectures
clear the objective marker without becoming semantic passes: EXR-008 remains PARTIAL.

The deal desk now accepts optional **learner-authored** portions of the full-scope project fee.
Removing/reinstating a priced line changes the quote and percentage deposit alongside its real
structural consequence. No delivery hours, cost, margin or suggested price is exposed. Old
unallocated quotes retain their arithmetic; the interface explicitly says unassigned lines
change scope only. Negative/non-finite/excessive reductions do not produce a valid total.
Direct rounding, duplicate-removal, multi-line, historical, reload and hidden-economics regressions
pass. PRI-002/NEG-003 retain their existing PARTIAL semantic-language boundaries and no provider spend.

Focused runs: replay/exercise 36 tests / 2 files; pricing/open architecture 101 / 4;
temporal/runtime 18 / 2; additional authored breadth 15 / 3 (overlapping runs, not additive counts).
The new browser probe covers replay/reload/read-only account state, open writing, quote reduction,
keyboard/touch, both motion modes and axe at five widths × 480 px. Initial probe failures included
incomplete CDP Enter/Space events, numeric-field commit/target timing and expecting a desktop
trigger-result element after the phone deliberately switches to Timeline. A run interrupted by
a concurrent local build returned HTTP 500; it is not passing evidence. Final stable-build outcomes
are recorded below, without deleting these failed-run records.

## R10 — verification and reconciliation

Every changed criterion is re-read against `ACCEPTANCE_TESTS.md` and the unchanged matrix wording.
No human row, priority, earlier PR or independent report is changed. Exact-head CI checks and
Preview now explicitly check out the source SHA rather than labelling a synthetic merge checkout.
Migration 0007 is the R5 ownership correction described above. Provider spend is $0.
Draft PR base remains the independent audit branch.

Original local complete Node 22 chain: 2090 tests / 157 files, all 15 adversarial cases, content/freshness,
voice, source/built-browser secret checks, build and 75 axe scans. An earlier formatting-stage
failure while the probe was being edited is retained separately; the complete chain was rerun.
The existing hook dependency warning remains non-fatal. `npm ci` reports five high dependency
advisories; no unrequested forced dependency upgrade or claim of a clean dependency audit.
Production-mode build, stable browser sweep and immutable CI/Preview identity remain pending
the final attestation below; this paragraph alone is not exact-head deployment evidence.

Resumed Node 22.23.2 verification after a clean `npm ci`: 2106 tests / 159 files, including the
15 new ownership/migration cases; all 15 adversarial cases; typecheck, lint, format, control-doc
validation, source-secret scan (1272 files), content validation/freshness, voice check and build
pass. A separate production-mode build and its browser-secret scan pass. The first invocation
incorrectly set `CLOUDFLARE_ENV=production` for the entire chain and stopped at a Wrangler named
export during Vitest setup; running the normal test environment passed without dependency or
test-runner changes. The production environment is selected only for the build, as in CI.
The initial accessibility launch failed because `google-chrome` was unavailable; the explicit
installed Chrome-for-Testing binary also needed the existing local shared-library directory.
Those launch failures are not accessibility passes. The configured rerun and final immutable
CI/Preview attestation below are the acceptance evidence, not these failed attempts.

Configured local accessibility rerun: Chrome for Testing 153.0.8010.12, axe-core 4.13.0,
75 scans, negative control detected, zero serious/critical violations; both local Worker and
browser identify the explicitly non-immutable build `remediation-resumed`. This production-mode
build was served locally with simulated bindings, not deployed to production. Artifacts are in
`.review/remediation/resumed-local-a11y-configured`; manual/physical acceptance remains open.
The final 33-probe deployed sweep will use `.review/remediation/final-preview` and require the
immutable PR head before and after execution. Its result, CI URL and deployment version belong
in the final PR #30 attestation; pending or failed probes must not be inferred as passed here.

### Exact acceptance reconciliation

20 promotions (all group A except the expressly authorized documentary INF-015):

| Rows | Current repository evidence |
| --- | --- |
| PRD-001, PRD-014, EXR-024 | R1/R2 personal-product and no-stub inventory; capability/Playground/phase7 guards; genuine partial/missing-source boundaries retained. |
| DES-010 | R3 actual owned active client plus existing Home features; direct state tests and all-width short-height browser states. |
| DATA-001, SYNC-007 | R5 local draft persistence and twelve sync envelopes; offline note/exercise/drag/reload and conflict evidence. |
| INF-001, INF-004, INF-006, INF-007, INF-008 | R1/R6 current stack, parsed environment separation and prohibited-infrastructure regressions; old pre-Phase21 missing-provider wording no longer applies. |
| INF-015 | Unchanged independent AUDIT_REPORT at the exact audit base covers all ten categories and explicitly decides PASS. |
| SEC-001, SEC-002, SEC-003 | R6 source/built-browser scans, canaries, Worker binding/schema inspection, local/preview separation and actual private bucket configuration gate on CI 34457590942. |
| GHL-009 | R7 exact generated limitations for all 67 B/C records, with drift regression. |
| PERF-001 | R8 manifest/static-import regression; zero Workflow requests/cache entries in Academy; visited-Lab offline recovery. |
| EXR-007, EXR-009, PRI-001 | R9 actual late-booking pass/fail, later open architecture, learner-authored visible scope/price consequences; direct and browser regressions. |

The 313-row roll-up is 278 PASSED, 7 IN_PROGRESS, 8 PARTIAL, 12 IMPLEMENTED_UNVERIFIED,
2 DEFERRED and 6 NOT_STARTED. Priorities and acceptance wording are unchanged. This is not
Field-Ready Complete: 30 P0/P1 rows remain open.

### Complete remaining P0/P1 ledger

These are current gaps, not future promises or manufactured human-only blockers:

| Rows | Remaining boundary |
| --- | --- |
| PRD-004 | Core AI-Off/blocked-provider checks pass, but the exact all-environment AI-Off acceptance matrix is not fully established by those subsets. NOT_STARTED is retained for the whole-product reconciliation, not a claim that the existing core requires AI. |
| PRD-009 | Learning packages and sync ownership are separated; a blanket every-record/no-single-learner-assumption contract audit is not established by that architectural inspection. No commercial infrastructure is added to force a pass. |
| EXR-006 | Actual playback is implemented; immutable prediction-before-Lab enforcement remains a code gap. No synthetic expected execution or retroactive prediction acceptance is introduced. |
| EXR-008, PRI-002, NEG-003 | Deterministic authored checks and recoverable semantic gateway paths exist; broad quality/multiple valid open-language judgments need evidence beyond fixture pass scores. No paid calls or forced pass. |
| DATA-006 | Private media/audio ownership exists; R2 recovery backup/scenario attachment contract and recovery evidence remain incomplete. Local JSON export/restore is not falsely labelled an R2 backup. |
| INF-011 | Generic route boundary, AI failure, sync preservation and home recovery checks exist; the exact injected Call/Workflow/AI-client cross-environment matrix remains incomplete. |
| GHL-005, GHL-010 | Registry-native named surfaces and new Conversations record are corrected. Literal feature-like UI strings still exist outside the registry; the strict entire-UI official-name resolution criterion is not claimed from a handful of labels. |
| DES-006, DES-008, DES-017, DES-018, RSP-002, RSP-003, RSP-004 | Automated composition and interaction sweeps are substantial, not full per-screen Empty/Loading/Error/Keyboard/Touch or manual hierarchy/material/density/long-session evidence. Unfilled cells are explicit in the remediation screen matrix; layout alone is not major-screen completion. |
| A11Y-001 | Actual keyboard core-flow and axe checks pass; full manual/physical/assistive acceptance remains open as instructed. |
| PRD-005, CUR-015, CUR-031, FLD-001, EXR-020, CALL-002, CALL-005, CALL-006, EXR-015, VOI-006, VOI-007, SEC-005 | All twelve remain exactly IMPLEMENTED_UNVERIFIED. Real skill transfer, real GHL work, human microphone/device/browser and privacy acceptance are not code-generated evidence. |

P2/P3/deferred work is unchanged. In particular no PORT-003, INF-018, FLD-003 or SEC-006 expansion.

### Stable local browser verification

The stable Preview-mode build is labelled `remediation-r10`, not an immutable deployed SHA.
`phase-26-suite.mjs` runs 33 explicitly allowed probes sequentially with isolated profiles,
fake-media/controlled-provider boundaries, real scrollbar gutters and no live fieldwork mode.
The changed-exercise probe includes 30 additional axe scans (three changed surfaces × five widths
× two motion modes), with no serious/critical exclusions. Raw artifacts remain under
`.review/remediation/stable`; no private fixture blobs, tokens or media are committed.
Final suite result and immutable PR/CI/Preview attestation are recorded after completion.

Observed stable local outcomes: 29 probes genuinely passed in the original sweep. Fieldwork
failed twice at the desktop-to-phone retry because the driver measured a touch target before
the recomposed layout settled. The driver now waits two animation frames after scroll/focus,
remeasures, requires a hit-testable 44px target and passes all five widths, including native touch.
No fieldwork app behavior or human acceptance changed. The failed artifacts remain under
stable/fieldwork and fieldwork-rerun; corrected evidence is under fieldwork-settled.

The three real-server sync probes were **not** passing locally: no local sync pepper is configured,
so the server correctly refuses linking with 503. The old general sync driver caught its error
and exited zero despite writing “ok: false”; its apparent suite PASS is explicitly rejected here.
`probe-result.mjs` plus a direct regression now force a nonzero exit for caught errors, false or
missing verdicts. Deployed Preview sync/clients-sync/portfolio-sync remain required against the
configured dev service, not a fabricated local credential or production data.

First immutable implementation head: `3c6e73269deec606b424c0ed675a5452c5c7a95c`, draft
[PR #30](https://github.com/Beeyach/Bloomlab/pull/30) against the exact audit branch.
[CI 34457590942](https://github.com/Beeyach/Bloomlab/actions/runs/34457590942) passed Checks
(2090 tests / 157 files, adversarial and axe) and Preview; Production skipped. Read-only SEC-003
checks confirmed both media buckets have r2.dev disabled and no custom domains, without reading
learner objects. Preview version `98cede28-b729-4c44-be10-93713f0dd7c6` was deployed. This is
intermediate evidence: the final documentation/probe-hardening head must repeat complete CI,
privacy gating and exact Worker/browser identity before stopping for independent re-audit.

Final immutable SHA, CI URL/counts, Preview version and complete deployed browser outcomes will
be attached to PR #30 after the last commit. That avoids embedding a self-referential commit hash
in this file. A successful later run does not erase the failed local runs above. No merge.

### Resumed intermediate deployment and outbox observation correction

Head `61a54d2ac4a39ea9bd8c1524d62f52c00b99df8c` passed the complete local Node 22 chain
(2106 tests / 159 files, 15 adversarial cases, 75 axe scans with negative control) and a separate
production-mode build/accessibility run. Local Worker/browser IDs matched that exact head.
[CI 34477274168](https://github.com/Beeyach/Bloomlab/actions/runs/34477274168) attempt 1 passed
the test/validation/build stages but failed phone Field Ready readiness after 67 axe scans without
serious/critical violations. Its artifact lacks a failed-route DOM snapshot, so the cause is not
established. The same-head local production run and 40 Portfolio → Field Ready phone navigations
passed the unchanged readiness assertion. CI attempt 2 then passed all Checks and Preview;
Production skipped. No assertion, timeout or axe rule was weakened. The first failure remains
in `.review/remediation/ci-34477274168-failed`, and A11Y-001 is not promoted.

That Preview run confirmed both buckets' r2.dev access disabled and no custom domains without
reading learner objects, applied migration 0007 to `bloomlab-dev` only, and deployed version
`8d747069-8348-48c1-914e-3a38d3dcc74a`. Both deployed same-ID client and portfolio ownership
probes passed, including ignoring forged ownership, independent updates and tombstones. Home and
keyboard also passed before the broader sweep was stopped at the remaining general-sync driver
defect. This is intermediate evidence, not a completed final-head 33-probe sweep.

General sync completed linked-device recovery, conflict choice, convergence, deletion and revoke,
but its immediate `sync_queue 1` text check rejected a valid queue containing **two** operations.
The corrected driver reads notes and outbox in one read-only IndexedDB transaction while offline,
requiring the saved note's matching ID, revision and body in its queued upsert. Unrelated queued
entities no longer mask that evidence. A negative-control regression rejects missing, unrelated,
stale, wrong-ID/revision, deleted-note and delete-operation cases. Focused probe/store verification:
19 tests / 2 files pass. The deployed focused rerun passes with `queueCount: 2`, matching saved
note/outbox evidence, both-device conflict/convergence/deletion and revocation; no app or server
behavior was changed to satisfy the probe. Raw failed sweep and corrected probe artifacts remain
in `.review/remediation/final-preview` and `.review/remediation/outbox-observation-preview-61a54d2`.

The one additional regression and driver/document changes require a new immutable CI/Preview
attestation. Its complete sweep uses a fresh `.review/remediation/final-preview-<head>` directory,
preserving the stopped/failed run. Final verified outcomes belong in PR #30 before re-audit.
