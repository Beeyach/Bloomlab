# Field-Ready v1 engineering acceptance follow-up

> **Published outcome, rechecked 2026-10-12:** This investigation and the approved
> visual fixes are now included in `18f112f8710766462a18256d72bba5034410973b`.
> Exact-head [CI 38096748142](https://github.com/Beeyach/Bloomlab/actions/runs/38096748142)
> passed Checks and Preview; Production was skipped. The automated state-cell
> gap is closed, with 43 human visual rows still required. The baseline and local
> verification narratives below retain their historical source binding. See the
> [publication record](field-ready-v1-preview-publication.md) for current evidence
> and unchanged release boundaries.

Date: 2026-10-10. Baseline: `6b0226eb35d83b96f442b26c97495385b43de33c`.

## Published evidence and ledger

Exact-head [CI 38071166013](https://github.com/Beeyach/Bloomlab/actions/runs/38071166013), attempt 1, passed Checks and Preview; Production was skipped. Preview Worker version: `b75296b9-0f63-4d83-a91d-c7236e2734a6`. Its immutable source is the baseline above. Historical failed/pending narratives are source snapshots; the published passing run supersedes those narratives for this head without explaining the historical failures.

The registered requirements remain **313: 284 PASSED, 8 IN_PROGRESS, 5 PARTIAL, 12 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 2 NOT_STARTED; 24 open P0/P1 rows**. This follow-up makes no requirement promotions. All 43 human visual rows and all twelve human/real-GHL rows remain required. DES-018 remains IN_PROGRESS.

## Confirmed runtime blocker

The wildcard NotFound route was outside `ScreenErrorBoundary`. A controlled render exception removed the navigation shell. Wrapping that route in the same boundary preserves the shell, plain-language recovery, retry and navigation to another screen. Two App composition tests failed before the fix and pass afterward; the real built-UI fault injection confirms containment and navigation recovery. Existing route composition and boundary tests also pass.

## Sync timing result

The original sync engine and unchanged `requestSync` gate were exercised through the native built UI and a localhost-only acknowledgement API. The baseline completed in 187ms. A manual request behind two six-second pulls missed the gate at 11057ms but completed at 11819ms. A delayed push followed by two four-second pulls missed it at 11093ms but completed at 13809ms. All final queue, held-lock and pending-lock counts were zero; completion callbacks were observed. External requests: zero.

This distinguishes delayed completion from permanent callback loss in those controlled cases. An active older pull must still be followed by the manual fresh roundtrip so newer local edits are included. No scheduler deduplication, preparatory C5 wait, raised deadline or weaker assertion is justified. The original historical timing/cancellation cause remains unproved, and slow protocol/environmental responses can still fail the timing gate.

## Exact evidence contract

The new collector uses actual router-derived module identities and exact paths/build markers. It holds/rejects real route imports, injects one guarded unknown-route render fault, executes a named native keyboard/touch action on every screen, and checks explicitly scoped empty/result fixtures. The joiner rejects wrong-head/path/state evidence, failed assertions, synthetic input and duplicate attribution. It verifies physical screenshot digests, including the original-screen image captured before native activation. GitHub Checks runs the negative-control tests, and Preview runs the complete collector before joining the matrix.

Keyboard evidence means native Tab reachability, visible focus, trusted activation and the named result. Touch evidence means a trusted tap and its named result at 390px with a coarse pointer; buttons require 44px. Inline-link target sizes are explicitly not certified. Pre-action screenshots capture the actual viewport, with hit testing after capture; full-page capture cannot alter tap coordinates.

Empty exercise fixtures contain no submitted attempt or skill evidence. Completed exercise fixtures are explicit failed legacy attempts with `grade:null`; they verify saved-result compatibility, not fresh grading or mastery. Completed graph/project fixtures reuse the audited synthetic presentation seed, never real-GHL proof. Other named results exercise actual local training actions; the conversation fixture is inbound simulation, with no mail/SMS. Sync linking uses an explicit local acknowledgement and cannot certify Worker integration or recovery backups.

The authored incident directory has no runtime empty/result lifecycle: two exact, reviewed N/A cells cite its source and current case inventory. The separate incident-case screen verifies actual empty logs and recorded runtime results. All five pre-existing Academy/NotFound lifecycle exceptions remain explicit. These narrow scopes do not certify every error, action, semantic judgment or provider workflow.

Request handlers drain before document changes and the final result gate. Screen reads wait for the matching document loader/frame. Only exact, independently observed same-origin script/stylesheet cancellations can be classified separately from interception failures, before teardown starts. API, external, wrong-identity or unconfirmed failures remain fatal. The earlier 253-cell run with 43 interception failures remains FAILED; later code cannot retroactively validate it.

## Verification boundary

Local Node 22.23.3: the fresh combined engineering/visual source **passed 2205 tests / 181 files** with two workers in 246.84 seconds. Earlier wall-clock timeouts and a superseded Home design assertion remain in retained failure logs; no deadlines were raised. Typecheck, lint, format, source privacy/security, docs/status/content validation, terminology/freshness, screen inventory, offline voice manifest, all 15 adversarial cases and all 50 evidence negative controls passed. Both local Production-mode and Preview-mode compilations and browser-secret checks passed. Compilation did not deploy Production.

The frozen combined engineering/visual source uses local marker `worktree-code-4c8fc3baa49165a88818ea79ba6f682ef66eb2ff`. Its full exact collector passed 253 cells: 251 observed browser cells and two reviewed incident-directory N/A cells, plus the five pre-existing lifecycle exceptions. Native keyboard and touch actions are proved on all 43 screens. Interception, teardown, confirmed-cancellation and external-request counts are zero. All four requested real browser-zoom combinations and 215 five-width polish cases passed. Accessibility passed 89 scans with zero reported violations; 175 incomplete-node occurrences in 23 scans still require manual review. Independent whole-delta and bounded follow-up source reviews found no remaining confirmed Critical or Important issue.

The marker is a working-tree identity, not a published Git SHA. New-source exact-head CI/Preview remains required. The baseline CI above must not be attributed to new code; local acknowledgements cannot replace deployed Worker/recovery acceptance. The detailed final report and evidence join record physical screenshot validation and the remaining feature checks.

## Remaining release work

Human visual hierarchy, responsive equivalence, long-session comfort and real-device/screen-reader/microphone acceptance remain open, as do the twelve real-GHL/privacy/provider rows. Bounded terminology is not exhaustive contextual language acceptance. Historical cancellation/timing causality, recovery-bucket automatic retention verification and dependency-advisory disposition remain separate operational gaps. Preserve all stacked bases, draft status, public repository visibility and Production-skipped boundaries.
