# Bloomlab navigation shell redesign and real-user scroll remediation

Branch: `codex/navigation-shell-redesign`

Base: independently re-audited Field-Ready remediation head `1e6a9fdee20089805037e0b290961a92d96d0661` on `codex/field-ready-v1-remediation` / draft PR #30.

This is a bounded follow-up to the Field-Ready remediation. Do not reopen unrelated Phase 22–26 work, do not alter parked human/real-GHL acceptance, and do not merge any stacked PR.

## Why this follow-up exists

The automated Phase 26/remediation rail probes reported the current fixed 104 px desktop rail as scrollable, but the learner then directly tested the deployed app and reported that the sidebar still cannot be scrolled down to reach lower destinations.

Treat the real-user report as authoritative contradictory evidence. A CSS declaration such as `overflow-y: auto` or an automated geometry assertion is not sufficient proof. Reproduce and fix the actual interaction failure.

The learner also requested a deliberate navigation redesign inspired by a conventional productivity-app sidebar:

- expanded desktop/tablet sidebar: icon + readable text label per destination;
- restrained grouping/dividers between related destinations;
- selected destination reads as a full-row active treatment, not only a tiny icon state;
- collapsed desktop/tablet sidebar: compact icon-only rail;
- explicit expand/collapse control;
- collapsed state retains accessible names and hover/focus tooltips;
- device preference persists locally;
- phone/mobile keeps its purpose-built existing navigation composition rather than receiving a shrunken desktop sidebar.

This is an intentional successor to the old D-117 fixed-104px labelled rail. Do not preserve obsolete wording merely because it previously passed an automated probe.

## N1 — establish the real failure before changing code

Read the current `AppRail`, `RootLayout`, global shell CSS, rail tests/probes, design tokens, `DES-009`, its acceptance criterion, relevant decisions, Phase 26 rail evidence, PR #30 remediation review, and this handoff.

Reproduce the current learner symptom on the exact starting head before editing:

1. Use a desktop/laptop viewport whose sidebar content is taller than the available height. Test at least heights 720, 600 and 480 px where overflow exists.
2. Place the pointer over the rail and attempt real wheel scrolling. Automated reproduction should dispatch an actual wheel gesture over the rail, not directly mutate `scrollTop`.
3. Verify trackpad-equivalent wheel deltas where the browser harness supports them.
4. Verify scrollbar drag if a scrollbar is rendered.
5. Verify keyboard access to every destination, including Tab traversal and an appropriate scroll-to-focused-item behavior.
6. Verify that page scrolling remains independent and a page wheel gesture outside the sidebar does not unexpectedly drive the sidebar.
7. Record the pre-fix failure in the new review. Do not weaken or delete a probe that contradicts real behavior.

If Chromium cannot reproduce the human failure, do not declare it nonexistent. Inspect likely scroll-chain/layout causes and create a regression based on the actual interaction contract: lower items must become reachable through genuine user input at overflow heights. Keep the human report recorded as the reason for remediation.

## N2 — redesign desktop/tablet navigation

Replace the fixed one-mode 104 px rail with two desktop/tablet states.

### Expanded state

Use the existing visual system and tokens. Aim for a practical productivity-app sidebar rather than a giant LMS navigation panel.

- Width should be approximately 220–248 px unless the actual token/layout review establishes a better nearby value.
- Each destination is a horizontal row with icon + text label.
- Use restrained spacing and subtle dividers to group related destinations. Derive groups from the existing Bloomlab destination inventory; do not remove destinations or invent fake product areas.
- Active destination should have a clear full-row treatment similar in spirit to the supplied reference, while staying within Bloomlab's quiet-interface visual language.
- Long labels must not collide, clip unpredictably or force horizontal scrolling.
- Brand/product identity may remain at the top, but do not add decorative eyebrow/overline UI.

### Collapsed state

- Width should be approximately 68–80 px unless a nearby existing token works better.
- Show icons only visually.
- Every icon must keep an accessible name.
- Every destination must expose a readable tooltip on both pointer hover and keyboard focus. Do not make critical information hover-only.
- Active state must remain discernible without relying on colour alone.
- Collapse/expand control itself must be keyboard/touch accessible and clearly labelled.

### Preference

Persist expanded/collapsed preference as a device preference using the existing preference mechanism. `localStorage` is acceptable only if consistent with the existing policy that it stores device preferences, never learner progress.

Do not sync this preference as learner evidence/state unless an existing architecture explicitly syncs equivalent shell preferences.

## N3 — scrolling contract

The sidebar must have one intentional scroll owner.

- Header/brand and collapse control may be fixed within the shell if that produces the cleanest result, but the navigation region containing destinations must be independently vertically scrollable whenever its content exceeds available height.
- Bottom/system destinations must remain reachable in both expanded and collapsed modes.
- No nested scroll trap where wheel/touch input is swallowed while neither the rail nor page moves.
- No horizontal scrollbar in either mode.
- Avoid hiding the scrollbar in a way that prevents mouse users from discovering/dragging it. A thin platform-native scrollbar is fine.
- `overscroll-behavior` may contain the rail only while the rail can still consume the gesture. At its boundaries, behavior should be deliberate and should not make the interface feel stuck.
- Focus navigation must scroll focused destinations into view.
- Touch scrolling on tablet must work naturally.

Do not solve this by making every item tiny enough to fit at 480 px. The point is to support real overflow correctly.

## N4 — shell layout

The main content offset must derive from the current sidebar state, not duplicated magic numbers.

- Introduce/extend explicit design-system shell-size tokens for expanded/collapsed widths.
- Root layout should consume the same active width contract as the sidebar.
- Switching states must not cause content to render underneath the rail or leave stale whitespace.
- Avoid expensive layout animation. If width transition is used, keep it restrained and respect reduced motion.
- No content loss at 1440, 1024 or 768.
- At phone widths, retain/review the existing four-plus-More mobile navigation and do not expose the desktop collapse toggle.

## N5 — requirement/decision reconciliation

This user-requested design intentionally supersedes the old fixed-104px D-117 contract.

Update the source-of-truth documentation honestly:

- revise `DES-009` wording so it specifies the new expanded/collapsed desktop/tablet sidebar, independent vertical scrolling, persistent local preference, and existing mobile composition;
- revise the `DES-009` acceptance criterion to test both expanded and collapsed modes and genuine user scrolling;
- add a new decision in `docs/DECISIONS.md` documenting that the prior fixed 104 px rail is superseded by the user-requested two-state sidebar;
- update any stale review/control text that would otherwise require exactly 104 px forever;
- preserve requirement ID, priority and intent. This is not permission to weaken reachability/accessibility requirements.

Because the learner's real-use report contradicts the old PASS evidence, do not rely on the old Phase 26 rail attestation as proof of the new contract. Re-establish `DES-009` from fresh evidence on this branch.

Do not alter unrelated requirement statuses.

## N6 — direct regression coverage

Add tests/probes that would fail on the current human-reported behavior and cover both sidebar states.

At minimum verify:

- expanded state icon + label rows;
- collapsed state visually icon-only but accessible names remain;
- hover and focus tooltip behavior in collapsed state;
- explicit toggle via pointer and keyboard;
- persisted preference survives reload;
- main-content offset matches the active state;
- actual wheel input over an overflowing sidebar changes the sidebar's scroll position and reveals a previously out-of-view lower destination;
- wheel input over page content scrolls the page independently;
- keyboard Tab traversal can reach every destination and focused lower items become visible;
- scrollbar drag when supported by the browser harness;
- tablet touch scroll of sidebar when overflow exists;
- no horizontal overflow;
- reduced-motion mode;
- mobile four-plus-More behavior remains intact and Escape/focus-return regression remains green.

Run heights 900, 720, 600 and 480 on desktop/tablet where useful. The 480 case remains a stress case, not the only proof.

Required review widths remain 1440 / 1024 / 768 / 390 / 320. Expanded and collapsed modes apply where the desktop/tablet shell is active.

## N7 — visual review

Inspect actual captures, not only numeric assertions.

The expanded sidebar should feel closer to the supplied reference in information architecture: readable icon+label rows, quiet dividers/grouping, obvious selected row, generous but not wasteful spacing. Do not copy another app's branding or exact visual styling.

Check:

- hierarchy and density;
- alignment of icons/labels;
- active state clarity;
- collapsed icon centering;
- tooltip placement near viewport edges;
- scrollbar usability;
- long labels;
- short-height behavior;
- content offset during state changes;
- light/dark surfaces if both exist;
- no generic SaaS slop, giant shadows, excessive pills or decorative gradients.

## N8 — verification and PR boundary

Run complete Node 22 checks, full existing CI, adversarial and accessibility suites, required browser probes, and a dedicated navigation probe on the exact final head.

Deploy Preview and verify browser + Worker build IDs match the exact source head.

Perform the dedicated navigation verification against the deployed Preview, not only local Vite:

- actual wheel scroll at overflow heights;
- collapsed/expanded persistence across reload;
- keyboard/focus;
- tablet touch emulation;
- mobile More regression;
- five required widths;
- short-height cases.

Open a **draft PR against `codex/field-ready-v1-remediation`**, not `audit/field-ready-v1` and never `main`. This keeps the already audited remediation delta isolated.

Do not merge PR #24, #25, #26, #27, #28, #29, #30 or this follow-up PR.

Do not modify the twelve human/real-GHL `IMPLEMENTED_UNVERIFIED` rows. Do not claim physical Safari acceptance from Chromium emulation.

Stop after exact-head CI + deployed Preview verification for independent ChatGPT audit.

Final report must include:

1. exact head SHA;
2. new draft PR number/base;
3. pre-fix reproduction result, including whether Chromium reproduced the exact wheel symptom;
4. root cause found;
5. expanded and collapsed widths chosen and why;
6. persistence mechanism;
7. exact wheel/keyboard/touch/scrollbar tests performed;
8. DES-009/decision wording reconciliation;
9. five-width + short-height results;
10. exact-head CI and Preview Worker/browser identity;
11. anything still requiring physical-user confirmation.
