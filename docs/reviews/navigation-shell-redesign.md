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
