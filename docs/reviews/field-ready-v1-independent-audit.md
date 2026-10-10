# Bloomlab Field-Ready v1 independent audit

> **Current published evidence (2026-10-10):** Exact-head CI [38071166013](https://github.com/Beeyach/Bloomlab/actions/runs/38071166013) passed Checks and Preview at `6b0226eb35d83b96f442b26c97495385b43de33c`; Production was skipped. Worker version: `b75296b9-0f63-4d83-a91d-c7236e2734a6`. Older failed/pending narratives below are preserved source snapshots, superseded for this published head. Their historical timing/cancellation causes are not retroactively resolved. Requirement statuses remain unchanged. The subsequent local engineering investigation is recorded in `field-ready-v1-engineering-acceptance.md` and requires its own exact-head Preview run before new-source remote verification.

Date: 2026-10-10. Disposition: independent audit finished; published corrections pass Checks, but exact-head Preview fails sync recovery. Field-Ready v1 is not complete.
This report does not declare Field-Ready Complete or completion of the remaining C7 automation.

## Post-publication contrast finding

The first three reviewed commits were published with explicit push/Preview approval at
`1311e4cf74381f3cf6b46f37f4fa1e9822dff776`. Its Checks job passes 2,174 tests / 175 files;
Preview acceptance subsequently FAILED at sync recovery; the superseding execution evidence below retains that result. Production is skipped.

Independent review of the fresh accessibility archive resolved eight inherited Workflow Idle
1:1 incomplete observations into a confirmed visible defect: light node cards inherited white
semantic text roles from their dark InkSurface. All six status labels use the same affected role.
The scoped correction restores dark text and soft-text roles on WorkflowNode only. A new
stylesheet regression fails on the old source and passes after the correction. Independent
real built Workflow render checks at 1440, 390 and 320 px plus clearly labeled six-state CSS
fixtures measure 17.78:1 text contrast; the surrounding ink role remains white.

The contrast-only local suite passed **2,175 tests / 175 files** with two workers. An earlier
parallel-check run retained two existing content-test timeout failures; no assertion failed,
and no test deadline was increased. Typecheck, lint, formatting and build pass.

Separate inherited P2: the original `SC-glowhaus-no-show` starter placed its first node 120 px
below a 141.78 px trigger card, partly covering the trigger status on desktop. This is authored
curriculum layout, also used by the booking-confirmation exercise and Workflow Foundations.
Mobile does not overlap. Saved learner coordinates are intentionally preserved; no existing
workflow was silently repositioned. The approved source correction spaces the new starter at
150/300/450 px with a content version/lock update. Seed-data and further push approval
were required by the user's working agreement and have now been granted. The approved spacing
is applied with version `2026.10.10.1` and a regenerated content lock. Regressions prove new
starter row spacing and preservation of nonstandard saved coordinates across actual save/load;
the spacing regression fails on the old starter. Saved workflow definitions are not migrated.

The approved follow-up also adds bounded push/pull timing diagnostics and failure-time busy,
outbox and lock counts. Only two known transport paths, numbers and booleans enter the timing
report; payloads, headers, URL queries/fragments and lock names are excluded. Failure-only
database/lock inspection is capped at one second, with a stalled-read regression. No C5 assertion,
sync deadline or preparatory wait changes. Independent security re-review cleared this delta.

The frozen approved follow-up at `91309dd5ddb0a544e2d151648477bdb717576e7e`
passes **2,178 tests / 175 files** with two workers and unchanged deadlines. Typecheck,
lint, formatting, both requirement validators, source privacy, content/lock, terminology,
screen inventory, freshness, voice and all 15 adversarial cases pass. Its production build
passes the browser-secret gate. A bounded scan of 3,298 unique reachable source blobs
finds no recognized secret patterns; this does not certify deleted history or images.

Independent built UI checks at 1440/390/320 px show zero card overlap, contained status
pills and no horizontal document overflow; all twelve measured Idle labels are 17.78:1.
The desktop trigger-to-first-card gap is 8.22 px and both mobile gaps are 8 px.
Native click, Right, Down and Save move the first node to (16,166), persist version 2
and preserve identical coordinates and rendered transform after reload. Other nodes stay
at (0,300)/(0,450). The isolated browser attempts zero external requests. The refreshed
local axe gate passes 89 scans with zero reported violations, negative control detected
and 176 explicitly incomplete node occurrences.

## Published-head execution evidence

- Published head at this snapshot: `1311e4cf74381f3cf6b46f37f4fa1e9822dff776`. Contrast correction commit: `21e90b45b346e92374d3de783d3e38d8111fd858`; approved starter/timing follow-up is included in this source.
- [CI run 38063758423](https://github.com/Beeyach/Bloomlab/actions/runs/38063758423), attempt 1: **Checks PASSED; Preview FAILED; Production SKIPPED**.
- Preview Worker version: `e1e20276-fbd7-4a21-853c-e3ff785b567a`.
- Fresh CI: **2,174 tests / 175 files**, 15 adversarial cases, 89 axe scans; zero reported axe violations and negative control detected.
- Browser suite 35/35, AI-Off 16/16 plus expected negative control, binary recovery 5/5, terminology and screen-state generation pass. Failure-isolation fails; only Call/Workflow/AI rows finish before sync-push recovery times out. **Do not report 5/5 held modes for this CI.**
- Failure occurs at failure-isolation-probe.mjs:334 after clearing the injected push failure and navigating to /system. Real mouse events are delivered, but manual completion remains 0 at the unchanged gate. The safe failure context has structural count 1 and no raw body text; browserErrors is empty.
- Browser/Worker identities before and after equal published 1311e4c. Controlled fixtures; real GHL and paid providers stay excluded.
- A separate instrumented live C5 passes 5/5 at the same source with unchanged assertions/gates. Recovery of 13 operations takes push 4.638s, pull 1.810s and following pull 0.680s; native disabledfalse/completed0 coexists with aria-busytrue. A separate local two-pull 6s mock reproduces the failed signature and later completes. These establish timing sensitivity, **not the failedCI root cause**. No justified product patch, timeout increase or preparatory wait follows from them.
- Fresh cloud configuration: both media buckets private (r2.dev disabled, no custom domains). Recovery-stage lifecycle remains unverified.
- Published axe incompletes: 56 scans/184 node occurrences, including eight confirmed hidden white Workflow labels. Local 21e90b4 corrects those; its refreshed scans retain 176 incompletes and zero equal 1:1 nodes. Full contrast acceptance remains open.
- Fresh archive text scan: 103 files; zero formatted/canonical private sync-key candidates or recognized credential candidates. Bounded text patterns do not certify every image or historical artifact.
- All three freshly downloaded ZIP digests match GitHub metadata:

| Artifact | ID | SHA-256 |
| --- | --- | --- |
| preview | 11675298417 | `7bc2d697d868cdc5b2f1b8e6ac256a5b3e704a581d3c8ad81fe266af3f606b34` |
| adversarial | 11674700307 | `55683146d57a459779172e9b513b907b3819199e693ac724452866444e8de1e5` |
| accessibility | 11674014739 | `0d24f2c7fe42656e4733920538224218ee32cbb33067ddc3e70f11922327f153` |

The repository audit is the preserved snapshot at its committed source. This deliverable and the JSON manifest supersede its pending-CI execution narrative without changing the verified source SHA.

## Immutable sources and preserved stack

- Repository: `Beeyach/Bloomlab`, verified PUBLIC; visibility was not changed.
- Main: `59ec678910cb51559d84af3c4200590f9c7e29ec` (Phase 21).
- PR #32: draft, base `codex/navigation-shell-redesign` at
  `6a1ea64081e42a0dd6ea7efd3b78c0ee4abbd685`; audited original head
  `aa5a04764a234666243e96adcd422c0ae5f616ed`; published head
  `1311e4cf74381f3cf6b46f37f4fa1e9822dff776`.
- PRs #24–#32 retain their nine original stacked bases, remain draft and unmerged.
  Older open PR #17 is outside this stack and was not altered.
- Isolated local branch: `audit/field-ready-v1-independent-closeout`.
- Correction commit: `e679321629e55a42cba7bfe2609909362b432fb9`.
- Routing-policy integration: `05d409c74962035b0c149f91349b378108944bc4`, a clean published
  cherry-pick of `5c205fa67d5f86ed2bc23767351461ec81e14bef`; the original policy branch is unchanged.
- The original Windows checkout was unavailable; WSL mounting returned access denied.
  A separate clone/linked worktree was used. No original worktree or unrelated edits were changed.

## Confirmed findings and corrections

| Finding | Actual trigger and evidence | Correction |
| --- | --- | --- |
| Attachment upload/delete race | Delete completes while R2 put is pending; the old finalizer ignores zero updated rows and returns success with tombstoned metadata but retained bytes. The real local Worker regression fails on original source. | Check conditional finalization, remove late bytes when deletion wins, return a retryable conflict. |
| Failed compensation cannot be retried | If deleting late bytes fails once, old DELETE returns success immediately for deleted metadata and leaves the object behind. A second regression reproduces the retained object. | Repeat idempotent R2 deletion even for tombstoned metadata. |
| Unicode filename header | Upload accepts Unicode but download places it directly in `filename`. Actual workerd returned 200 with a malformed header; Node's 503 reproduction is not deployed evidence. | ASCII fallback plus RFC 5987 UTF-8 `filename*`, preserving original filename and bytes. |
| Public failure-report privacy | C5 link failure can retain the key panel; raw body text enters public JSON/logs before screenshot masking. Independent real Chromium reproduction exposes a synthetic private marker on old source. | Omit body text entirely; retain structural count and origin/path without query/fragment. Source-extracted regression and independent Chromium red/green verify the fix. |
| Windows adversarial evidence matching | Vitest reports forward slashes but native resolved paths contain backslashes. All regressions succeed, yet the old harness reports 0/15 as missing. | Normalize separators while preserving exact absolute file identity, unique test matching and all gates. Actual harness changes from 0/15 to 15/15; new Windows/POSIX regression also passes. |
| Workflow status contrast | Light node cards inherit white semantic text from the ink workspace; eight actual Idle measurements were 1:1 and all six status labels share the affected role. | Restore dark semantic text roles at the node boundary; regression and built UI at 1440/390/320 verify 17.78:1. |
| New starter card overlap | The Glowhaus trigger is 141.78 px high but the next authored card starts only 120 px below it, covering part of its status on desktop. | Use existing editor row spacing at 150/300/450 for this new starter only; version/lock update and saved-coordinate persistence regression. |

Two fresh Astra High reviewers independently examined material recovery/attachment/sync and
evidence/privacy changes. Re-review found the cleanup retry edge, which was fixed and retested.
Final scoped re-reviews report no remaining actionable finding in the correction diff.
This is a material-delta audit of the 141-file PR, not a claim of exhaustive human review of every screen.

## Verification and exact-head limits

Node 22.23.3/npm 10.9.9 were used locally with existing locked dependencies; no new dependency
was added. An initial Node 22.22.0 install exposed jsdom's newer minimum 22.22.2; verification
uses the supported 22.23.3 runtime. No acceptance assertion or timeout was weakened.

- Workspace typecheck, lint and formatting pass.
- Initial frozen correction suite: **2,174 tests / 175 files**, zero failures, including five new
  regression cases. The later scoped contrast correction adds one regression: **2,175 / 175**
  pass with two workers and unchanged deadlines; its evidence is separate from published CI.
- Focused attachment/privacy suite: 8 tests / 3 files pass; reviewer independently passes
  attachment/path tests, 7 tests / 2 files.
- Adversarial gate: all 15 cases pass after path correction; the initial failed harness result
  is retained as failed evidence, despite its successful underlying tests.
- Built local Chromium accessibility: 89 scans, zero serious/critical findings, negative control
  detected. Gradient color-contrast incomplete checks remain explicit.
- Content check, bounded terminology, screen inventory, freshness, voice manifest, build/browser
  secret scan, source scan and both status validators pass. Existing 35 content coverage warnings
  and large-chunk build warning remain.
- New-source deployed Checks PASSED and Preview FAILED in run 38063758423 at the published head.
  No Production deployment, merge, real-GHL activity or paid provider use occurred.

The original audited source has independently checked [CI run 34682953401](https://github.com/Beeyach/Bloomlab/actions/runs/34682953401),
attempt 1: Checks and Preview PASSED, Production SKIPPED. It records 2,169 tests / 173 files,
15 adversarial cases, 89 axe scans, 35 browser probes, 16 AI-Off groups plus the dependency
negative control, five binary-recovery checks and five held failure modes. Browser/Worker identities
before and after equal `aa5a04764a234666243e96adcd422c0ae5f616ed`.
Worker version: `04d0f314-a96f-42cb-957e-8abc6dcc7415`. The pre-publication read-only Preview health check
matched that source; current published identity is separately verified above. The migration log is Preview-only and reports no new pending migration.

All three downloaded ZIP SHA-256 values match GitHub metadata:

| Artifact | ID | SHA-256 |
| --- | --- | --- |
| Adversarial | 10295115632 | `be7556b157b22dff1cf4f946cef5246fb52c2045980b04fcbc16c340d21d02cc` |
| Accessibility | 10295210501 | `e813f608d635b978ed42cb5d101e3dda05c0ac72e1456a0667ab897d5f210136` |
| Preview, 186,137,397 bytes | 10295048917 | `b60d769c91a744ae25a7a2650fbbe53df9647071f9f3d1df373930d7dc2c08cb` |

The historical passing run supersedes earlier pending-CI narratives for its original source only.
It does not supersede the fresh failure at published 1311e4c or certify local 21e90b4.
Historical failures, the supplemental C5 timing failure and unexplained navigation cancellation
remain evidence, rather than being relabeled fixed by a later pass.

## Privacy and operational exposure

- Current source scan and all 3,291 unique reachable blobs across fetched public refs contain
  no recognized credential literals or secret files. This is a bounded pattern scan, not proof
  that all possible credentials or unreachable historical data are absent.
- Sixteen historical failed closeout logs were fetched and checked without printing values;
  no formatted sync-key match was found. Independent inspection of all 100 originally extracted
  JSON/log files found zero formatted/canonical sync-key candidates and zero recognized credential
  patterns. No matching values were printed.
- The current sync-key PNG visually hides key text; desktop and 320 px Workflow captures were
  inspected. This sample does not satisfy all 43 human visual reviews or prove every historic image safe.
- Earlier deletion/backup of thirteen sensitive artifacts is historical documentation. The former
  private backup, all historical screenshots and owner authorization were not independently available
  here; do not treat that narrative as a newly verified comprehensive exposure cleanup.
- Local cloud credentials were unavailable, but fresh exact-head CI independently verifies both
  media buckets with r2.dev disabled and no custom domains through read-only configuration. No learner
  objects were accessed. Recovery-stage lifecycle remains unverified.
- Recovery-stage expiry prevents confirmation but does not prove staged-byte deletion. No source
  cleanup/lifecycle is configured; actual cloud lifecycle remains unverified. No speculative cloud
  retention policy or remote learner-data cleanup was applied.
- Current dependency audit reports 10 advisories (5 high, 4 moderate, 1 low); omit-dev leaves
  source-map-js 1.2.1 with GHSA-68fv-2mgg-jv7q. It is reached via build/test tooling, and no deployed
  attacker-controlled source-map ingestion was demonstrated. Dependencies were not silently upgraded.

## Verified ledger and remaining release blockers

The matrix is unchanged: **313 registered; 284 PASSED; 8 IN_PROGRESS; 5 PARTIAL;
12 IMPLEMENTED_UNVERIFIED; 2 DEFERRED; 2 NOT_STARTED. 24 P0/P1 rows remain open.**
The seven existing promotions remain PRD-004, PRD-009, EXR-006, DATA-006, INF-011,
RSP-004 and A11Y-001. These are unchanged registered statuses, not new promotions. Fresh C5 sync recovery remains a
blocking failed gate; original and standalone evidence cannot certify the failed CI as passing.

- PARTIAL: EXR-008, PRI-002, NEG-003, GHL-005, GHL-010.
- IN_PROGRESS targets: DES-006, DES-008, DES-017, DES-018, RSP-002, RSP-003;
  inherited DES-009 is also unchanged IN_PROGRESS.
- Strictly parked IMPLEMENTED_UNVERIFIED: PRD-005, CUR-015, CUR-031, EXR-015, EXR-020,
  CALL-002, CALL-005, CALL-006, FLD-001, VOI-006, VOI-007, SEC-005.

**Automated/operational work still required:** resolve/diagnose the fresh failed exact-head sync
recovery gate; publish and remotely verify the approved follow-up; the 216 exact
screen/state/input cells (40 empty, 11 loading, 37 error, 42 completed/result, 43 keyboard,
43 touch); exhaustive/contextual terminology evidence; supplemental 44-operation sync timing
and historical cancellation diagnosis if reproducible; cloud retention verification
and dependency-advisory disposition. Current media bucket privacy is verified by fresh CI. Existing exact assertion mapping, controlled fixtures,
missing native-input runs and justified N/A can close cells; family references alone cannot.
The historical C5 passing gate proves held failures and preserved unrelated-route readiness/sentinels,
not every unrelated completed operation. The earlier expanded supplement reports 12.1-second response
and 15.6-second recovery against an unchanged 10-second gate; its private raw trace was unavailable
here, and this failed timing evidence is not replaced by the latest bounded pass.

**Human/provider work still required:** 43 subjective visual reviews, whole-product hierarchy,
density/material/long-session and deliberate responsive/capability-equivalence acceptance;
broad semantic/reasoning/language-quality evidence; real-device, screen-reader, microphone,
privacy and real-GHL acceptance for the twelve parked rows. No synthetic result substitutes for these.

The first three commits are published to existing draft PR #32, and their failed Preview evidence is preserved. The user has explicitly approved contrast `21e90b4`, the starter-spacing correction, a fast-forward and Preview-only CI. The follow-up also records bounded push/pull timing/status and failure-time busy/queue/lock counts, without payloads, headers, private URL values or any gate change. These diagnostics identify timing evidence; they are not a claimed root-cause correction. Follow-up publication and exact-head verification remain pending at this committed snapshot. Human/provider and objective-state evidence gaps remain separate release blockers.

## Later engineering and visual follow-up

The subsequent published baseline is `6b0226eb35d83b96f442b26c97495385b43de33c`, verified by passing Checks/Preview in CI `38071166013`, Production skipped. This supersedes the historical pending-publication narrative for that baseline only. The additional local unknown-route fix, exact-state collector and user-directed visual corrections are documented in [field-ready-v1-engineering-acceptance.md](field-ready-v1-engineering-acceptance.md) and [field-ready-v1-visual-fix-round.md](field-ready-v1-visual-fix-round.md). Their local runtime evidence, retained test timeouts and new-source publication boundary must not be attributed to the older CI. No requirement status or stacked base changed.
