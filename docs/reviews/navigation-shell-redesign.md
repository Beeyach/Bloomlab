# Navigation shell redesign — independent audit handoff

Branch `codex/navigation-shell-redesign`, base `codex/field-ready-v1-remediation` at
`1e6a9fdee20089805037e0b290961a92d96d0661`. No stacked PR may be merged.

## N1 — contradictory real-use evidence and starting-head reproduction

The learner reports that the deployed sidebar cannot actually scroll to lower destinations.
That report is authoritative contradictory evidence against the previous DES-009 PASS, even
though Chromium probes passed. Its exact device/browser failure is **not yet explained**.

Read the complete redesign handoff, AppRail, RootLayout, global CSS, tokens, app/design-rule
regressions, rail/CDP probes, DES-009 and acceptance criterion, D-053/D-084/D-116/D-117,
Phase 24/25/26 rail evidence, Phase 26 accessibility review and PR #30 remediation review and
final attestation. Starting source head is `1bd8454b0d6c7b5cd3810dc7077843cbddfe5492`;
its only change from the deployed base is the handoff document.

Before any app edit, tested both the exact starting-head built local Worker and the deployed
base above at 1440 × 720/600/480. Both browser identities matched their respective source heads.
Native CDP wheel input over the rail moved scroll position 0 → 240 at all three heights;
eight 12.5 px deltas moved it to 340. Repeated wheel gestures revealed Design at the bottom
(scroll maxima 742/862/982). Native scrollbar dragging moved it to 588/710/896 respectively.
Forward Tab reached all 17 current/flagged destinations with visible focus. An outside-page
wheel moved the page by 240 without moving the rail. No scrollTop assignment was used for
these measurements. Raw scripts, JSON and captures: `.review/navigation/baseline*`.
The unchanged existing rail probe is also retained as baseline evidence, not deleted because
it contradicts the learner report.

Chromium did **not** reproduce the exact inability to wheel-scroll. It did confirm a narrower
interaction defect: continued boundary wheel gestures moved neither owner because the whole
fixed rail used unconditional `overscroll-behavior-y: contain`. That explains a boundary dead
end, not the learner's entire device-specific symptom. The old probe explicitly required this
containment and used direct scrollTop assignment to reach its boundaries, so it cannot establish
the new natural-input reachability contract by itself.

The first app change isolates one flex child with `min-height: 0` as the destination scroll
owner, reserves a native scrollbar gutter, retains natural list heights, and permits native
boundary chaining. Brand stays outside scrolling. This is structural remediation of the
observed dead end and likely layout/scroll-chain causes, not a claimed physical-browser diagnosis.

## N2–N8

Implementation and fresh evidence are recorded below as each ordered checkpoint completes.
The twelve human/real-GHL IMPLEMENTED_UNVERIFIED rows and unrelated statuses stay unchanged.
Old Phase 26 attestations are historical evidence only; physical Safari/learner confirmation
and independent ChatGPT audit remain separate from controlled Chromium verification.

Scroll-only fix verification (before N2): built label `navigation-scroll-fix`, 1440 ×
720/600/480. Wheel moved 0 → 240, small deltas → 340, repeated wheel revealed the last action;
continued bottom gestures now moved the page 0 → 240, and outside input independently → 480.
Scrollbar drag and all destination Tabs remained reachable. This demonstrates correction of
the reproducible boundary dead end without asserting reproduction of the entire human symptom.
Artifacts: `.review/navigation/scroll-fix/127.0.0.1.json` and captures.

## N2 — two navigation states

232 px expanded rows use existing typography, colour, spacing and radius tokens. Learning and
Search precede Labs, followed by Clients/Portfolio, Playground and enabled developer actions;
subtle dividers separate these existing areas. The 76 px state centers icons while retaining
explicit accessible names. The selected row has an inset marker as well as surface/weight cues.
The 44 px toggle works with pointer, native Enter/Space and touch. Tooltips render outside the
scroll clip, appear on hover and focus, permit pointer entry, stay within the viewport and dismiss
on Escape. No desktop toggle is shown on phones.

`bloomlab.sidebar.v1` stores only `expanded`/`collapsed`, matching the device-preference policy
used by sound. Unknown/blocked reads default expanded; blocked writes retain session operability.
Other same-device tabs follow storage events. No learner store, sync payload or migration changes.

## N3 — scroll owner

The scroll-only fix is retained inside both states. One bounded flex child (`min-height: 0`)
owns all destinations including system actions; the brand/toggle remains fixed. Lists cannot
shrink to conceal overflow. Thin native scrollbar plus stable gutter remain discoverable and
draggable. Focus padding leaves room for the outline; native boundary chaining is deliberate.
No wheel/touch handlers prevent browser scrolling. Phone More retains its existing containment.

## N4 — shell layout

Explicit expanded/collapsed tokens feed inherited `--bl-size-rail` on RootLayout. The rail width
and frame padding consume that same active contract. State changes have no width/padding
animation, including reduced motion. Phone layout ignores desktop width while preserving the
stored preference for return to tablet/desktop.

## N5 — requirement and decision reconciliation

DES-009 retains its ID, P1 priority, phase and reachability/accessibility intent. Its wording and
acceptance now require both states, local persistence and genuine input at all required widths
and short heights. It remains IN_PROGRESS for independent audit and confirmation on the learner’s original device; controlled Chromium success does not resolve that contradictory physical-use report. D-202 explicitly
supersedes D-117, with master §73, design system and implementation status aligned. Historical
Phase 26/remediation records now identify their fixed-width/containment assertions as superseded;
no historical failure or PASS is erased. Existing pricing/calendar/reporting/incident/sales rail
checks measure the active token instead of mandating 104 px forever. The original rail probe's
reachability assertions remain, while desktop boundary expectations follow the new native-chaining
contract; the new dedicated probe never assigns scrollTop to demonstrate reachability.

## N6 — direct regression coverage

The dedicated `review:navigation` drives native CDP input without `scrollTop`, `scrollIntoView`,
DOM focus or scripted click calls. It covers 1440/1024/768 × 900/720/600/480 × both states,
plus reduced motion at 480 (30 cases), both phone widths, and readable Workflow canvas space
in six desktop/tablet compositions. Every focused destination must show the matching tooltip;
hover entry into the tooltip and Escape dismissal are checked. Native Space/Enter, pointer and
touch toggle, reload/phone round-trip persistence, token/offset equality, actual wheel/small
deltas, revealed lower links, native thumb drag, touch swipes/taps and forward/reverse Tab are
asserted. A blocked-scrolling negative control fails specifically at
`realWheelConsumesBeforeBoundary` despite overflow geometry still existing. It exits nonzero;
artifact `.review/navigation/n7-negative`. It never modifies shipping CSS.

Three preference tests cover reload/remount, both choices, blocked storage, unknown values and
same-device storage events. Focused App/preference/design checks: 41 tests pass. The existing
Search test assumed desktop DOM index 3 was always Workflow; it now verifies the actual four
phone-primary entries while retaining the shortcut assertions (9 tests pass). Phone browser
checks independently verify visible composition, so this does not substitute DOM order for UI.

Retained intermediate failures: the first new driver omitted Enter's character event; corrected
to the existing CDP keyboard convention. A tall viewport's entire overflow was consumed by one
wheel notch; small-delta testing now starts from a fresh page, requiring independent actual
movement. A bottom tap during inertial touch scrolling was rejected; the driver now waits for
three unchanged scroll samples and then taps the real target. These are input-driver corrections,
not relaxed reachability assertions. Tooltip inspection found a real app issue (stale labels on
rapid focus changes and scroll-dismissed focused hints); blur now dismisses immediately and
focus-driven scroll repositions the current hint. Every destination's tooltip is asserted.

Full unit run before updating the old Search index expectation: 2109 passed, one failed / 160
files. The corrected Search run passes. An early lint run included ignored temporary reproduction
scripts; their preserved copies now have `.mjs.txt` suffixes, and lint passes with the existing
ExerciseRunner hook warning only. A local sweep interrupted by rebuilding the served assets is
retained as incomplete; only the subsequent stable-build run counts as full evidence.

## N7 — visual review

Inspected actual expanded/collapsed captures at desktop/tablet sizes, including short-height
bottom focus/tooltip captures and both phone compositions. Quiet dividers, aligned horizontal
rows, full-row marker, readable labels, centered icons within scrollbar-adjusted usable space,
visible native thumb, fixed toggle and content offsets are present. The longest current label
fits naturally. The global shell is light-only; inspected it beside Workflow's dark canvas at
1440/1024/768 in both states. No invented dark theme is claimed.

The 768 px expanded capture exposed a 121 px Workflow canvas even though the numerical page
scan passed. Its existing viewport-based two-column grid ignored the larger sidebar. A local
workspace container query now stacks canvas/tools below 40 rem of available content width;
canvas nodes remain readable, with tools reachable below. The container is limited to Workflow's
workspace, preserving the shell and overlay containing blocks. The corrected 768 px capture has
a 457 px canvas. Six direct canvas-width checks now prevent recurrence in the dedicated probe.

Fresh full exact-head and deployed results are recorded at N8 in the PR attestation, after all
source/document/probe changes are committed. This avoids embedding a self-referential hash.

The unchanged Workflow probe subsequently rejected the deliberate 768 px stack because it
required two columns at every tablet viewport. That obsolete layout assertion now checks the
available workspace measure, a ≥280 px readable canvas and tools below the canvas in the narrow
composition. All edit, undo/redo, keyboard/drag, execution and phone touch assertions remain.
Two direct tooltip unit regressions also pass, guarding immediate focus-label replacement,
focus-scroll persistence, Escape and pointer entry into the tooltip.


Stable pre-N8 results: built label `navigation-n7` passes all **32 navigation cases** (30
both-state desktop/tablet height/motion cases plus both 480 px phone cases), including every
focused tooltip, touch toggle/bottom activation and native scrollbar drag. The adapted legacy
rail probe passes all five standard widths and ten short/motion cases. Corrected Workflow probe
passes all sections, including readable tablet composition and genuine phone interactions.
The broad five-width screen scan passes 180 route/width combinations. Raw artifacts live under
`.review/navigation/{n7-complete,legacy-n6,n7-workflow-corrected,polish-n6,visual}`; these are
working-build evidence, not immutable source-head attestations. Baseline and negative-control
summaries are committed in `navigation-shell-evidence.json`.

## N8 — exact-head CI, Preview and audit boundary

The final draft PR targets `codex/field-ready-v1-remediation`. Complete Node 22 CI and the
configured Preview deployment must pass on its exact source head; Production must remain
skipped. Browser and `/api/health` identities must match that head before and after the deployed
suite. Repeat all 33 existing isolated browser probes and the dedicated navigation probe
(including its six added Workflow-space checks, 38 cases total) on Preview. The final PR body
records the immutable SHA, CI URL, Worker version and actual results without changing that SHA.

DES-009 is deliberately **IN_PROGRESS**, with its new contract and fresh controlled evidence,
until independent audit and the learner’s original-device scrolling confirmation. It is not
promoted on the strength of the contradicted historical attestation. Every other requirement
row, all twelve human/real-GHL IMPLEMENTED_UNVERIFIED rows, and AUDIT_REPORT.md are unchanged.
Stop for independent ChatGPT audit; do not merge PR #24–#30 or this PR.
