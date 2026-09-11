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
| PRD-004 | PASSED | C1 AI-Off harness holds the local setting Off, blocks Worker AI routes, and completes eleven whole-product path groups. |
| PRD-009 | PASSED | C2 ownership inventory and IndexedDB v9 migration cover all 20 persisted tables and the sync boundary. |
| EXR-006 | PASSED | C3 prediction is immutably committed before Lab access; actual observed execution is replayed and mismatch is shown. |
| EXR-008 | PARTIAL | Two authored architectures and no-feature prompt are deterministic; broad open-design semantic quality still needs non-fixture judgment. |
| PRI-002 | PARTIAL | Nine fields, five evaluation areas and multiple defensible prices are covered; pricing-reasoning quality still needs genuine semantic evaluation. |
| NEG-003 | PARTIAL | All seven strategies/reactions and low-confidence routing are covered; broad natural-language classification quality is not established. |
| DATA-006 | PASSED | C4 private R2 bytes, D1 metadata, scenario attachments and staged checksum-verified binary recovery are implemented and probed. |
| INF-011 | PASSED | C5 Call/Workflow/AI/sync failure injection preserves local work and proves unrelated environments remain usable. |
| GHL-005 | PASSED | C6 exhaustive learner-facing terminology audit rejects missing registry coverage and unclassified native feature-like strings. |
| GHL-010 | PASSED | C6 exact official-name/alias audit corrected standard Webhook versus distinct Custom Webhook naming. |
| DES-006 | IN_PROGRESS | Rendered §70 signals and objective fabricated-number guards are automated; whole-product aesthetic/slop judgment remains human. |
| DES-008 | IN_PROGRESS | Per-screen rendered density proxies are recorded; intended hierarchy and long-session density remain human judgment. |
| DES-017 | IN_PROGRESS | Five-width screenshots exist for the authoritative inventory; hierarchy/material/restraint/comfort review is deliberately not auto-passed. |
| DES-018 | PASSED | C7 machine-readable matrix covers 43 learner screens, all 17 exercise families, five widths and applicable state/input cells. |
| RSP-002 | IN_PROGRESS | Objective reflow/overflow/touch evidence is broad; “deliberate first-class composition” across the whole product remains visual judgment. |
| RSP-003 | IN_PROGRESS | Automated routes retain controls and named actions on phones; whole-product desktop/mobile capability equivalence still requires human review. |
| RSP-004 | PASSED | All six named recompositions have 390/320 source and browser evidence, including new Skill Map touch and Inbox-flow assertions. |
| A11Y-001 | PASSED | Native keyboard input completes session start, exercise open/submit and representative Labs with visible focus. Physical Safari/AT is not claimed. |

## Checkpoints

### C1 — whole-product AI Off

`scripts/review/ai-off-suite.mjs` runs real browser paths for Command Center/session, Academy,
Skill Map/mastery, CRM, Workflow/Inbox, Funnel, Calendar, Reporting, Pricing, Negotiation,
Portfolio and offline recovery. `REVIEW_AI_OFF=1` repeatedly holds the actual IndexedDB setting at
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

The audit parses TS/TSX strings, YAML and MDX across every configured learner-facing surface. It
validates IDs, official names, stale aliases, singular drift and branded feature-like phrases while
explicitly classifying native configuration terms, Bloomlab teaching terms, generic/instance nouns
and historical references. It found one concrete defect: standard **Webhook** and the current,
distinct **Custom Webhook** action had been conflated. The registry/content/runtime now distinguish
them. This verifies naming coverage only, never native behavioral parity or a real GHL account.

### C7 — design, responsive and objective accessibility

The screen inventory is derived from `APP_ROUTES` and the compiled content bundle instead of a
hand-picked screenshot list. It instantiates every learner route, dynamic detail route, a minimal
Academy set covering every embed component, all 17 exercise types and an explicit not-found state;
five developer-only routes are listed separately.

The deployed polish sweep records 215 default-layout cells at 1440/1024/768/390/320, density
metrics, touch target/input size, overflow, prohibited §70 rendered signals and reduced-motion
animation state. The state matrix joins those to route-specific probes or explicitly labeled shared
loading/error contracts and genuine N/A reasons. Every row retains `human_visual_review: REQUIRED`.

Specialized 390/320 evidence covers Workflow's vertical editor/sheets, CRM's stage
switcher/scroller/non-drag picker, Academy's editorial flow, Call Room's retained voice/recovery
controls, Inbox's list→single-conversation composer and Skill Map's semantic territory-first touch
selection. The native keyboard probe covers start-session → open exercise → submit → representative
Labs using Tab/Shift+Tab/Enter/Space/arrows and visible focus. Axe is corroborating evidence with an
unnamed-control negative control, not a physical-device or assistive-technology certificate.

Navigation and sidebar-resize probes run only as inherited regression coverage. No sidebar design
work or DES-009 status change occurred.

### C8 — reconciliation and immutable verification

Ten objective rows are promoted: PRD-004, PRD-009, EXR-006, DATA-006, INF-011, GHL-005, GHL-010,
DES-018, RSP-004 and A11Y-001. Eight targets remain non-PASSED with the exact boundaries in the
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

## Failed attempts retained

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
- The first local browser launch lacked shared libraries. Temporary local runtime libraries allowed
  focused reproduction of the three failures, but those diagnostic runs are not browser/a11y
  evidence; the GitHub Ubuntu Chrome run remains canonical.
- `vitest --project simulator-core` named a project that is not configured. The corrected direct
  simulator invocation passed 39/39; the invalid filter remains disclosed.
- A targeted runner command initially named two nonexistent test files and executed zero tests.
  The corrected files passed 40/40; the zero-test command is not evidence.
- One local full-suite run shared the host with concurrent TypeScript and ESLint processes and
  timed out two unrelated async UI assertions. The two files passed 45/45 immediately when rerun
  alone; only the sequential exact-head CI result is canonical.
- Targeted C7 lint found an undefined `assert` in the new Inbox probe and was fixed before commit.
  Full lint then exposed the C3 `context` dependency warning; a stable `useMemo` context removed it,
  with runner regressions rerun.

Intermediate local focused results are supporting evidence only: C4 Worker coverage passed 226
tests; C6 web coverage passed 21/21 and simulator coverage 39/39; C7 screen/Lab coverage passed
46/46 and corrected runner coverage 40/40. Final totals and immutable identities come only from the
final CI/Preview attestation.

Stop for independent ChatGPT audit. Do not merge.
