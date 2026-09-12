# Field-Ready v1 code/audit closeout

Date: 2026-09-10  
Branch: `codex/field-ready-v1-code-closeout`  
Starting head: `fa8fd5b4e8dfb54f961b9f0d2104cc616150b59d`  
Base: `codex/navigation-shell-redesign` at `6a1ea64081e42a0dd6ea7efd3b78c0ee4abbd685`  
Draft PR: #32

This is the whole-product P0/P1 code/audit closeout requested by the handoff. It is not a
Field-Ready Complete claim, a new sidebar phase, a live-provider/GHL exercise or a substitute for
human visual and physical-device acceptance. DES-009 is inherited regression coverage only and
remains IN_PROGRESS.

## Authorized publication — 2026-09-11

The owner authorized the product commit/push and existing Preview verification flow. Commit
`6fe6147709a149601792dba019052c8ad3532d52` is pushed to draft PR #32; unrelated workflow
setup files/hunks remain local. GitHub run `34671395103` failed before Checks started, with
zero executed steps. Check-run annotation `103493279736` reports failed recent account payments
or an Actions spending limit requiring adjustment in Billing & plans. Preview and Production
jobs were skipped. This is not a failed application test or a new deployed verification result.

PR #32 records the blocker and preserves previous-source evidence as historical. No new Preview
Worker version, migration result, before/after identity or passing artifact exists for this
commit. The owner must resolve the GitHub account prerequisite; then rerun the same run under
the already granted authorization. C8 remains open; all requirement statuses remain unchanged.
These post-publication notes are local evidence updates, not another source commit.

The owner-requested retry on the same source also failed before executing any steps:
run `34671395103`, attempt 2, Checks job `103494179909`, with the identical billing/spending-limit
annotation. Preview and Production remained skipped. Repository visibility remains private;
no visibility change was requested or performed. No source change accompanied this retry.

## Internal continuation review — 2026-09-11

The continuation checked PR #32 against local HEAD
`77d063a3392d1d1e8807a926fc29039960762084` and its unchanged base. GitHub run
`34595911865`, attempt 2, reports successful Checks/Preview and skipped Production. The retained
Preview ZIP matches GitHub's SHA-256
`99b52a29fee6e88e1c40740d073d1b52454aa65aecaa4a221cafdf5f755c198f`; adversarial and
accessibility ZIP digests also match. Raw reports contain 35 passing browser probes, sixteen
AI-Off groups with the detected dependency negative control, five binary checks and five held
fault modes. Before/after browser and Worker identities equal HEAD; Worker version is
`b8639e5b-a0eb-4610-8ed5-f38e1120cb54`. These are inspected historical artifacts, not new live runs.

One fresh GPT-5.6 Sol High reviewer inspected the committed closeout diff. Three findings:

- High: deleting the old webhook adapter made pre-split saved incident workflows unrunnable.
- Medium: changed registry/scenario content retained the base content version.
- Medium: changed simulator capabilities/methods retained the base simulator version.

Corrections retain the old ID only in legacy action execution, preserving PATCH, saved records
and replay. Current capability inventory/palette still excludes the standard Webhook action;
new work uses Custom Webhook. Saved-node controls explicitly identify the legacy simulation and
preserve editable method/header/custom-data fields. Header maps now use the existing key=value
editor rather than a string input. Content is `2026.09.28.1` with a regenerated lock; simulator
is `2026.09.23-r2`. D-203 records the compatibility choice.

WEBHOOK-LEGACY-001 failed twice against the original implementation (POST and PATCH; 39 tests
passed), then passed after correction. WEBHOOK-LEGACY-002 loads both prior incident scenarios,
proves reads preserve their stored records/version, executes a real response and checks reload
and replay equality. WEBHOOK-LEGACY-003 checks legacy/current inspector editing and palette
boundaries. The initial inspector test used an exact label that omitted the required-field
marker; it was corrected to match the same labeled control, with no assertion removed.

Focused verification passed 567 tests across 23 files (full simulator-core plus affected
Workflow, persistence, Incident and exercise suites), followed by both expanded inspector
cases passing. The single focused Sol High re-review found no remaining actionable findings;
its scoped diff check passed. Parent-run typecheck, source ESLint (excluding retained `.review`
artifacts), content validation, terminology, build/browser secret scan, scoped formatting and
both status validators pass. The default aggregate run passed 2,165 tests and timed out the
terminology negative-control test at its unchanged 15-second limit. That file passed all three
tests alone. `npm test -- --maxWorkers=2` then passed all 2,166 tests across 170 files in
122.72 seconds, with unchanged assertions/timeouts. The original timed-out run remains failed
evidence. Source credential scanning also passes (1,320 repository files). No new local browser,
axe or full CI-chain pass is claimed.

The default `npm run lint` found 379 errors and eight warnings in retained `.review` artifacts
plus one new type-only import error. The import was corrected; source ESLint then passed using
`--ignore-pattern '.review/**'`. Retained evidence was not deleted or edited. Content validation
retains 35 existing coverage warnings; build retains its chunk-size warning.

Cross-version JSON restore is deliberately unsupported: backups containing `2026.09.23-r1`
simulator projects require their original engine. The re-review considered and retracted this
as a defect because C4 permits deliberately versioned compatibility and DATA-009 requires safe
unsupported-version rejection. A tentative cross-version test used an invalid checkpoint
fixture, failed before establishing compatibility, and was removed; no restore implementation
or existing test changed. This is not evidence of cross-version backup recovery.

Review reads were instructed to use a read-only filesystem/network-isolated bwrap subprocess.
The parent/custom-agent runtime has unrestricted permissions, so enforced agent-wide read-only
isolation is not claimed. No reviewer mutation was requested. There was one initial reviewer
and one focused correction re-review; no separate whole-product review loop.

The current correction tree needs new exact-head CI/Preview evidence. The previous passing
artifact cannot certify it. No browser re-audit was run locally because no working Linux Chrome
executable was found; no browser installation or live probes were attempted. The unexplained
navigation cancellation, failed supplemental sync timing gate, 216 unverified state cells and
all human/device/provider/GHL acceptance remain open. All eighteen parked/inherited/excluded
matrix rows match the base byte-for-byte. No requirement promotion, commit, push, deployment,
migration or paid-provider activity occurred in this continuation.

## Scope and final dispositions

The exact target list was PRD-004, PRD-009, EXR-006, EXR-008, PRI-002, NEG-003, DATA-006,
INF-011, GHL-005, GHL-010, DES-006, DES-008, DES-017, DES-018, RSP-002, RSP-003, RSP-004 and
A11Y-001.

| Requirement | Disposition | Evidence or remaining boundary |
| --- | --- | --- |
| PRD-004 | PASSED | C1 AI-Off harness holds the local setting Off, blocks Worker AI routes, and completes real learner route groups plus supporting learning/sync diagnostics and an injected negative control. |
| PRD-009 | PASSED | C2 ownership inventory and IndexedDB v9 migration cover all 20 persisted tables and the sync boundary. |
| EXR-006 | PASSED | C3 prediction is immutably committed before Lab access; actual observed execution is replayed and mismatch is shown. |
| EXR-008 | PARTIAL | Two authored architectures and no-feature prompt are deterministic; broad open-design semantic quality still needs non-fixture judgment. |
| PRI-002 | PARTIAL | Nine fields, five evaluation areas and multiple defensible prices are covered; pricing-reasoning quality still needs genuine semantic evaluation. |
| NEG-003 | PARTIAL | All seven strategies/reactions and low-confidence routing are covered; broad natural-language classification quality is not established. |
| DATA-006 | PASSED | C4 private R2 bytes, D1 metadata, scenario attachments and staged checksum-verified binary recovery are implemented and probed. |
| INF-011 | PASSED | C5 Call/Workflow/AI/sync failure injection preserves local work and proves unrelated environments remain usable. |
| GHL-005 | PARTIAL | Known vocabulary and branded phrases are checked; arbitrary unprefixed feature names and contextual generic-name exceptions are not exhaustively classified. |
| GHL-010 | PARTIAL | Webhook distinction and two CRM heading case defects are fixed; exhaustive native naming coverage remains unproven. |
| DES-006 | IN_PROGRESS | Rendered §70 signals and objective fabricated-number guards are automated; whole-product aesthetic/slop judgment remains human. |
| DES-008 | IN_PROGRESS | Per-screen rendered density proxies are recorded; intended hierarchy and long-session density remain human judgment. |
| DES-017 | IN_PROGRESS | Five-width screenshots exist for the authoritative inventory; hierarchy/material/restraint/comfort review is deliberately not auto-passed. |
| DES-018 | IN_PROGRESS | The 43-screen/five-width inventory is retained; family-level probe references do not prove every exact semantic/input cell. |
| RSP-002 | IN_PROGRESS | Objective reflow/overflow/touch evidence is broad; “deliberate first-class composition” across the whole product remains visual judgment. |
| RSP-003 | IN_PROGRESS | Automated routes retain controls and named actions on phones; whole-product desktop/mobile capability equivalence still requires human review. |
| RSP-004 | PASSED | All six named recompositions have 390/320 source and browser evidence, including new Skill Map touch and Inbox-flow assertions. |
| A11Y-001 | PASSED | Native keyboard input completes session start, exercise open/submit and representative Labs with visible focus. Physical Safari/AT is not claimed. |

## Checkpoints

### C1 — whole-product AI Off

`scripts/review/ai-off-suite.mjs` runs real browser paths for Command Center/session, Academy,
Skill Map/mastery, CRM, Workflow/Inbox, Funnel, Calendar, Payments, Incident, Reporting, Pricing,
Negotiation, Portfolio and offline recovery. The original `learning-probe` exercises `/system`
diagnostics; it remains supporting sync evidence. Academy and Skill Map now have their actual
learner probes in C1, plus a saved/pending open-ended fallback and a real injected AI dependency
that must fail the same deterministic-path classifier. `REVIEW_AI_OFF=1` repeatedly holds the actual IndexedDB setting at
Off and refuses `/api/ai/*` before transport. A deterministic path fails the suite if it attempts
AI; open-ended fallback is classified separately rather than treated as a deterministic success.

### C2 — learner-owned persistence

IndexedDB v9 scopes every stored row to a learner and rekeys legacy records without inventing a
commercial account/team model. The future-proofing inventory covers all 20 tables, and tests pin
same-ID separation, sync envelopes and migration behavior. The product retains the intended
one-learner-per-sync-key boundary.

### C3 — exercise contracts

RUN THE LEAD now atomically locks the learner's prediction before exposing Lab execution. Later
writes cannot replace it. The returned runner shows a read-only replay from actual simulator
events and highlights predicted/observed differences. Open architecture covers two structurally
different authored successes, Pricing covers all nine economics inputs and multiple prices, and
Negotiation covers all seven strategies plus low-confidence fallback. EXR-008, PRI-002 and NEG-003
stay PARTIAL because fixture breadth is not broad semantic quality.

### C4 — binary recovery

Migration 0008 adds scenario-attachment and recovery-stage metadata. Authenticated bounded uploads
store bytes in private environment-specific R2 and metadata/checksums in D1. The versioned `.blb`
archive rejects foreign ownership, credentials, corruption and oversized content; preview is
staged, confirm is explicit and current matching bytes are never overwritten. The deployed probe
uses disposable synthetic Preview learners/media and deletes/revokes them afterward.

### C5 — failure isolation

The injected matrix fails Call transport, the Workflow Web Worker, the AI route and sync transport
one at a time. It checks reload/retry, unchanged local sentinel evidence, no partial Workflow run,
same AI attempt on retry, queued sync recovery without duplicated notes, and continued use of the
other major environments. These are controlled failures, not live provider outages.

### C6 — HighLevel terminology

The audit parses TS/TSX strings, YAML and MDX across the configured learner-facing surfaces. It
validates known IDs/names, stale aliases, standalone native heading case drift and branded phrases while
explicitly classifying native configuration terms, Bloomlab teaching terms, generic/instance nouns
and historical references. It found one concrete defect: standard **Webhook** and the current,
distinct **Custom Webhook** action had been conflated. The registry/content/runtime now distinguish
them. Independent continuation found two CRM headings whose `Custom fields` casing bypassed the
checker; they now use registry-backed `Custom Fields`, with a negative control. Arbitrary unprefixed
native names and context-free generic-term exceptions remain uncovered. GHL-005/GHL-010 are PARTIAL;
a zero-problem vocabulary report is not exhaustive naming or native behavioral parity.

### C7 — design, responsive and objective accessibility

The screen inventory is derived from `APP_ROUTES` and the compiled content bundle instead of a
hand-picked screenshot list. It instantiates every learner route, dynamic detail route, a minimal
Academy set covering every embed component, all 17 exercise types and an explicit not-found state;
five developer-only routes are listed separately.

The deployed polish sweep records 215 default-layout cells at 1440/1024/768/390/320, density
metrics, touch target/input size, overflow, prohibited §70 rendered signals and reduced-motion
animation state. The state matrix retains related browser references, explicitly labeled shared loading/error
contracts and genuine N/A reasons. Its prior family-level references were overstated as proof of
every state. They now say `RELATED_BROWSER_EVIDENCE`; exact screen/state/input assertion mapping
and missing execution remain open, so DES-018 is IN_PROGRESS. Every row retains `human_visual_review: REQUIRED`.

Specialized 390/320 evidence covers Workflow's vertical editor/sheets, CRM's stage
switcher/scroller/non-drag picker, Academy's editorial flow, Call Room's retained voice/recovery
controls, Inbox's list→single-conversation composer and Skill Map's semantic territory-first touch
selection. The native keyboard probe covers start-session → open exercise → submit → representative
Labs using Tab/Shift+Tab/Enter/Space/arrows and visible focus. Axe is corroborating evidence with an
unnamed-control negative control, not a physical-device or assistive-technology certificate.

Navigation and sidebar-resize probes run only as inherited regression coverage. No sidebar design
work or DES-009 status change occurred.

### C8 — reconciliation and immutable verification

Seven objective promotions are retained: PRD-004, PRD-009, EXR-006, DATA-006, INF-011, RSP-004
and A11Y-001. Eleven targets remain non-PASSED with the exact boundaries in the
table above; inherited regression row DES-009 separately remains IN_PROGRESS. All P2/P3/deferred
rows are outside scope.

The final GitHub Actions path uses Node 22 on the immutable PR source SHA. Checks include typecheck,
lint, format, all unit/integration/Worker tests, adversarial cases, control-doc/source-secret,
content/terminology/inventory/freshness/voice, production-mode client build with built-browser
secret scan, and the complete axe suite/negative control. Preview then checks private R2
configuration, applies migrations to `bloomlab-dev`, deploys, and runs all 35 critical browser
probes plus C1/C4/C5/C6/C7 gates. Browser DOM and Worker `/api/health` must equal the same source SHA
before and after. Production remains skipped.

Because a commit cannot contain its own hash, the immutable values are not guessed into this file.
The canonical exact-head record is the `field-ready-preview-<SHA>` artifact's
`.review/field-ready/attestation.{json,md}`, the captured Wrangler migration/deployment logs and the
final evidence description on draft PR #32. Those records contain the final SHA, CI run, Preview Worker
version and before/after browser/Worker identities without changing the verified source head.

## Preserved acceptance boundaries

The following twelve rows remain exactly IMPLEMENTED_UNVERIFIED: PRD-005, CUR-015, CUR-031,
FLD-001, EXR-020, CALL-002, CALL-005, CALL-006, EXR-015, VOI-006, VOI-007 and SEC-005. Controlled
fixtures cannot prove personal skill transfer, real-GHL execution, human microphone/device behavior
or human privacy acceptance.

No provider request, real-GHL request, live fieldwork submission, production migration or production
deployment is part of the closeout. Preview activity is limited to read-only bucket-configuration
checks and disposable synthetic learner/media data. Provider spend is $0.

## Independent continuation audit

Continuation starting head: `13ae175916757ce4876d7ed548417e28fa9d570b`, clean worktree, draft PR #32
against `codex/navigation-shell-redesign`. The previous source commits and failed-run artifacts
were preserved. Run `34552435861` was checked directly: navigation, restore, Workflow performance
and Fieldwork failed. C1 independently failed its own Workflow sample (202 ms maximum frame,
199 ms long task); the state generator failed downstream on the required browser results. The following `13ae175`
changes are legitimate lifecycle/performance fixes: wait for the mounted shell/heading/request gate,
reuse timezone formatters, memoize history rows, and bound recent rows while retaining older history.
The 50 ms p95 and 100 ms maximum frame/task assertions remain unchanged.

The continuation independently compared all eighteen target requirements with the authoritative
acceptance criteria and implementation, without accepting the prior ten-promotion summary:

| Checkpoint | Independent disposition |
| --- | --- |
| C1 | Strengthened: actual Academy/Skill Map, Payments and Incident learner probes, saved/pending AI-Off fallback, and an injected request that the deterministic verdict must reject. The developer learning probe is explicitly supporting evidence. |
| C2 | Retained: explicit learner IDs in the 20-table local inventory, D1/sync ownership and migrations, local-media ownership rejection, and pure engine inputs. One learner per device/sync key is the retained application boundary; no commercial infrastructure added. |
| C3 | Retained: immutable prediction/checkpoint, reload and actual simulator replay. Open architecture, pricing reasoning and negotiation language remain PARTIAL; no fixture-to-semantic promotion. |
| C4 | Strengthened: deployed archive restore now adds a missing synthetic file and verifies downloaded bytes/original preservation. Worker tests repair all four private binary classes. Asynchronous export storage errors now reach the sanitized retryable response. |
| C5 | Strengthened: the fault remains enabled during unrelated-route checks; push and pull fail separately, and sync retry must preserve a newer local note edit. |
| C6 | PARTIAL: fixed real CRM heading drift and added a negative control. Known-term scanning does not exhaustively classify arbitrary unprefixed native terms or context-free generic-name exceptions. |
| C7 | PARTIAL: retained five-width layouts, named mobile compositions and native keyboard core flow, adding native Workflow execution and Funnel Preview activation. DES-018 reopened because whole-probe success was incorrectly promoted to screen/state proof. Human visual/density/mobile-equivalence boundaries remain. |
| C8 | Reconciled to seven supported promotions, eleven non-PASSED targets, unchanged twelve human rows and 24 open P0/P1 requirements. Final source must pass the complete immutable CI/Preview path before stopping for audit. |

The corrected matrix preserves passing browser references and screenshots; it does not relabel
missing semantic states as N/A or pass. The unchanged acceptance criteria still require those cells.
No performance assertion, accessibility threshold, provider boundary or production gate is relaxed.

## Failed attempts retained

- Independent re-audit of C3 at `8a6acbc` found a persistence gap hidden by the disabled prediction
  input: `saveResponse` refused changed nonempty predictions but still accepted a cleared answer,
  a removed/replaced checkpoint, or a fabricated checkpoint before commitment. All four direct
  refusal regressions failed on that source. Ordinary saves now reject any checkpoint property,
  including explicit `undefined`, and detect an explicitly cleared committed prediction. Only
  `commitRunPrediction` can establish the boundary. Existing prediction/reload/new-attempt and
  actual-execution assertions remain unchanged; the full final source must be verified again.

- Run `34588323537` attempt 1 at `8a6acbcde6f723777d8d78e0ff10bdcb44d652cb` passed Checks
  (2,156 tests / 169 files, 15 adversarial cases, 89 axe scans, negative control and zero
  serious/critical violations), 32/35 browser probes, all 16 AI-Off groups and negative control,
  binary recovery, all five C5 faults and terminology. Initial polish/axe identity reads returned
  the preceding `67a1b02` deployment; their strict assertions correctly failed. Later navigation
  captured a blank Workflow page whose required React module request was canceled with
  `net::ERR_ABORTED`; the underlying cancellation cause is not identified. Screen-state generation
  failed downstream. Artifact `10196031040` is retained (SHA-256
  `16b52884768dac91605ff67c3ca759f12cd1f36da4b5d18edfac2e6d02b2ce87`), with Worker
  `9117f5cf-8da9-49ff-8b16-d657a559ee9a`. Overall before/after identities matched `8a6acbc`, no
  migrations were pending, and Production was skipped. Attempt 2 runs unchanged source after the
  deployment settled; it cannot be treated as a product fix for the canceled module request.

- An independent copy of the C5 harness strengthens unrelated-route readiness into real
  operations while preserving every original assertion and timeout: Workflow execution writes
  simulator events, CRM contact creation survives reload, Academy's calculator responds to
  native keyboard input, and Call notes save/reload. Nine operations under held Call/Workflow/AI
  faults passed; four additional operations under held push failure also passed. The expanded
  44-operation burst then failed the unchanged ten-second manual-sync gate. Retained fetch/lock
  traces show a 12.1-second push and about 15.6 seconds through the final pull, after which all
  outcomes were applied, the outbox was empty, the completion counter advanced and the lock
  released. This proves eventual recovery, not a complete supplemental pass or compliance with
  that timing gate. The standard five-fault CI matrix passed at the same source. Earlier local
  attempts include a blank reload without definitive cause, confirmed Chrome
  `ERR_INSUFFICIENT_RESOURCES` with `/tmp` 99% full, and a confirmed too-long temporary socket
  path. Evidence was moved intact to persistent workspace storage and a short persistent browser
  temp path was used. Those setup diagnoses do not retrospectively explain GitHub failures.

- Run `34583523251` at `67a1b02375e829d04c964a094a7c90fa1633ad55` passed Checks:
  2,156 tests / 169 files, all 15 adversarial cases and 89 axe scans with the negative control
  and no serious/critical violations. Preview passed 34/35 browser probes, all 16 AI-Off groups
  and the negative control, binary recovery, all five held C5 faults including interrupted-push
  recovery and whole-outbox drainage, and terminology. JSON restore alone failed after successful
  data restoration because focus stayed on the page body instead of returning to the enabled
  file chooser; screen-state generation failed downstream. Both Workflow samples passed
  (25.4/25 ms p95, 48/41 ms maximum, no long tasks). Artifact `10194319542` is retained
  (SHA-256 `8421e490e7f9528916184505d5d267265cced5e10a8212869eca368e39cf72e6`). Worker
  `25c7ffa4-609e-4307-a137-334e4da6eb74` and all before/after browser/Worker identities matched
  `67a1b02`; no migrations were pending and Production was skipped.
- A controlled frame-before-commit regression reproduces JSON restore's lost focus. Scheduling a
  frame from the async handler did not guarantee that React had re-enabled the chooser. Focus now
  returns from an effect after the enabled input is committed. Related regressions also proved
  lost chooser focus after private-media confirmation/cancellation; those transitions use the same
  committed-state boundary. All three focus checks fail on the old code and pass after the fixes,
  alongside all 23 focused restore tests, type checking and scoped lint. The local browser restore
  probe also passes all five short-height widths, offline restore, reload, keyboard/focus and touch.
  Existing assertions and timeouts are unchanged. Final deployed exact-head verification remains required.
- Run `34582745175` at `eedec645f2fa10b1ad60a8d5b3b55bb93473271d` passed 2,155 tests
  and failed one negotiation dialogue assertion. The saved turn already matched the required
  action/text, but the assertion ran before the async send handler rendered its returned state.
  The test now awaits that same required dialogue with the existing default timeout. All
  persistence assertions remain; Preview and Production were skipped. This is a test lifecycle
  correction, not a claimed negotiation product fix.
- Run `34577143186` at `1b0e65814974879d11aa11bc55899165db5866d8` passed Checks:
  2,155 tests / 169 files, all 15 adversarial cases and 89 axe scans with the negative control
  and no serious/critical violations. Preview passed all 35 browser probes, all 16 AI-Off
  positive groups and the negative control, binary recovery, terminology and screen-state
  generation. Both Workflow samples passed (24.4/23.9 ms p95, 48/39 ms maximum, no long tasks).
  C5 alone failed while awaiting manual sync during the separate pull-failure case. Its retained
  page showed 12 stranded `syncing` outbox rows and a zero manual-completion counter. Worker
  `b3a3a841-9ac8-46e7-9cb7-a4a35f226212` and all before/after browser/Worker identities matched
  `1b0e658`; no migrations were pending and Production was skipped. Artifact `10191561644`
  is retained (SHA-256 `a8b8703094f8d1083710b1af70fd42ec36cb567a860fdc553ee05625d4fbd1ad`).
- A direct reopen regression confirmed that interrupted pushes leave rows permanently `syncing`;
  ordinary retry skipped them. Sync now holds a per-database browser lock across the round trip
  and reclaims abandoned in-flight rows only after acquiring it, preserving newer edits and
  explicit rejected-work status. This follows the [Web Locks lifecycle](https://w3c.github.io/web-locks/#lock-termination)
  so an active cooperating tab is not reset. C5 now interrupts a held push by reloading and
  requires the whole outbox to drain, in addition to every existing note/ownership/retry assertion.
  The regression fails on the old engine and passes with the fix.
- A controlled moving-button check also confirmed that the pointer helper could miss its target:
  it measured before hover and pressed at stale coordinates after the control moved. It now
  verifies stable geometry and hit testing before one native press/release sequence; no action
  is retried after sending it. The old helper misses the controlled button and the corrected
  helper clicks it. Existing acceptance assertions and performance ceilings remain unchanged.
  Manual-sync failures retain input targets and the button's completion/disabled state. These
  reproduced defects do not conclusively attribute the old CI timeout to one sole cause.
- Additional deployed C5 diagnostics at `1b0e658` retained an unrelated Call-route error boundary
  while Workflow failure was held, then an incomplete browser run at that route. The first lacked
  the underlying exception; the second was terminated after it stopped responding to evaluation.
  Neither is treated as a pass or an identified application fix. The isolated local C5 run after
  the changes passes all five held faults, interrupted-push recovery and the full-outbox checks
  with no captured browser errors. The local two-device learning and full sync/conflict/revocation
  probes also pass, alongside 29 focused tests, type checking and scoped lint. Final deployed
  verification remains required.
- Run `34576407456` at `2075a4990cf65b244d4457887142db31da8fe182` passed 2,154 tests
  and failed the private-media review-heading focus assertion; Preview and Production were
  skipped. The heading had rendered but its post-commit focus effect had not yet run. The test
  now awaits the same required focus with Testing Library's unchanged default timeout, as well
  as the actual completion/cancellation DOM updates after their API callbacks. Focus, staging,
  explicit-confirmation and cancellation assertions are retained; no product change is inferred.
- Run `34571510149` at `71bf952bf4d757bb76e99de285a0f56d9a2e4cb6` passed Checks:
  2,153 tests / 169 files, 15 adversarial cases and 89 axe scans with the negative control and
  zero serious/critical violations. Preview passed 34/35 browser probes; CRM's touch sample had
  no board/card, while its five-width and keyboard checks passed. Navigation passed with no
  captured browser errors. C1 passed 15/16 positive groups and its negative control; the learning
  sync diagnostic failed to converge after offline evidence. Binary recovery and terminology
  passed; C5 stopped before observing its controlled sync-push error. Screen-state generation
  failed downstream on CRM. Worker `c3cece58-f36c-4c36-a215-afaf112aff81` and all before/after
  browser/Worker identities matched `71bf952`; no migrations were pending and Production was
  skipped. Artifact `10189378968` is retained (SHA-256
  `9eaa031695e711ad195206d2f47350c685e89717ddad74fcd2bdc496aada1f42`).
- A deterministic regression exposed a real sync overlap defect: a manual request during a
  background pull returned the old round trip, missing a write made after its push phase. Sync
  now coalesces overlapping requests into a following round trip per local database. Separate
  databases no longer share a module-wide running promise. Both regressions fail on the old
  engine and pass after the fix. This explains a possible sync failure mechanism; the deployed
  failed report did not retain enough timing data to establish it as the sole cause.
- The learning helper also accepted an already-empty outbox before its requested pull and
  derived progress completed. Diagnostics now expose completed manual rounds; the probes await
  that completion and still require an empty outbox, identical cross-device rows and all original
  held-fault/local-state assertions. The existing per-wait timeout is unchanged.
- The deployed CRM failure did not repeat in the full original five-width/keyboard/touch sequence
  with Chrome 152.0.7977.82. CRM now retains bounded exception/request/page context and failure
  screenshots, without changing readiness, touch, layout or motion assertions. Its cause remains
  unknown; a later pass must not be described as proof of a CRM application fix.
- The screen-state audit also found two invalid shared-contract claims for the wildcard NotFound
  screen. It is imported synchronously and sits outside the per-screen error boundary. Its
  nonexistent data-loading lifecycle is now explicitly N/A; error behavior is UNVERIFIED and
  included in the unresolved count. DES-018 remains IN_PROGRESS.
- Run `34567088346` at `6f612660b91c33d8af42986b771fa8c5ee4efa21` passed Checks:
  2,153 tests / 169 files, 15 adversarial cases and 89 axe scans with the negative control and
  zero serious/critical violations. Preview passed 34/35 browser probes. Navigation failed at
  the `768x900-collapsed-normal` route reset after its wheel assertion; the retained screenshot
  is a blank application page, and the report lacks the browser exception/network data needed
  to identify the cause. Screen-state generation then failed on that required probe. All 16
  C1 positive paths and the injected negative control passed, as did binary recovery, all five
  held faults and terminology. Both Workflow samples passed (24.4/26.1 ms p95, 41/52 ms maximum
  frame, no long tasks). Worker `5d5bba45-59df-460e-b8c7-301e23d4dde5` and before/after browser
  and Worker identities matched `6f61266`; no Preview migrations were pending and Production
  was skipped. Artifact `10187511170` is retained.
- The blank-page navigation failure did not reproduce in 500 focused reloads each with Chrome
  153.0.8010.12 and GitHub's exact Chrome 152.0.7977.82, or in either browser's full 38-case navigation
  sequence. A deliberately blocked startup script verifies that the new diagnostic capture retains
  the failed request and empty root while the unchanged readiness gate fails. The navigation probe
  now captures bounded browser exceptions, failed requests and
  current navigation response/page details. This is diagnostic instrumentation, not a claimed
  product fix; all readiness, layout, scrolling, input and identity assertions/timeouts remain
  unchanged. The failed run remains a disclosed verification concern even if a later run passes.
- Run `34563212145` at `9623217a6e67d99e319ad41a398c0e0970e1b4d3` passed Checks:
  2,152 tests / 168 files, 15 adversarial cases and 89 axe scans with the negative control and
  zero serious/critical violations. Preview browser probes passed 34/35; Calendar booking failed
  and confirmation/reschedule/cancellation then failed downstream. C1 passed 15/16 positive paths
  and correctly rejected its injected dependency; Pricing's 1440px sample lacked the whole work
  area. The artifact `10186093695` and screenshots are retained. Both Workflow samples now passed
  (23/23.5 ms p95, 31/37 ms maximum frame, no long tasks), all 215 polish cells passed, and binary
  recovery plus all five held-fault cases passed. Screen-state generation failed on Calendar.
  Preview Worker `7cceedc5-8b4b-495d-a9c9-fcae3ddc36d7` and all before/after identities matched
  `9623217`; Production was skipped.
- Calendar reset did not mark the account busy while its asynchronous save was unfinished. A
  delayed real-reset regression failed against that implementation; reset now excludes other
  mutations until its committed generation is rendered. The Calendar probe now waits for that
  generation and for the requested calendar's actual title before selecting a slot, instead of
  accepting a slot still present from the previous calendar. Booking/lifecycle assertions remain.
- Pricing cleared IndexedDB while its previous document and AI-Off timer were still active. Its
  reset fixture now unloads that document before clearing storage; Sales, Negotiation and the AI
  probe use the same helper for their identical fresh-fixture boundary. Each open must render its work
  area within the existing timeout; failure retains text and a screenshot. The seven-area check,
  widths, amounts, keyboard and motion assertions are unchanged.
- Run `34562613755` at `ddd432343ecbc9fa2ca19e0e3f9a83e688633389` passed 2,151 tests and
  failed the initial hint-drawer assertion. The test waited for an IndexedDB row then immediately
  queried React's DOM; the live-query notification had not rendered `Independent` yet. It now
  waits for that same required visible text, using the existing Testing Library timeout. No
  assistance, persistence or reload assertion is removed. Preview and Production were skipped.
- Continuation run `34561969517` at `9c360d2cc5a86b6a9af034608f62bdf8efe5f4ea` passed
  2,150 tests but failed two CRM screen assertions that still expected the old `Custom fields`
  heading. They now require the corrected exact `Custom Fields` label; both heading assertions
  remain. The deployed CRM probe now waits for that same corrected heading. Preview and Production were skipped. This failed run is retained, not accepted as final
  verification.
- Starting-head GitHub run `34558116726` at `13ae175916757ce4876d7ed548417e28fa9d570b`
  failed despite Checks passing (2,150 tests / 168 files, 15 adversarial cases). Its full artifact
  `10184328117` is retained: browser 33/35, with polish stopping at Explain It readiness after 184
  layout cells (zero recorded layout violations), and Workflow failing at 225 ms maximum frame /
  216 ms long task. The separate C1 Workflow sample failed at 122 ms / 98 ms. Failure isolation
  failed its pending-outbox assertion; the artifact did not capture the transient row. Source review
  found that existing error text can precede completion of the current retry, so it did not establish
  that the current attempt had returned the outbox row. Screen-state generation failed downstream.
  Browser/Worker before and after both matched `13ae175`; Worker version was
  `ae8eba9a-3600-481b-a1fa-6cbd68672248`; Preview had no pending migrations; Production was skipped.
- A diagnostic Chrome trace isolated repeated IndexedDB full payload reads in the sync status and
  scheduler. Simulator snapshots made those reads increasingly expensive. Both now count through
  the existing status index, with consistent indicator reads in one transaction; no data or sync
  behavior is removed. The unchanged local 504-event probe then took 5.1 seconds (26.9 ms p95,
  42 ms maximum frame, no long tasks), versus roughly 34 seconds before. Sixteen sync tests pass,
  including preservation of failed work in the pending indicator. Final GitHub Chrome remains the
  required verification authority. The subsequent local polish sweep passed all 215 cells; the
  starting-head Explain It readiness failure was not reproduced locally and remains retained.
- Sync failure evidence now waits for the actual outbox rollback rather than an earlier error
  banner, and holds both push/pull failures during unrelated navigation. The polish failure path
  now retains its current route, status/alert text and screenshot for diagnosis; its readiness,
  layout, motion and size assertions are unchanged.
- The continuation reproduced the asynchronous export failure against the original handler
  (one expected failing test), then verified the sanitized retry response with the fix.
- The expanded local C1 diagnostic retained a 103 ms maximum Workflow frame against the unchanged
  100 ms ceiling (46.7 ms p95; no long task over 100 ms). Local diagnostic timing is not substituted
  for the required final GitHub Ubuntu Chrome verification.

- The first closeout exact-head Node 22 run exposed an auto-resubscribed draft-read error, recovery
  transport in the wrong source boundary and render-timing focus assertion. Those three failures
  were reproduced and fixed; the original run is not evidence.
- The next exact-head run exposed queued Call Room checkpoint work crossing test boundaries and a
  reused one-shot `Response`. The test now drains queued work before clearing IndexedDB and creates
  a fresh response per request; the failing run is not evidence.
- The first post-deploy identity request reached the preceding Preview Worker during edge
  propagation even though Wrangler had published the new version; subsequent live health reads
  converged to the deployed SHA. The attestation now waits within a bounded window for exact Worker
  and browser equality rather than accepting either stale identity.
- Exact-head run `34542916287` passed all Node 22 Checks and exact before/after deployed identities,
  then correctly failed its Preview attestation. Its isolated Preview job had not regenerated the
  ignored `.content/bundle.json`; Chrome reset the page document's `navigator.onLine` signal across
  service-worker-backed reloads; two probes assumed programmatic focus or a fixed initial Skill Map
  territory; a transient fieldwork read dereferenced an incomplete saved draft; and one deep
  IndexedDB result exceeded CDP's object-reference serialization limit. The Preview preflight and
  probes now test the intended boundaries explicitly. Its separate 504-event sample retained the
  existing 100 ms hard ceiling after recording a 38.7 ms p95 but two over-limit spikes; the ceiling
  was not weakened, and the failing run is not evidence.
- Exact-head run `34546706774` passed all Node 22 Checks, 33/35 browser probes, exact before/after
  identities, binary recovery and terminology, then correctly failed its Preview attestation. The
  504-event Worker sample kept a 43 ms p95 but mounted run-history growth produced 180–250 ms long
  tasks and a 256 ms maximum frame. Workflow now mounts the 24 most recent runs and exposes older
  history on demand; the unchanged ceiling also records slow-frame/long-task iteration details. The
  Run-the-Lead probe now follows the actual commit → linked Workflow execution → grade sequence.
  Failure isolation now returns a boolean rather than a DOM graph over CDP and proves retry for the
  deliberately failed note plus its confirmed server shadow, rather than requiring unrelated queued
  fixture records to disappear. This failing run and its downstream cascade are not evidence.
- Exact-head run `34552435861` passed all Node 22 Checks, 31/35 browser probes, exact before/after
  identities, binary recovery, failure isolation and terminology, then correctly failed its Preview
  attestation. Navigation queried before one reduced-motion route shell had committed; restore
  scheduled focus before its preview heading had committed; and the phone fieldwork fixture could
  release its held upload before the request registered the gate. Those lifecycle boundaries now
  wait for the actual shell, committed heading and registered request respectively. The 504-event
  Worker sample retained a 38.8 ms p95 but one 115 ms frame and one 105 ms long task after repeated
  visible-history reconciliation and date-formatter allocation; the recent list is bounded to 12,
  unchanged rows and timezone formatters are reused, and older runs remain available on demand.
  Displayed time and the 100 ms ceiling are unchanged. The separate AI-Off Workflow sample also
  failed (202 ms maximum frame / 199 ms long task); this was an independent failure, not merely a
  downstream cascade. The screen-state generator then failed on missing passing probes. None is
  accepted as successful closeout evidence.
- The first local browser launch lacked shared libraries. Temporary local runtime libraries allowed
  focused reproduction of the three failures, but those diagnostic runs are not browser/a11y
  evidence; the GitHub Ubuntu Chrome run remains canonical.
- `vitest --project simulator-core` named a project that is not configured. The corrected direct
  simulator invocation passed 39/39; the invalid filter remains disclosed.
- A targeted runner command initially named two nonexistent test files and executed zero tests.
  The corrected files passed 40/40; the zero-test command is not evidence.
- One local full-suite run shared the host with concurrent TypeScript and ESLint processes and
  timed out two unrelated async UI assertions. The two files passed 45/45 immediately when rerun
  alone. A later patched-tree aggregate run passed 2,149 tests and timed out one Funnel preview
  assertion under load; that file passed 16/16 immediately alone. Only the sequential exact-head
  CI result is canonical.
- A local two-width axe pass completed 79 scans before one client-detail readiness wait expired
  without an axe violation. The unchanged 390 px sequence then passed every screen, including that
  detail route, with zero serious/critical violations and the live unnamed-control negative
  control. The interrupted pass is not evidence; exact-head CI remains canonical.
- Targeted C7 lint found an undefined `assert` in the new Inbox probe and was fixed before commit.
  Full lint then exposed the C3 `context` dependency warning; a stable `useMemo` context removed it,
  with runner regressions rerun.

Intermediate local focused results are supporting evidence only: C4 Worker coverage passed 226
tests; C6 web coverage passed 21/21 and simulator coverage 39/39; C7 screen/Lab coverage passed
46/46 and corrected runner coverage 40/40. Final totals and immutable identities come only from the
final CI/Preview attestation.

Internal audit and focused correction re-review are recorded above. The owner authorized the
product commit/push and fresh exact-head CI/Preview verification on 2026-09-11; results will be
recorded in the PR and retained artifact. Do not merge.


## Public visibility preparation — 2026-09-11

Owner intent: make Bloomlab public so its standard hosted Actions do not consume the
private allowance needed by separate `Beeyach/bloomops`. Visibility is still private.

Read-only preparation scanned 256 reachable commits / 3,256 blobs with the repository
credential rules, plus the subsequently fetched missing remote branch head; no rule matches.
The independent reviewer scanned 1,316 tracked working-tree files with additional Sync Key,
provider/JWT patterns and reviewed privacy-sensitive documentation; no tracked-source blocker
was demonstrated. Parent checks covered 40 issue/PR/comment bodies and 210 available completed
Actions log archives (690 log files), with no known credential-pattern matches. These pattern
checks cannot certify arbitrary text or image pixels; no actual Sync Key was displayed or used.

A concrete blocker exists in retained Preview artifacts: `sync-probe.mjs` captures
`sync-a-key.png` after displaying a generated key. Worker device revocation leaves the root
key usable for a fresh link. Before public visibility, privately archive and remove affected
GitHub artifacts. Remote learner/key invalidation is optional defense in depth while the
repository stays private through artifact removal; no prior public exposure is evidenced.

Correction: the shared CDP screenshot helper temporarily hides marked private elements and
descendants, legacy sync-key/QR selectors and password inputs. It checks computed visibility,
refuses capture if masking fails, and removes its style in `finally`. SyncScreen marks its
key display, QR and key-entry input. No learner interaction or credential storage changes.
Regression uses JSDOM plus a mock CDP capture to assert masking, visible ordinary content,
DOM/value preservation, cleanup after capture failure, and no capture when masking fails.

Verification: 428 tests / 15 files (privacy regression and simulator core), all-workspace
typecheck, scoped ESLint, content validation and build/browser-secret scan pass. Existing
content/build warnings remain. No actual Chrome rerun: retained Linux Chrome lacks
`libnspr4.so`, and browser installation/repair is outside scope. One Sol High initial review
confirmed the artifact blocker; its single focused correction re-review found no material correction findings. Reviewer
shell reads use a read-only Bubblewrap mount; the parent runtime is unrestricted, so no
runtime-wide reviewer isolation is claimed.

All 70 unexpired Actions artifacts (2,238,335,567 bytes) are privately archived at
`.review/public-readiness-j28iglne/` (directory permissions 0700). `manifest.json` records all
70 successful downloads and SHA-256 agreement; a final independent rehash also found zero
mismatches. Thirteen archives contain `sync-a-key.png`. Exact proposed GitHub artifact deletion
IDs (also in the private `proposed-deletion.json`): `10178901833`, `10180412246`, `10182290828`, `10184328117`, `10186093695`, `10187511170`, `10189378968`, `10191561644`, `10194319542`, `10196031040`, `10261392666`, `10263267586`, `10265328525`.
The owner subsequently approved deletion and publication. All 13 targeted artifacts were
deleted and verified absent from GitHub (57 remain). Preserve local ZIPs, `manifest.json`
and `deleted-artifacts.json`. Publish the corrected
probe before new public Preview runs; old unmasked heads must not be rerun publicly.
At this source checkpoint visibility remains private; no credential mutation or remote
learner-data change occurred. Publication and exact-head verification follow this commit.
