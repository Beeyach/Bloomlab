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
final evidence comment on draft PR #32. Those records contain the final SHA, CI run, Preview Worker
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

Stop for independent ChatGPT audit. Do not merge.
