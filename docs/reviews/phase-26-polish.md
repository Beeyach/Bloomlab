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
