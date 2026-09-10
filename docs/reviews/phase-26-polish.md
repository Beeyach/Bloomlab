# Phase 26 — Polish and hardening

## Checkpoint A — baseline and closeout ledger

Branch: `codex/phase-26-polish`. Audited Phase 25 base:
`ad54be84999c263f5ebe5a293528a85614bd20d6`; Phase 26 handoff head:
`aae1d5adbf1491e39f656fc21b1efd15cd233dd6`. The one new draft PR targets
`codex/phase-25-advanced-curriculum`, never main. No stacked PR may be merged.

Read the entire Phase 26 handoff, master spec, CLAUDE, requirements matrix, acceptance tests,
implementation status, known limitations, changelog and Phase 25 handoff/review before implementation.
The following classifications are a work plan, **not requirement status changes**. This includes
every assigned Phase 26 row and every unfinished P0/P1 row, including older-phase cross-cutting gaps.
Overdue P2 portfolio/glossary/design rows and the remaining analytics row are explicit too.

| Requirement | Baseline | Classification | Evidence/work to examine |
|---|---|---|---|
| PRD-001 (P0) | NOT_STARTED | verify now | H/I — inspect personal-first routes and dependencies; simulated client billing is training, not app billing. |
| PRD-004 (P0) | NOT_STARTED | verify now | G/H/I — AI Off across core work; controlled provider failures. |
| PRD-005 (P0) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| PRD-009 (P1) | NOT_STARTED | verify now | I — inspect shared engine/content/store boundaries; no commercial infrastructure. |
| PRD-014 (P1) | PARTIAL | verify now | F/H — inspect evidence-derived capabilities and rewards; no points. |
| PRD-015 (P2) | NOT_STARTED | implement now | F — six existing signature moments, immediate results and reduced motion. |
| PRD-016 (P3) | NOT_STARTED | implement now | F — optional muted-by-default cues; no provider. |
| CUR-015 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| CUR-031 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| EXR-006 (P1) | PARTIAL | verify now | G/H — inspect prediction/replay contract; retain partial unless full interaction is proved. |
| EXR-007 (P1) | PARTIAL | verify now | G — recheck late-booking and edge-case grading; fix objective hardening defects. |
| EXR-008 (P1) | PARTIAL | verify now | G/H — authored fixtures do not prove arbitrary architecture judgment; retain partial. |
| EXR-009 (P1) | PARTIAL | verify now | H — inspect advanced decision support; do not claim missing late-level modes. |
| EXR-015 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| EXR-020 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| EXR-024 (P0) | PARTIAL | verify now | G/H — exercise real interactions and inspect remaining scope boundaries. |
| PRI-001 (P1) | PARTIAL | verify now | Preserve PARTIAL; pricing structural judgment is not broadened by polish. |
| PRI-002 (P1) | PARTIAL | verify now | Preserve PARTIAL; no unrelated pricing or paid-provider work. |
| NEG-003 (P1) | PARTIAL | verify now | Preserve PARTIAL; controlled classification does not establish broad language quality. |
| CALL-002 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| CALL-005 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| CALL-006 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| FLD-001 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| PORT-003 (P2) | NOT_STARTED | verify now | H — compare actual five projects/two templates to required twenty; missing progression is not silently deferred or promoted. |
| DES-006 (P0) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| DES-008 (P1) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| DES-009 (P1) | PARTIAL | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| DES-010 (P1) | PARTIAL | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| DES-012 (P2) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| DES-017 (P1) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| DES-018 (P1) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| HOL-005 (P2) | NOT_STARTED | implement now | F — reusable material physics and settle. |
| RSP-001 (P0) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| RSP-002 (P0) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| RSP-003 (P0) | IN_PROGRESS | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| RSP-004 (P1) | PARTIAL | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| A11Y-001 (P0) | PARTIAL | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| A11Y-010 (P1) | NOT_STARTED | implement now | E — real CI engine and six-area controlled review. |
| SYNC-007 (P0) | PARTIAL | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| DATA-001 (P0) | PARTIAL | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| DATA-006 (P1) | PARTIAL | verify now | I — inspect private-media/metadata boundary; local JSON restore does not create R2 backup coverage. |
| DATA-009 (P2) | NOT_STARTED | implement now | B — strict staged restore and atomic non-destructive commit. |
| VOI-006 (P1) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| VOI-007 (P0) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| INF-001 (P0) | PARTIAL | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-004 (P0) | PARTIAL | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-005 (P0) | PARTIAL | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-006 (P0) | NOT_STARTED | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-007 (P0) | NOT_STARTED | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-008 (P0) | NOT_STARTED | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-011 (P0) | PARTIAL | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| INF-015 (P1) | NOT_STARTED | independent audit only | Independent auditor alone produces AUDIT_REPORT.md; no implementation self-certification. |
| INF-016 (P1) | NOT_STARTED | implement now | G — fifteen reproducible adversarial cases. |
| INF-017 (P2) | NOT_STARTED | implement now | C — one local search with genuine attempt history. |
| INF-018 (P2) | NOT_STARTED | verify now | I — inspect learning-only event records; do not add invasive analytics or a second tracking backend. |
| PERF-001 (P0) | PARTIAL | verify now | E/F/H — full screen/state/width/interaction evidence before any promotion. |
| SEC-001 (P0) | PARTIAL | verify now | I — both browser builds/provider-secret scans and tracked-source boundary; never disclose credentials. |
| SEC-002 (P0) | NOT_STARTED | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| SEC-003 (P0) | NOT_STARTED | verify now | G/H/I — inspect current implementation and run direct regressions; retain any unmet full-requirement boundary. |
| SEC-005 (P0) | IMPLEMENTED_UNVERIFIED | human acceptance required | Parked personal/physical-device acceptance; preserve status. Controlled tests cannot substitute. |
| CNT-010 (P2) | NOT_STARTED | implement now | C — existing glossary integrated with search. |
| GHL-005 (P0) | NOT_STARTED | verify now | D/H — registry coverage and UI references; missing coverage stays open. |
| GHL-008 (P2) | NOT_STARTED | implement now | D — deterministic dated maintenance report. |
| GHL-009 (P0) | NOT_STARTED | verify now | D/H — compare all B/C approximations to recorded limitations. |
| GHL-010 (P0) | NOT_STARTED | verify now | D/H — registry-backed exact product labels; source only narrow objective corrections. |

No new requirement is intentionally deferred out of v1 in this ledger. Existing FLD-003 and SEC-006
remain DEFERRED under their original optional real-GHL API/commercial-legal boundaries.
Missing portfolio progression is an existing gap, not a newly authorized scope downgrade.

### Counts, versions and focused baseline

- 313 requirements: 246 PASSED, 8 IN_PROGRESS, 22 PARTIAL, 12 IMPLEMENTED_UNVERIFIED,
  2 DEFERRED, 23 NOT_STARTED; none BLOCKED or FAILED.
- Node 22.23.2; app 0.1.0, content 2026.09.27, simulator 2026.09.23-r1,
  mastery rules 2026.09.09-r5, grader 2026.09.22. IndexedDB v8.
- Content hash `f14486b89eaa1e66a9326128385748b31c1ad6986c7f25c81549db7d0cb899fc`;
  400 source files, 58 skills, 54 units, 104 exercises, 10 campaigns, 89 GHL features,
  20 clients, five projects and two portfolio templates.
- Focused baseline: **68 tests / 6 files passed** (export, sync engine, content, webhook freshness,
  HoloMaterial and design rules). Control-doc validation and content lock check pass. Existing
  advanced-path GATE_WITHOUT_PROJECT warnings remain visible.
- The prior audited Phase 25 exact-head CI passed 1,985 tests / 143 files. That historical result
  is not Phase 26 verification; complete Node 22 and exact-head CI/Preview are required at I.
- Existing implementation: export v1 has six groups and an explicit field allowlist; no restore.
  Compiled search/glossary and freshness rows exist without a global learner search or dedicated
  maintenance command. HoloMaterial, reward reveal, workflow playback and browser probes are reused.

### Authoritative discrepancies and preservation

The master §142 and matrix enumerate **15 separately testable adversarial cases** when missing
phone and missing email are counted separately. The older acceptance sentence says fourteen;
checkpoint G will retain all fifteen and document the correction rather than combine cases.
The approved rail width is **104 px** (master §73/D-117/current implementation); the older
68–80 px acceptance line is stale. Preserve independent vertical rail scrolling, phone More,
visible focus and the current width.

The twelve parked human-unverified rows remain unchanged. In particular, no fixture or visual
polish earns Ary Field Ready (PRD-005, CUR-015, CUR-031, FLD-001, EXR-020).
PRI-001/002 and NEG-003 remain PARTIAL. INF-015 is reserved for the independent no-coding auditor.
No provider spending, production learner data, media publication, migration or merge is part
of this baseline. Work proceeds B → C → D → E → F → G → H → I, with focused checks between checkpoints.

## Checkpoint B — staged restore

Restore Backup now accompanies the existing Export Bloomlab Data action in Sync settings. It
reads bounded JSON (25 MB, depth/node limits), rejects unsupported versions, malformed record
schemas, duplicate IDs, unsafe/prototype keys and all credential/media values excluded by export.
Selection and cancellation write nothing. The summary names missing versus retained records and
excluded private media; confirmation is explicit. Restore requires the same learner identity;
another device must first link with the original Sync Key, never import a session or reassign rows.

D-200 defines add-missing conflict behavior: keep all existing IDs and tombstones, keep the entire
history of an existing simulator run, and reject a preview if local/sync state changed. Missing
records and ordinary outbox operations commit in one IndexedDB transaction. Progress is recomputed
from validated evidence, not imported as a serialized completion claim. Interrupted/quota-failed
writes roll back together and can be retried. No network request, fake upload or fake sync status.

Simulator saves must reproduce from their history using the available content/engine; incompatible,
redacted or incomplete histories are refused without changing local data. This exposed an export
sanitizer bug: numeric calendar pre/post buffer minutes had been removed as if they were binary
buffers. The narrowly tested numeric exception preserves scheduling data in new v1 exports while
raw binary/audio fields remain excluded. Older redacted simulator exports may be refused; keep
their source device and make a fresh export. Raw private media and unfinished drafts remain outside
the export/restore contract. No schema/storage/content version or migration change.

Checkpoint checks before C:

- **56 tests / 4 files passed**: export/restore, sync engine and simulator persistence. Restore
  covers all supported groups/reopen, schema/version/date errors, duplicate IDs, existing edits
  and tombstones, cancellation, unsafe keys, foreign ownership, dangling references, changed
  previews, transactional partial failure/retry, and derived-progress recomputation.
- Web typecheck and scoped ESLint pass. Preview build and browser provider/secret scan pass.
- Built Chromium probe passes **1440/1024/768/390/320 at 480 px height**: file selection and
  summary/cancel are read-only; malformed/unsupported files are refused; offline confirmation,
  queued restore, reopen, duplicate protection, keyboard/visible focus, focus return, touch and
  reduced motion pass. Artifact: `.review/phase-26-restore/verified/restore-probe.json`.
  The 320 px summary and confirmation screenshots were inspected; no horizontal overflow.
- The first keyboard probe omitted Enter's character event; the committed probe now sends the
  same native keypress used by the existing Academy probe. No assertion or app keyboard behavior
  was weakened. This is controlled Chromium evidence, not physical-device acceptance.

Requirement statuses remain at baseline until final evidence reconciliation. No provider spend,
parked human-status change, earlier-PR mutation or merge.

## Checkpoint C — local global search and glossary

One route-local search projects the compiled content index and actual owned, non-deleted attempts.
It includes skills, GHL features, Academy lessons, glossary, clients, practice exercises and saved
attempts, with exact-title/prefix/word/alias ranking, multiword matching, category browsing, clear
destinations, no-match/loading/history-error recovery and immutable attempt details. The glossary
uses existing definitions, aliases and related skill/feature links; no filler curriculum was added.
GHL detail retains status, fidelity, verification date/context, source and every recorded limitation.
The audited webhook Ed25519-only context remains intact. Saved attempt links identify the selected
historical record, not the current runner draft or an invented result.

D-201 keeps queries/filters/bookmarks in URL fragments: they remain local on reload rather than
travel in Worker request URLs. Search is reachable from the existing rail/More composition and
Ctrl/⌘ K; no rail redesign, width change or loss of a primary phone destination. No new persistence,
backend, search service, analytics event, provider requirement or migration.

Checks before D:

- **43 tests / 3 files passed** (search, app/shell, design rules), web typecheck and scoped lint.
  Tests derive coverage from the bundle, check rank/aliases/empty/categories, foreign/deleted
  history exclusion, immutable selected history, glossary/registry links, error/retry and shortcut.
- Preview build/provider-secret scan passes. Built AI-Off browser probe passes **25 surface/width
  cases** (empty/search results/glossary/feature/saved history at 1440/1024/768/390/320), all clients,
  no-match, keyboard and visible focus, 480 px touch/reduced motion, offline search and offline
  bookmarked glossary reload. A real CONNECT webhook practical creates the searched saved attempt.
  Artifact: `.review/phase-26-search/local/search-probe.json`; desktop/320 results inspected.
- The rail probe passes five normal widths and ten 480 px normal/reduced cases with visible
  scrollbars, independent wheel/touch/page scrolling, all links and bottom actions reachable.
  Artifact: `.review/phase-26-search/rail/rail-probe.json`.
- The browser helper formerly waited forever for a full-load event after fragment navigation.
  It now recognizes same-document navigation, retains route-specific waits, and bounds full-load
  waits. The search probe covers the fragment path repeatedly. No app behavior was weakened.

All statuses remain at baseline pending final reconciliation. Chromium is controlled evidence,
not a physical-device or personal-transfer certification. Provider spend remains $0.

## Checkpoint D — deterministic registry maintenance

`npm run content:freshness -- --as-of YYYY-MM-DD` produces dated JSON/Markdown maintenance reports
from the compiled, lock-validated registry. The default threshold is **more than 90 whole UTC
days**, shared with compiler freshness. Optional positive whole-day thresholds are explicit.
Current-but-stale, needs_review, deprecated, removed and future verification dates are distinct;
none changes the authored status. Stable age/ID ordering and the reference date make reruns
reproducible. Each item retains source URL, fidelity, date, approximation, every limitation and
verification context. The command performs no network work and never rewrites a source record.

The command is part of complete local CI and GitHub Checks. Review findings remain advisory
warnings under existing policy; invalid dates/schemas/options and broken content locks fail.
`CONTENT_ARCHITECTURE.md` documents the maintainer's manual official-source review responsibility.
No broad registry re-research, date reset, content promotion or content-version change occurred.

Checks before E: **62 tests / 4 files passed** (maintenance, compiler/content, schemas and webhook
freshness), all workspace typechecks and scoped lint. Regressions cover recent/stale current rows,
the exact 90/91-day boundary, needs_review/deprecated/removed, retained metadata, deterministic
ordering, malformed/future dates, configurable thresholds and zero network calls. The command's
invalid-date probe (`2026-02-30`) correctly exits 1 without rewriting reports or source.

As of **2026-09-09**, the source registry contains **89 current / 0 needs_review / 0 deprecated /
0 removed**, with **0 advisory review items** under the 90-day rule. This reports existing authored
metadata, not a new verification of 89 features. Two runs generated identical SHA-256 bytes:
JSON `9e3b9c3a0438ce4c460b39cdbbf153f4fe3f1c834ca9cfee913f617aeda5bcf3`, Markdown
`09248526f74795186aa61b627bfd671c658cc944a771d7554094b0308409aea8` at
`.content/freshness-review.{json,md}`. Content hash remains the baseline value. Statuses and all
parked human requirements are unchanged; provider spend remains $0.

## Checkpoint E — accessibility gate and interaction review

Pinned axe-core 4.13.0 now runs against the built app in complete local CI and GitHub Checks.
All default rules are enabled across 26 major route states at 1440/390 plus phone More-open;
serious/critical violations fail. All 53 scans pass with zero violations, and an injected unnamed
button is correctly detected as a blocking negative control. Full results, including unresolved
gradient contrast checks, are uploaded as an exact-build artifact. No excluded elements/rules.

The gate found and fixed two actual contrast defects: opacity on inspectable locked Skill Map
cards, and faint small client labels in Incidents. Keyboard review found More's Escape focus
return missing; it now focuses the trigger, with app-unit and actual browser regressions.
No navigation redesign or rail-width change.

The committed [six-area controlled review](phase-26-accessibility.md) records keyboard, focus
flow, touch, reduced motion, holographic contrast and drag alternatives. Supporting checks:
44 tests / 6 files, all workspace typechecks, scoped lint, Preview build/secret scan, all 15
Workflow probe sections, five normal rail widths and ten deliberately short 480 px cases pass.
Native keyboard traces and Holo pointer/touch/settle/reduced captures were reviewed. The Workflow
320 px and Holo peak/reduced screenshots were inspected. This is Chromium evidence, not physical
device or full assistive-technology certification; A11Y-001 is not promoted from this subset.

Checkpoint F follows only after these checks. Status reconciliation remains at I. No provider spend.

## Checkpoint F — meaningful recognition and optional sound

The six existing moments retain their own purpose. Holo Skill Interaction uses the one material;
First Workflow Execution still plays actual engine records with Pause/Skip/Replay; Client Case
Reveal receives a 3 px spatial settle around the real business heading; Failed Test receives the
same brief, non-opacity settle without hiding critical differences; a newly saved Independent Pass
receives a quiet 1.8 s skippable frame acknowledgement; evidence-complete Field Ready receives the
same restrained treatment around its existing certificate. No confetti, points, trophy, new gradient
system, blocking overlay, result delay or manufactured progress. Historical results do not replay
recognition, and guided/assisted passes cannot present independent recognition. Field Ready still
depends on the unchanged evaluator and retains its manual-proof/no-real-client-certification warning.

The existing RewardReveal now offers this readable-at-full-opacity recognition treatment. Skip and
automatic finish preserve focus. Live reduced-motion changes finish recognition and Workflow
playback immediately. Holo cancels in-flight frames and resets neutral immediately on a live
preference change or leaving the viewport; compositor promotion is limited to active tracking.
Pointer/touch settle physics, rounded clip, focus ring, pan-y and the one reusable material remain.

A labelled global Sound cues toggle defaults off, persists explicit opt-in locally and remains
44 px tall at all widths. Five short sine cues cover selection, snap, connect, execution and
completion; 80 ms rate limiting, 0.018 peak gain and 55–130 ms envelopes prevent chatter/ambience.
Mute cancels active/pending audio and honors other-tab changes. Unsupported/denied audio or storage
does not reject, delay or change a learner action. No recording, generated voice, audio download,
external service or provider dependency was added.

Checks before G:

- 78 tests / 9 files pass (moments/sound, Holo/motion, Search history, Field Ready completion,
  Workflow UI and sales runner); final focus/physics/design subset 50 tests / 6 files passes.
  All workspace types and scoped lint pass, with only the pre-existing runner dependency warning.
- Built probe passes **30 width states** at 1440/1024/768/390/320: actual AI-Off failed/pass
  webhook results, static reopened results, real client case, incomplete Field Ready and explicitly
  controlled complete certificates at 480 px in both motion modes. Sound opt-in/navigation/mute and
  denied-AudioContext grading pass. Live Holo preference/offscreen reset passes on an actual Skill
  Map card. Artifacts: `.review/phase-26-moments/verified/moments-probe.json`; 320 px pass and
  reduced certificate captures inspected. Fixture certificates are not Ary's acceptance.
- Workflow browser probe passes all **16 sections**, including new live reduced-motion settlement,
  first execution/skip/replay, keyboard/drag/touch alternatives, five compositions and 500-event
  responsiveness in this controlled container. `.review/phase-26-moments/workflow/workflow-probe.json`.
- Browser review found the initial small Sound toggle target; the 44 px minimum is fixed and
  asserted. Holo input waits for IntersectionObserver/media updates before sending the next actual
  event; no app assertion was weakened. Preview build/provider-secret scan passes.

No content, schema, evaluator, ownership, human-acceptance status or migration changes. Spend $0.

## Checkpoint G — adversarial harness

All **15 master §142 cases pass**, derived from **28 executed assertions / 11 files**, not a static
checklist. `scripts/adversarial-cases.mjs` names each setup, expected behavior, exact regression
title and limitation. `npm run test:adversarial` runs those regressions against local IndexedDB,
local Worker/D1 test storage and controlled provider transports, then generates fresh observed
PASS/FAIL JSON/Markdown. Missing/skipped/ambiguous/failed assertions or runner failure fail the
harness. It now runs in complete local CI and GitHub Checks with an exact-build artifact.

The committed [fifteen-case record](phase-26-adversarial.md) includes every setup, expected/observed
result, reference and limitation: offline exercise, simulation refresh, duplicate events, missing
phone, missing email, cancellation during wait, timezone change, AI timeout, budget exhaustion,
ElevenLabs failure, transcription failure, sync conflict, second device, extreme values and malformed
scenario. Missing email previously lacked its own named regression; `MSG-004` now proves
an explicit skip with no message or sent-count increment. The existing implementation behaved safely;
no unrelated simulator rewrite was needed. The older acceptance count of fourteen is corrected to
fifteen without combining phone/email or weakening the master.

All workspace typechecks and scoped ESLint pass. Artifacts:
`.review/adversarial/adversarial.{json,md}` plus its uniquely named fresh Vitest report.
No real provider was called, no generated success was substituted, no migrations or parked-status
changes occurred; spend $0. This is adversarial implementation evidence, not INF-015 independent audit.

## Checkpoint H — responsive/design/performance sweep

The maintained [screen/state matrix](phase-26-screen-matrix.md) maps 36 route/detail/runner states
to Desktop, Tablet, Mobile, Empty, Loading, Error, Keyboard and Touch evidence. All **180 layout
cases** pass at 1440/1024/768/390/320: no page horizontal overflow, sub-44 px phone controls,
sub-16 px phone fields, user-facing monospace or small uppercase eyebrow. The scan measures native
checkbox/radio labels as real activation targets. Pricing's probe now activates its associated
labels with native mouse/touch events and verifies the value changes; all sixteen pricing sections
pass. No navigation redesign, hidden mobile feature or width-token change was made.

The initial-state axe matrix expanded from 26 to 36 routes, with **73 scans passing, zero
violations**, including phone More. Five normal rail widths and ten deliberately short 480 px
normal/reduced cases pass. A rerun of the sixteen older family probes passes Academy, exercise,
CRM, Funnel, Calendar, Reporting, Incident, sales, pricing, negotiation, Call Room, Fieldwork,
Portfolio, Clients, advanced Labs and advanced paths. Actual state assertions include failed
grading, refusal, missing evidence, save/read retry, controlled microphone/STT/feedback failure,
restart recovery and offline persistence. The older exercise probe now explicitly asserts these
invariants and checks the implemented Workflow runtime instead of silently reporting the old
Phase 9 placeholder as absent. The strengthened rerun passes. No assertion was weakened.

Restore, Search, all 30 signature-moment cases and the full 90-case CONNECT probe pass again.
Advanced Labs contribute 85 layouts and actual account-backed grading; paths contribute 45 layouts
over the shared graph. All use AI Off or explicitly controlled provider fixtures. Browser artifacts
are under `.review/phase-26-sweep/{layout,states,verified,native-pricing}`; the sequential
`phase-26-suite.mjs` preserves each child's raw log/result and fails on any child failure.

Visual review included Home 1440, Workflow 1024, CRM/Clients 768, Call Room/Search 390 and
Academy/Pricing 320, then Call Room loading and Portfolio export-failure captures. The latter exposed
an existing **3.53:1 error-text contrast bug**. Sync, session builder, Academy and runner recovery
copy now use the existing normal text role, as Field already does. All four new source regressions
failed before the correction; **98 tests / 5 files** pass afterward. The real intercepted
failed-link state produced axe's serious `color-contrast` failure before the fix and is added at
both CI widths, bringing the recurring gate to **75 scans**. The fixture prevents the generated
local key from leaving the browser and never records it. A server-startup race in the first rerun
was a connection refusal, not a product success; the suite now waits for bounded readiness.
The corrected build passes all **75 scans with zero violations** and the negative control, plus
all five Portfolio/export-recovery widths (`.review/phase-26-sweep/error-verified`).

All workspace typechecks, lint and the Preview build/provider-secret scan pass. The full simulator
subset exposed the new email fixture's invalid ID format: corrected it to `MSG-004`, retained the
three registry-integrity assertions in the filtered harness, then passed **100 tests / 4 files**
and **31 adversarial assertions / 11 files**, all fifteen cases. No registry rule was loosened.

Execution/network evidence: Academy does not execute the Workflow route; opening Workflow executes
its separate chunk. The existing Workbox policy nevertheless precaches Workflow JS/CSS in the
background, so PERF-001's “only likely next” condition remains unmet. Chrome DevTools MCP was not
configured; the web-performance skill's trace workflow was paused and setup requested. Repository
Chromium/CDP coverage, resource/cache inspection and source/build analysis were used instead. No
Lighthouse/CWV/MCP trace or reference-device benchmark is claimed.

Requirement-level disposition for I: DES-009's 104 px labelled rail and RSP-001's five required
widths have direct current evidence. DES-006/008/017/018 and RSP-002/003/004 retain their existing
cross-cutting statuses: state coverage has explicit open or unit-only cells, physical/long-session
comfort is not certified, and automation alone is not a blanket design acceptance. DES-010's
active-client clause remains open; DES-011 stays PASSED. DES-012's real directory still lacks
collectible covers; PORT-003 still has five rather than twenty projects. EXR-024 remains PARTIAL
with known exercise/judgment/content boundaries, not silently treated as full product completion.
No new out-of-v1 deferral, provider spend, migration or parked human-status change.

## Checkpoint I — reconciliation and independent-audit boundary

Promoted only these **twelve** directly evidenced requirements: PRD-015, PRD-016, HOL-005,
A11Y-010, DATA-009, INF-016, INF-017, GHL-008, CNT-010, DES-009, RSP-001 and INF-005. The first nine
are the implemented Phase 26/glossary contracts above; the last three have current full-width rail,
screen-width and actual CI/deploy-dependency evidence. INF-005's historical missing-simulator-test
note is obsolete: the complete suite executes the simulator and Worker regressions.

All **301 other statuses remain exactly as on audited Phase 25**. The roll-up is 313 requirements:
258 PASSED, 7 IN_PROGRESS, 20 PARTIAL, 12 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 14 NOT_STARTED;
none BLOCKED or FAILED. Control-doc validation checks consistency. Requirement scope/priority/IDs
were not weakened. The older 68–80 px acceptance line now correctly points to master §73/D-117's
104 px rail, and the adversarial list retains all fifteen cases.

### Remaining ledger disposition

| Retained scope | Evidence examined and why no blanket promotion |
|---|---|
| PRD-001/004/009; INF-001/006/007/008/018 | App route/dependency/data boundaries and actual AI-Off practical/Lab/Portfolio flows reviewed. Source search found no prohibited infrastructure or invasive analytics implementation. These broad all-phase architecture/product claims remain at baseline for independent requirement-level assessment; a negative source search or controlled subset is not treated as full audit certification. No commercial or analytics service was added. |
| PRD-014; DES-010/012; PORT-003 | New acknowledgements do not change unlock semantics. Home active-client coverage and collectible directory treatment remain incomplete; five projects are not the required twenty. No requirement is silently deferred. |
| EXR-006/007/008/009/024; PRI-001/002; NEG-003 | Real prediction/run and economic/negotiation flows were exercised. The documented replay placement, late-booking assertion, later-level content and broad/open-ended judgment boundaries remain; no paid quality experiment or pricing-scope change was authorized. |
| DES-006/008/017/018; RSP-002/003/004; A11Y-001; PERF-001 | Full five-width layout plus many actual state/input flows are recorded, but the matrix retains open/held-loading or unit-only cells, physical/long-session proof is absent, client covers remain unfinished and offline precache is broader than likely-next content. No Chromium-only blanket design, accessibility or performance certificate. |
| DATA-001; SYNC-007; INF-011 | Atomic local restore, no-coordinate sync, offline finalization, separate-device conflict and failure recovery regressions pass. Historical broad all-environment statuses remain for independent cross-cutting audit rather than being inferred solely from the new restore path. |
| DATA-006; INF-004; SEC-001/002/003; GHL-005/009/010 | No R2 recovery-backup/attachment flow or production reconfiguration was implemented. Both browser builds are secret-scanned; provider ownership/failure tests and registry references/limitations are checked. This is not a new whole-product credential history, production-data/public-media configuration or GHL terminology audit. The maintenance command does not re-research 89 features. |
| INF-015 | Independent no-coding auditor owns AUDIT_REPORT.md and the audit verdict. Remains NOT_STARTED; the implementation agent does not self-certify it. |
| PRD-005, CUR-015, CUR-031, EXR-015, EXR-020, CALL-002/005/006, FLD-001, VOI-006/007, SEC-005 | All twelve remain IMPLEMENTED_UNVERIFIED. Actual physical-device/privacy and Ary's real-GHL placement-to-capstone/reasoning acceptance remain required. Fictional media and seeded certificates are not that evidence. |
| FLD-003; SEC-006 | Original two DEFERRED rows unchanged: optional post-v1 GHL API inspection and commercial legal review. No new deferral. |

There are still **25 open P0 and 25 open P1 rows** (including the human/audit rows), so the
Field-Ready Complete gate is explicitly **not claimed**. Their exact IDs/statuses remain in the
baseline ledger and requirements matrix; this closeout is implementation evidence for independent
audit, not permission to merge, publish media, spend provider credits or deploy production.

Versions are unchanged: Node 22.23.2/npm 10.9.8; app 0.1.0, content 2026.09.27/hash
`f14486b89eaa1e66a9326128385748b31c1ad6986c7f25c81549db7d0cb899fc`, simulator 2026.09.23-r1,
mastery 2026.09.09-r5, grader 2026.09.22, IndexedDB 8. Still 400 source files, 58 skills,
54 units, 104 exercises, 10 campaigns, 89 registry features, 20 clients, five projects/two
templates. No content lock change, D1/IndexedDB migration or provider spend ($0).

Final verification uses a fresh `npm ci && npm run ci` under Node 22, then the committed final head's
GitHub Checks/Preview deploy (Production skipped). The final immutable source SHA, CI run/job
conclusions, Preview Worker version and browser/Worker IDs are attested on draft PR #28 **after this
document is committed**, avoiding a self-referential documentation SHA or testing an earlier head.
Only PR #28 receives the attestation; #24/#25/#26/#27 remain draft/unmerged and unmodified.

### Complete local verification

Fresh lockfile install and **complete `npm run ci` pass under Node 22.23.2**: all workspace
typechecks, ESLint (zero errors; the existing ExerciseRunner `context` dependency warning), full
format check, **2,040 tests / 148 files**, the **15/15 adversarial harness (31 executed assertions /
11 files)**, control-doc validation, content lock/schema validation, dated freshness report,
voice-manifest checks, app build/provider-secret scan and **75 actual axe scans with zero
violations**, including failed linking and the detected negative control. This includes simulator,
sync, restore, search, AI Off, timeout/budget/provider/transcription failures and signature/motion
regressions, not just focused samples. Local log: `/tmp/bloomlab-phase26-complete-ci.log`.

The fresh install reports five high-severity development-tool dependency advisories; the production
dependency audit reports **zero vulnerabilities**. No forced unrelated toolchain upgrade or hidden
audit suppression. The separately built Preview/provider-secret scan and H browser checks above
also pass. Final deployed probes repeat the required widths/new paths against the final SHA, not
the historical checkpoint heads. Their immutable record belongs to PR #28 as described above.

The first exact-head local production-mode probe caught a **probe selector defect**: six new
Phase 26 scripts read the build ID from `<html>` instead of the existing shell `[data-build-id]`.
Worker identity was correct; the browser value was absent, so assertions correctly failed rather
than accepting an earlier build. Corrected all six selectors to the published shell attribute and
added that identity contract to the existing App regression. No app identity, assertion equality,
requirement status or learner behavior was relaxed. The final head and CI attestation follow this
correction, not the superseded candidate `437051b`.

The deployed `e3c9fdac` candidate then exposed a **first-install readiness defect in two offline
probes**, not a cached-app reload failure: Search disconnected while the service worker was still
installing; the older Exercise probe's 15-second allowance also expired before installation.
A fresh Preview diagnostic observed the precache grow to 159 entries over about 40 seconds, then
activate/control the page and successfully reload Search offline. Both probes now require actual
activation/control with a bounded 60-second allowance **before** disconnecting, and require a
service-worker network-emulation target. Search additionally records the cached shell and asserts
that the NetworkOnly health request fails offline. No service-worker/cache policy, learner behavior,
offline reload assertion or status was relaxed. Corrected Search (25 width states, real attempt,
keyboard/touch/reduced motion, offline bookmark reload) and Exercise (offline submission/reload,
unchanged evidence counts and queued writes) both pass against that deployed candidate. The final
committed head's complete CI and deployed reruns supersede the failed candidate probe runs.
