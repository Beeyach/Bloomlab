# Bloomlab Field-Ready v1 independent audit

Date: 2026-10-10. Disposition: corrections verified locally; release acceptance remains open.
This report does not declare Field-Ready Complete or completion of the remaining C7 automation.

## Post-publication contrast finding

The first three reviewed commits were published with explicit push/Preview approval at
`1311e4cf74381f3cf6b46f37f4fa1e9822dff776`. Its Checks job passes 2,174 tests / 175 files;
Preview acceptance is still running at this snapshot. Production is skipped.

Independent review of the fresh accessibility archive resolved eight inherited Workflow Idle
1:1 incomplete observations into a confirmed visible defect: light node cards inherited white
semantic text roles from their dark InkSurface. All six status labels use the same affected role.
The scoped correction restores dark text and soft-text roles on WorkflowNode only. A new
stylesheet regression fails on the old source and passes after the correction. Independent
real built Workflow render checks at 1440, 390 and 320 px plus clearly labeled six-state CSS
fixtures measure 17.78:1 text contrast; the surrounding ink role remains white.

The final local full suite passes **2,175 tests / 175 files** with two workers. An earlier
parallel-check run retained two existing content-test timeout failures; no assertion failed,
and no test deadline was increased. Typecheck, lint, formatting and build pass.

Separate inherited P2: the default `SC-glowhaus-no-show` starter places its first node 120 px
below a 141.78 px trigger card, partly covering the trigger status on desktop. This is authored
curriculum layout, also used by the booking-confirmation exercise and Workflow Foundations.
Mobile does not overlap. Saved learner coordinates are intentionally preserved; no existing
workflow was silently repositioned. A candidate source correction spaces the new starter at
150/300/450 px with a content version/lock update. Seed-data and further push approval are
required by the user's working agreement before applying/publishing that candidate.

## Immutable sources and preserved stack

- Repository: `Beeyach/Bloomlab`, verified PUBLIC; visibility was not changed.
- Main: `59ec678910cb51559d84af3c4200590f9c7e29ec` (Phase 21).
- PR #32: draft, base `codex/navigation-shell-redesign` at
  `6a1ea64081e42a0dd6ea7efd3b78c0ee4abbd685`; remote head
  `aa5a04764a234666243e96adcd422c0ae5f616ed`.
- PRs #24–#32 retain their nine original stacked bases, remain draft and unmerged.
  Older open PR #17 is outside this stack and was not altered.
- Isolated local branch: `audit/field-ready-v1-independent-closeout`.
- Correction commit: `e679321629e55a42cba7bfe2609909362b432fb9`.
- Routing-policy integration: `05d409c74962035b0c149f91349b378108944bc4`, a clean local
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

Two fresh Astra High reviewers independently examined material recovery/attachment/sync and
evidence/privacy changes. Re-review found the cleanup retry edge, which was fixed and retested.
Final scoped re-reviews report no remaining actionable finding in the correction diff.
This is a material-delta audit of the 141-file PR, not a claim of exhaustive human review of every screen.

## Verification and exact-head limits

Node 22.23.3/npm 10.9.9 were used locally with existing locked dependencies; no new dependency
was added. An initial Node 22.22.0 install exposed jsdom's newer minimum 22.22.2; verification
uses the supported 22.23.3 runtime. No acceptance assertion or timeout was weakened.

- Workspace typecheck, lint and formatting pass.
- Frozen full local test run: **2,174 tests / 175 files**, zero failures, including all five
  new regression cases. No runtime/source edits occurred during this final run.
- Focused attachment/privacy suite: 8 tests / 3 files pass; reviewer independently passes
  attachment/path tests, 7 tests / 2 files.
- Adversarial gate: all 15 cases pass after path correction; the initial failed harness result
  is retained as failed evidence, despite its successful underlying tests.
- Built local Chromium accessibility: 89 scans, zero serious/critical findings, negative control
  detected. Gradient color-contrast incomplete checks remain explicit.
- Content check, bounded terminology, screen inventory, freshness, voice manifest, build/browser
  secret scan, source scan and both status validators pass. Existing 35 content coverage warnings
  and large-chunk build warning remain.
- New-source deployed CI/Preview is pending publication authorization. Old artifacts cannot certify
  these corrections. No Production deployment, merge, live GHL activity or provider spend occurred.

The existing remote source has independently checked [CI run 34682953401](https://github.com/Beeyach/Bloomlab/actions/runs/34682953401),
attempt 1: Checks and Preview PASSED, Production SKIPPED. It records 2,169 tests / 173 files,
15 adversarial cases, 89 axe scans, 35 browser probes, 16 AI-Off groups plus the dependency
negative control, five binary-recovery checks and five held failure modes. Browser/Worker identities
before and after equal `aa5a04764a234666243e96adcd422c0ae5f616ed`.
Worker version: `04d0f314-a96f-42cb-957e-8abc6dcc7415`. A fresh read-only Preview health check
also matches that source. The migration log is Preview-only and reports no new pending migration.

All three downloaded ZIP SHA-256 values match GitHub metadata:

| Artifact | ID | SHA-256 |
| --- | --- | --- |
| Adversarial | 10295115632 | `be7556b157b22dff1cf4f946cef5246fb52c2045980b04fcbc16c340d21d02cc` |
| Accessibility | 10295210501 | `e813f608d635b978ed42cb5d101e3dda05c0ac72e1456a0667ab897d5f210136` |
| Preview, 186,137,397 bytes | 10295048917 | `b60d769c91a744ae25a7a2650fbbe53df9647071f9f3d1df373930d7dc2c08cb` |

The latest passing run supersedes the earlier pending-CI narratives for its exact source only.
Historical failures, the supplemental C5 timing failure and unexplained navigation cancellation
remain evidence, rather than being relabeled fixed by a later pass.

## Privacy and operational exposure

- Current source scan and all 3,277 unique reachable blobs across fetched public refs contain
  no recognized credential literals or secret files. This is a bounded pattern scan, not proof
  that all possible credentials or unreachable historical data are absent.
- Sixteen historical failed closeout logs were fetched and checked without printing values;
  no formatted sync-key match was found. Independent inspection of all 100 current extracted
  JSON/log files found zero formatted/canonical sync-key candidates and zero recognized credential
  patterns. No matching values were printed.
- The current sync-key PNG visually hides key text; desktop and 320 px Workflow captures were
  inspected. This sample does not satisfy all 43 human visual reviews or prove every historic image safe.
- Earlier deletion/backup of thirteen sensitive artifacts is historical documentation. The former
  private backup, all historical screenshots and owner authorization were not independently available
  here; do not treat that narrative as a newly verified comprehensive exposure cleanup.
- Cloud privacy configuration could not be refreshed locally: configuration credentials are unavailable.
  Existing exact-head CI records both media buckets with r2.dev disabled and no custom domains.
  Current bucket privacy and recovery-stage lifecycle need an authorized read-only configuration check.
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
RSP-004 and A11Y-001. Their retention does not turn new correction code into deployed evidence.

- PARTIAL: EXR-008, PRI-002, NEG-003, GHL-005, GHL-010.
- IN_PROGRESS targets: DES-006, DES-008, DES-017, DES-018, RSP-002, RSP-003;
  inherited DES-009 is also unchanged IN_PROGRESS.
- Strictly parked IMPLEMENTED_UNVERIFIED: PRD-005, CUR-015, CUR-031, EXR-015, EXR-020,
  CALL-002, CALL-005, CALL-006, FLD-001, VOI-006, VOI-007, SEC-005.

**Automated/operational work still required:** new exact-head CI/Preview; the 216 exact
screen/state/input cells (40 empty, 11 loading, 37 error, 42 completed/result, 43 keyboard,
43 touch); exhaustive/contextual terminology evidence; supplemental 44-operation sync timing
and historical cancellation diagnosis if reproducible; current cloud privacy/retention verification
and dependency-advisory disposition. Existing exact assertion mapping, controlled fixtures,
missing native-input runs and justified N/A can close cells; family references alone cannot.
The C5 passing gate currently proves held failures and preserved unrelated-route readiness/sentinels,
not every unrelated completed operation. The earlier expanded supplement reports 12.1-second response
and 15.6-second recovery against an unchanged 10-second gate; its private raw trace was unavailable
here, and this failed timing evidence is not replaced by the latest bounded pass.

**Human/provider work still required:** 43 subjective visual reviews, whole-product hierarchy,
density/material/long-session and deliberate responsive/capability-equivalence acceptance;
broad semantic/reasoning/language-quality evidence; real-device, screen-reader, microphone,
privacy and real-GHL acceptance for the twelve parked rows. No synthetic result substitutes for these.

Next authorized publication step is a fast-forward of the reviewed commits to the existing PR #32
head, preserving its base and draft state, followed by the existing exact-head Preview CI. Production
remains excluded. The user's global agreement explicitly requires asking before `git push` or public
posting. Until that approval and the resulting run, remote closeout is incomplete.
