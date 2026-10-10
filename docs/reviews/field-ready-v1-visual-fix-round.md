# Field-Ready v1 visual fix round and engineering audit

Date: 2026-10-10. Published baseline: `6b0226eb35d83b96f442b26c97495385b43de33c`.
Local source marker: `worktree-code-4c8fc3baa49165a88818ea79ba6f682ef66eb2ff`.

The local marker binds the baseline Git commit to the physical SHA-256 bytes of 128 changed non-Markdown source/config files. It is not a Git SHA or deployed Preview identity. Audit prose is recorded separately. The published baseline's passing CI cannot be attributed to these subsequent changes.

## Numbered user specification

1. **DONE:** Sidebar items are 56px with 20px icons, 4px gaps and 11.5px labels. All 15 learner destinations, plus the two Preview developer destinations, are reachable in the rail's scroll area. This follows the user's explicit clarification; fifteen 56px items cannot all fit without scrolling at 810px.
2. **DONE:** Territory surfaces fill their buttons through the actual intermediate content wrapper. Footer progress aligns at the bottom. Description text uses the requested dark color, 500 weight and white scrim; singular counts use “capability.”
3. **DONE:** Seven chronological days occupy one scrollable row. Slots separate time/name with an 8px gap, constrain text and preserve wrapped status. Configuration tabs stay in one horizontally scrollable row. Seven days follows the explicit full-week option rather than forcing a four-column week.
4. **DONE:** Automatic Workflow placement measures the preceding card and leaves 28px gaps, with 2px connectors and centered dots. Existing custom coordinates remain intact. Moving an automatic layout is one undoable edit. Starts uses native date/time with the account's IANA zone; skipped daylight-saving times are refused and existing repeated-hour instants preserved. Step help uses accessible information controls, at least 44px on phones.
5. **DONE:** CRM and Playground use the requested shared column definitions and 32px headers. Tags, including +1, stay contained; encounter text truncates with a full title. CRM uses the search placeholder and removes the duplicate helper. Browser review caught and corrected a needless 900px table minimum: 780px keeps Status visible at 125%, while the narrower inspector retains local scrolling.
6. **DONE:** The scenario selector grows to 480px, uses ellipsis and exposes the complete selected title.
7. **DONE:** The requested create/generate/reset actions use the existing outlined button treatment; reset wording is consistently “Reset account.”
8. **DONE:** Incident footers use 12.5px muted text; Home First exposure is capitalized and uses the dark text/scrim treatment. Sync links use the app's themed style and the redundant self-link is removed.
9. **DONE:** Shared Meta/Flow components replace visible fact separators, with appropriate chips, badges and decorative icons. ContentTitle adapts authored/saved labels at render time without rewriting their records. Home and Campaign use four-pixel meters with actual curriculum totals: this checkout has 58 capabilities, so the map does not claim 22. Source AST scanning found zero visible separator literals in 273 application/design-system files; authored input is handled by the reviewed display boundaries. The requested Home campaign eyebrow has a narrow exact-style exception to the older generic prohibition, with negative controls; other small uppercase contexts remain forbidden.
10. **DONE:** Native Chromium page zoom, not CSS scaling or pinch emulation, passed all four combinations: 1324×810 and 1440×900, each at 90% and 125%. Each run passed 31 root checks plus the Calendar/Workflow and table checks. Screenshot inspection confirmed the corrected 125% CRM layout. Document overflow, card geometry, labels, tags and sidebar reachability were checked. These are automated/runtime findings, not certification of every subjective design judgment or physical device.

## Engineering and independent review

The confirmed wildcard NotFound render-failure blocker now uses the existing screen boundary. Two regression tests failed before the fix and passed afterward; controlled built-UI fault injection verifies that the shell, retry and navigation survive.

The unchanged sync gate was independently exercised through local acknowledgements: baseline completion 187ms; delayed pulls completed at 11819ms and delayed push/pulls at 13809ms after the approximately ten-second gate failed. Queues and locks drained and callbacks were observed. This proves delayed completion in the controlled cases, not the historical CI cause. No sync scheduler patch, preparatory wait or increased gate deadline was justified.

Whole-delta independent review, including untracked source and bounded follow-up fixes, found no confirmed Critical or Important issue. The reviewer independently passed the original 28 evidence-joiner negative controls; the expanded final control suite passes 50/50. The joiner rejects wrong identity, missing/failed assertions, synthetic activation, duplicate cells and absent/corrupted screenshot bytes. Preview now runs the complete exact-state collector before joining the matrix, with no human/real-GHL promotion.

Browser review also caught a shared metadata contrast regression in the dark CallRoom. Its text now inherits the existing light context colors only inside that room; labels, saved recordings and media/provider behavior are unchanged. The earlier accessibility failure remains retained. Calendar's duration assertion now requires the exact requested “60 min” summary leaf, alongside the existing slot-change, save and reload checks.

The exact collector now drains pending request handlers and waits for the matching document loader/frame before reading a screen. A nonfatal transport cancellation requires the exact Invalid InterceptionId error, a same-origin direct JavaScript/stylesheet asset, the matching resource type and the exact network ID already observed as canceled. APIs, external requests, unconfirmed cancellations and other errors still fail. Confirmed cancellations are reported separately and snapshotted before teardown; they never become passing state assertions. The earlier run with 253 collected cells and 43 interception failures remains FAILED.

The next correctly loaded run stopped after four loading cells because ordinary lazy loading appeared before the controlled request arrived. The collector now requires interception and the requested visible state together within the unchanged 80×125ms limit. Three controls failed before implementation and passed afterward. Independent review confirmed the bounded correction; that four-cell attempt remains FAILED.

## Final runtime evidence

The final frozen source passed all four genuine browser-zoom combinations and all **215 screen/width polish cases** at 1440, 1024, 768, 390 and 320px. The exact-state collector passed **253 cells: 251 observed browser cells and two reviewed incident-directory N/A cells**. All 43 screens have native keyboard and touch activation evidence. Five pre-existing Academy/NotFound lifecycle exceptions remain explicit. The final evidence join verified every applicable cell and all physical screenshot hashes, including before-input images; neither N/A category is called a browser PASS.

Accessibility passed **89 axe scans**, with the intentional negative control detected and **zero reported violations**. There are **175 incomplete-node occurrences in 23 scans** requiring manual review. Zero reported violations does not certify these nodes, all contrast contexts or screen-reader/physical-device acceptance.

All seven final stages passed: exact states, polish, accessibility, Funnel, Calendar, advanced labs and Call. Feature checks include actual save/reload assertions; Call passed 62 checks across all five widths with real IndexedDB/MediaRecorder, a virtual microphone and controlled HTTP responses. The exact run recorded zero interception failures, confirmed local asset cancellations, teardown failures and external requests. Call fetches remained on localhost. Local API stubs and disposable synthetic browser data do not replace deployed Worker, recovery, real-GHL or paid-provider acceptance.

## Node 22 verification and retained failures

Node 22.23.3/npm 10.9.9 ran the required checks. Typecheck, lint, format, source security/privacy, requirement/docs/status guards, content/lock, bounded terminology/freshness, inventory, offline voice checks, all 15 adversarial cases and the 50 Node controls passed. Both Production-mode and Preview-mode builds and browser-secret checks passed; compilation did not deploy Production. The final CRM scalar CSS adjustment also passed formatting.

The fresh final full Vitest run **PASSED: 2205 tests in 181 files**, with two workers and unchanged deadlines, in 246.84 seconds. The final CallRoom/Recordings regression pair also passed all 17 tests.

The subsequent readiness correction touches only the three Node review-script files, which are covered by the expanded 50-test control suite. Application, simulator and design-system bytes remain identical to the successful full Vitest run. Browser checks use the new combined source marker rather than attributing the earlier collector run to it.

Earlier failures are retained rather than erased. The one-worker run completed 2203 tests in 180 files: 2199 passed, four failed. Three were existing content/terminology wall-clock timeouts; the fourth was the old generic Home eyebrow assertion, corrected to follow the explicitly requested exact style. A subsequent nine-file run passed all seven UI/style suites but failed the two unchanged content suites: six timeouts, 82/88 tests passed. CPU was measured at 100% during that work. Resource pressure is observed, not proved to be the sole cause. These runs are superseded by the fresh clean full run; test deadlines and unrelated acceptance gates remain unchanged. The narrow Home exception is recorded in DES-021's requirement and acceptance contract. Earlier 2180/176 success predates the visual changes and is not final-source verification.

## Published CI, privacy and release boundaries

Live read-only verification confirmed main `59ec678910cb51559d84af3c4200590f9c7e29ec` and all nine original draft stack bases. PR #32's base remains `codex/navigation-shell-redesign` at `6a1ea64081e42a0dd6ea7efd3b78c0ee4abbd685`. The initially requested source `aa5a04764a234666243e96adcd422c0ae5f616ed` and CI `34682953401` are historical; the subsequent published baseline below has its own exact-head evidence. Unrelated PR #17 and the original checkout were preserved.

[CI 38071166013](https://github.com/Beeyach/Bloomlab/actions/runs/38071166013), attempt 1, applies only to the published baseline: Checks PASSED, Preview PASSED, Production SKIPPED. Worker version `b75296b9-0f63-4d83-a91d-c7236e2734a6`. Baseline evidence: 2178 tests/175 files, 15 adversarial cases, 89 axe scans, 35 browser probes, 16 AI-Off paths, five binary recovery checks and five completed held failure modes. Complete artifact ZIP hashes were verified:

| Artifact | ID | SHA-256 |
| --- | --- | --- |
| Preview | 11677477462 | `1702d1516ea4856621b41ad8409fc36f31ae46ca3e994905c84de4c22dcc9d87` |
| Accessibility | 11677097128 | `85a3f35faf2f7466decd971fe12fffbe986692da041172af596cc89f3433f327` |
| Adversarial | 11676499138 | `2a7f1ded41b2da1f0b4d2681c56769df50e450c82227306fab4977fa2578825f` |

Repository visibility was re-read as PUBLIC. PR #32 remains OPEN/DRAFT at the baseline, base `codex/navigation-shell-redesign`; stacked PR bases #24–#32 remain intact. Nothing merged, newly pushed, deployed to Production, or tested against real GHL/providers. New exact-head CI and deployed Preview require an additional approved push. Historical CI `38063758423` failed sync timing, and unexplained historical cancellation remains unresolved; later passing evidence does not establish either cause.

The prior exposure audit remains bounded: 3301 reachable source blobs and 16 historical failed logs had no recognized-pattern findings; latest baseline artifact text and six selected private-key/link/C5 images were reviewed. The final follow-up source scan covered 1347 repository files with no recognized credential findings; 59 final report/log text files also had none. Final CRM, Skill Map and linked-Sync screenshots were inspected, with no key shown in the linked-Sync image. The other images, deleted/unreachable objects and unrecognized secret formats were not exhaustively certified. Screenshot masking remains fail-closed for its declared selectors, with retained regression coverage. Media buckets had public access disabled in the previous verified configuration; no learner objects were accessed. Automatic recovery-byte retention/deletion and claimed owner authorization/private artifact backup remain unverified. Ten dependency advisories remain without unrequested upgrades. No credentials were printed, moved or rotated.

## Requirements and next steps

No promotions: **313 registered; 284 PASSED, 8 IN_PROGRESS, 5 PARTIAL, 12 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 2 NOT_STARTED; 24 open P0/P1**. PARTIAL: EXR-008, PRI-002, NEG-003, GHL-005, GHL-010. IN_PROGRESS includes DES-006, DES-008, DES-017, DES-018, RSP-002, RSP-003 and inherited DES-009. Bounded automation does not prove every rubric judgment, contextual terminology or whole-product equivalence.

The twelve parked human/real-GHL rows remain PRD-005, CUR-015, CUR-031, EXR-015, EXR-020, CALL-002, CALL-005, CALL-006, FLD-001, VOI-006, VOI-007 and SEC-005. All 43 human visual rows remain required, including hierarchy, responsive equivalence, long-session comfort and real-device/screen-reader/microphone acceptance. Synthetic fixtures cannot finish those rows.

Next: approve the concrete reviewed local commits for a fast-forward to the existing draft PR #32 and Preview-only CI. Obtain clean exact-head checks and Preview, investigate any reproduced failures without weakening gates, then gather the retained human/provider evidence. The independent audit records verified scope and remaining blockers; Field-Ready v1 release acceptance is not complete.
