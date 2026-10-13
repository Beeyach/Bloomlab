# Preview probe follow-up — 2026-10-11

> **Published outcome, rechecked 2026-10-12:** This follow-up was approved and
> pushed as `18f112f8710766462a18256d72bba5034410973b`. Exact-head
> [CI 38096748142](https://github.com/Beeyach/Bloomlab/actions/runs/38096748142),
> attempt 1, passed Checks and all seven Preview stages; Production was skipped.
> Artifact/screenshot digests were verified. The final unpublished/pending
> paragraph below retains the earlier local review snapshot. See
> [publication evidence](field-ready-v1-preview-publication.md) for current results
> and unchanged human/provider boundaries.

Report date uses Asia/Manila, as requested for the client handoff. CI and browser
evidence timestamps remain in their original UTC date, 2026-10-10.

## Retained exact-head failure

The approved four-commit push reached draft PR #32 at
`a662b19ec0f3d3191d328a5d1bb5bb92ed7aaac2`. Its original base remains
`codex/navigation-shell-redesign`; no merge or Production deployment occurred.
[CI 38092996980](https://github.com/Beeyach/Bloomlab/actions/runs/38092996980),
attempt 1: **Checks PASSED, Preview FAILED, Production SKIPPED**. Preview Worker:
`308fb25e-995d-44f2-abca-7bc01cee771b`. The failed run remains failed.

Checks passed 2,205 tests in 181 files, 50 evidence-control tests, 15 adversarial
cases and 89 axe scans with zero reported violations. Preview passed binary
recovery and its exact-state collector, but navigation, Workflow/draft, AI-Off
Workflow and C5 sync timing failed. The joined screen matrix correctly refused
to pass while its required navigation gate failed. Collector success alone is
not complete acceptance.

## Confirmed probe defects and bounded correction

- Sidebar probes still required 44–48px rows and invisible compact labels.
  Those assertions contradicted the user's approved 56px rows, 20px icons,
  4px spacing, 11.5px visible labels and scrollable destinations. Updated
  acceptance records this explicit contract; DES-009 remains IN_PROGRESS.
- The old rail assertion required wheel chaining despite the user's supplied
  `overscroll-behavior: contain`. Corrected probes require the rail to remain
  contained at its native boundary and separately prove scrolling over the
  main content moves the page. Real wheel, trackpad, scrollbar, forward/reverse
  Tab, touch, resize, persistence, clamping and reduced-motion gates remain.
- A label can paint fully within the compact scroller while extending beyond
  its narrower link box. Probes now inspect the actual scroller bounds and
  retain full-text and no-horizontal-overflow assertions. Native wheel input
  continues to the actual bottom, including padding after the last link.
- Shared composition checks verify icon size, containment and centering;
  glyph and label vertical containment; expanded label bounds; compact group
  centering; exact row height, font and spacing. Nine regression controls
  include moved and overflowing icon/glyph failures. Preview checks require
  all 17 destinations, including its two developer destinations.
- The new Wait help button preceded Add, so the old palette selector clicked
  help. The probe now selects the actual Add action, retaining edit, undo,
  redo, save, replay and version assertions. Appointment setup uses the native
  date/time fields and verifies the persisted offset-aware instant
  `2026-09-05T12:00:00-05:00`.
- Draft recovery uses the corrected Add selector; real offline Worker reload,
  unsaved-draft recovery and absence of new events/sync remain required.

Application, Worker, simulator, dependency, content, seed and migration files
are unchanged by this follow-up. No deadline was extended and no failing gate
was removed. The correction changes the test drivers and records the explicit
user-directed sidebar acceptance contract.

## C5: observation without an unsupported engine patch

The failed CI recovery push took 7,571ms and its first pull 2,548ms: 10,119ms
before the following pull could finish inside the unchanged manual completion
gate. Current full failure-isolation interactions at the same deployed head
passed all five original cases: recovery push 4,843ms, first pull 1,902ms,
following pull 695ms, 13 operations and 25,724 body bytes. Final queue and Web
Locks were empty, manual completion count was one and busy was false.

Current waiting time was predominantly response-header waiting. Historical CI
did not capture operation counts or Worker/D1 execution timing. Variation is
observed; its precise historical cause is unproven. Existing sync scheduling
preserves a following round trip for overlapping manual requests. No engine,
Worker or timeout patch is justified by the bounded evidence.

## Verification and review

Fresh Node 22 verification passed all 59 evidence/composition controls, full
lint and formatting, documentation and Field-Ready status guards. The relevant
Workflow screen suite passed 12 tests. Corrected live Workflow passed 18/18,
AI-Off Workflow passed 18/18 with zero AI requests, and real draft recovery
passed all five widths (1440, 1024, 768, 390 and 320).

Final rail checks passed five widths plus ten short-height cases. Final sidebar
resize passed 224 checks in 23 layouts. Fresh navigation passed 44/44 cases and
5,582 checks: 36 desktop cases (including 810px), six Workflow cases and two
phone cases. Browser and Worker identities matched the published source before
and after the run; no browser errors were recorded. These tests use the new
local drivers against the unchanged application at the failed CI head.

Complete artifact sizes and SHA-256 digests were verified against GitHub's
metadata. The failed run's 253 exact-state cells were independently joined and
their physical screenshot digests verified: 251 browser cells, two reviewed
directory N/A cells, 43 keyboard and 43 touch cells. This does not override the
blocked overall screen matrix. All 105 extracted JSON/log/Markdown files had
zero recognized credential or private-key candidates. Four key/link/conflict
screenshots and the C5 failure image were inspected; no sync key was visible.
Synthetic fixture identifiers appear in the diagnostic images; every image
and unrecognized secret format were not certified.

| Artifact | ID | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Preview | 11685922505 | 185467305 | `3e4e1e0adc83a0d14c49c04ab947a8fc7742ca80947beed30eef92f4246f5b8f` |
| Accessibility | 11685250919 | 12905 | `f2d9026f01276363fedfe4458a064015227afa0260f39d2d0321c4fd1331101f` |
| Adversarial | 11684738583 | 5716 | `4c5e21529452c835bc4816c9d78cef222e5059afece95833bd0a5a1c6bd929f3` |

An independent Sol High review found an important false-proof risk in the first
composition helper. Oversized/shifted geometry fixtures reproduced it; the
helper was strengthened and the review independently confirmed all 59 controls
and rejected those corrupted fixtures. No remaining Critical/Important finding
was reported in this bounded probe delta. The reviewer did not rerun live
Preview or certify the entire historical PR range.

## Acceptance boundaries

No promotions: 313 registered; 284 PASSED, 8 IN_PROGRESS, 5 PARTIAL,
12 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 2 NOT_STARTED; 24 open P0/P1.
All 43 human visual rows and twelve human/real-GHL rows remain parked. Public
exposure review is bounded by recognized patterns and selected screenshots;
unknown secret formats, every image, removed artifacts, claimed owner
authorization/backups and recovery-byte deletion remain unverified. Ten
dependency advisories remain without unrequested upgrades.

This local follow-up needs an additional approved fast-forward to the same
draft PR and clean exact-head Checks plus Preview. Production must remain
skipped. A local probe pass does not replace CI or human/provider acceptance.
