# Phase 21 — Call Room review

Date: 2026-09-08. PR: [#23](https://github.com/Beeyach/Bloomlab/pull/23), draft/open, do not merge. Branch: `codex/phase-21-call-room`, based on independently merged main `3fa36fe05872bdaeaf5c49105a198b911aa9adce`. The branch began at handoff commit `f675f620c7dcdacbdc66015ce45298fcafe6a55a`.

**Implementation is under review; live provider acceptance is incomplete.** Preview's name-only secret listing lacked `GOOGLE_CLOUD_CREDENTIAL`. The user has been given the exact secure installation action from handoff §25. No fixture result is presented as live Google, IAM, dynamic ElevenLabs or physical microphone evidence. Preview/production calls stay off and the PR stays draft/open, unmerged. [Secure setup and recovery runbook](../operations/call-room.md).

## Implementation

One content-selected `CallRoom` renders inside the existing exercise runner and attempt/evidence path. The five exercises are:

| Exercise | Voice mode | Training mode | Existing engine |
| --- | --- | --- | --- |
| `EX-SAY_IT-northwind-cold-call` | Cold call | Guided | Conversation |
| `EX-SAY_IT-summit-discovery` | Discovery | Practice | Conversation |
| `EX-SAY_IT-summit-proposal` | Proposal presentation | Independent | Conversation |
| `EX-SAY_IT-summit-negotiation` | Negotiation | Practice | Negotiation + pricing |
| `EX-SAY_IT-glowhaus-client-explanation` | Client explanation | Pressure | Conversation |

The original pure conversation/negotiation/pricing code now lives in `packages/exercise-engine`; existing browser paths re-export it. Worker call adapters use the same transitions, authored scenarios, hidden state and economic rules. There are no five hardcoded call pages and no LLM-owned scenario changes. Content validation checks mode/engine compatibility, node/rule references, advanced aid exclusion, exact eight-item rubric and authored voice text/ownership. Cross-exercise Boss Client continuity remains Phase 24.

The room has six elements on a quiet dark surface: client identity, company, objective, audio state, elapsed time and notes drawer. Initials identify the authored client; no participant tiles, synthetic waveform, avatar, eyebrow or monospace. Guided/practice anchors are secondary; independent/pressure aids are absent from the DOM.

Explicit phases cover ready, microphone permission, client speaking, learner ready, recording, locally saved, uploading, transcribing, transcript review, evaluating, resolving, TTS loading, text fallback, complete and recoverable error. The MediaRecorder capability order is WebM/Opus, MP4/AAC, then supported Ogg/Opus; each turn is limited to 55 seconds/8 MiB. Actual virtual-microphone WebM is decoded in the browser probe. Physical Safari/iOS recording is not verified.

Raw Blobs live in a separate local-only Dexie v5 table before any upload. Call metadata/transcript/notes use optional `ActiveAttempt.response.call` through the existing write queue, with no raw audio in the sync outbox. Original and corrected transcripts remain distinct, confirmation is required, and only confirmed text enters roleplay/feedback. A finalization correction preserves the guided assistance floor in both grade and saved evidence. A retry correction prevents a new attempt from inheriting the previous completed call.

Migration `0004_call_room.sql` adds four metadata/text tables; applied migrations are unchanged. Private R2 raw keys are Worker-derived `call/raw/v1/{recording_id}.audio`, with owner/attempt/turn/checksum metadata and idempotent R2-first recovery. Every recording/voice path checks learner ownership and current device revocation. Default cleanup follows a saved confirmed branch, retained audio needs explicit deletion, and failed/replaced audio is recoverable until replacement confirmation. No scheduled expiry sweep is claimed.

Google STT uses Worker-only service-account RS256 OAuth, in-memory token reuse, V2 synchronous `us/chirp_3/en-US` with implicit recognizer `_` and auto-detected inline audio. The actual project comes from the missing Worker secret and is not known/verified. First-party model, IAM, decoding and quota documentation was checked on 2026-09-08; the runbook links it. Raw audio is never sent to Anthropic or ElevenLabs. Browser builds are scanned for provider endpoints/credential material.

Explicit moves/authored rules precede optional cheap classification; >=0.8 confidence is required. Authored fallback survives AI Off/budget/failure. Optional Full-mode strong tailoring only chooses a verifiable quote plus an authored question; all consequences stay in the existing engines. Durable attempt/turn/hash claims and per-stage usage IDs prevent duplicate purchases and advancement. Final feedback uses the server-confirmed call under `CALL_PERFORMANCE_RUBRIC_V1`, category `call_feedback`, with exact dimensions questions/listening/diagnosis/clarity/jargon/pitch_timing/objection_handling/next_step. Accent, pronunciation and STT correction are not grading dimensions; deterministic critical/required gates cannot be overridden by a favorable model judgment.

Exact available Phase 20 authored audio is preferred. Dynamic TTS accepts only saved authorized call text, with private owner/attempt/voice-settings identity and durable generation claims. Cached synthesis is reused; uncertain failures show client text. Static missing lines also show text. The unchanged 40 authored assets keep their existing provider-free playback and manifest.

## Requirement decisions

| Status | Requirements | Evidence/boundary |
| --- | --- | --- |
| PASSED | CALL-001, CALL-004 | Five-width local browser/UI review; six elements and advanced anchors absent from DOM. |
| IMPLEMENTED_UNVERIFIED | CALL-002, CALL-003, CALL-005, CALL-006, EXR-015, VOI-003, VOI-006, VOI-007, SEC-005 | Implementation and controlled tests/probes exist; the deployed real-provider/microphone checklist in handoff §27 is outstanding. |

No broad responsive/privacy/infrastructure row is promoted. DATA-007 stays PASSED with additional recording scope tests. PRI-001, PRI-002, NEG-003 and EXR-024 carryovers stay PARTIAL. Roll-up: 313 total, 191 PASSED, 8 IN_PROGRESS, 23 PARTIAL, 9 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 80 NOT_STARTED.

## Verification evidence

Local verification uses Node 22.22.1, Wrangler 4.128.0 and the existing locked dependencies. Typecheck, lint (one pre-existing ExerciseRunner hook warning), format, docs validation, content lock/check, voice check, production build and preview build pass. Content: 154 files, 35 exercises, eight rubrics, 31 unchanged authoring warnings. The full suite passed **1,740 tests in 106 files**; the subsequent upload-failure/oversize boundary additions passed their focused **24-test** run. GitHub Actions on implementation head `9ee8b3c6f971d783969719f6cdcdaf3f618afa10` passed the final combined **1,741 tests in 106 files**. No live call provider request has been made during implementation.

The dedicated call probe passes at **1440/1024/768/390/320**, with no page overflow, full four-turn feedback at 390 using touch controls/text input, a second full desktop keyboard call, visible focus, denial recovery, reduced motion, original/corrected transcript, real local Blob-before-upload, STT failure/retry without a second upload, retained-audio reload/replay/deletion and default cleanup. Browser decoding of the virtual recording measured **0.84 seconds, one channel, 44,100 Hz**. Captures at 1440/390/320 were visually inspected. Probe typing waits for the transcript field to become editable so it verifies actual corrections.

Existing **exercise, negotiation, rail/navigation and AI** probes pass against the built preview bundle/local Worker. Exercise covers offline submission/history/outbox/reload; negotiation covers all five widths, touch/keyboard and reduced motion; AI covers failed submission/reload and explicit fixture success at five widths. Auth/sync and real Phase 20 voice playback also pass on the deployed PR preview, as recorded below. Earlier diagnostic failures are not counted as passes.

Focused tests cover native recording capability/limits/track cleanup, Blob-before-upload and retry/checkpoint ordering, notes/reload/history, raw sync exclusion, authenticated D1/R2 operations, collision/ownership/revocation, real deletion and R2-first recovery, Google JWT signature/token caching/expiry/timeout/sanitization, all five authored modes, durable classifier claims/budget/fallback, constrained dynamic TTS/caching, server-confirmed final feedback and grading gates.

`scripts/review/call-probe.mjs` is a repeatable controlled browser probe. HTTP fixtures and a virtual microphone are declared in both source and report. It uses real IndexedDB/MediaRecorder and touch/key events; it does not establish deployed provider acceptance. Captures/reports are under ignored `.review/phase-21-call/`.

## Versions

| Contract | Base | Phase 21 |
| --- | --- | --- |
| App | 0.1.0 | unchanged |
| Content | 2026.09.17 | 2026.09.18, lock regenerated |
| Content schema | 1 | unchanged |
| Exercise grader | 2026.09.17 | 2026.09.18: call projection/required gates and saved assistance consistency |
| IndexedDB | 4 | 5: separate local-only raw recording table |
| Simulator | 2026.09.11-r2 | unchanged |
| Mastery | 2026.09.03-r4 | unchanged |

## Outstanding acceptance

- Secure Google project/API/IAM setup and preview `GOOGLE_CLOUD_CREDENTIAL`; verify actual project and recognition permission. The rotated preview ElevenLabs key already exists as a Worker secret; do not revive the old credential.
- Enable only the configured preview, then prove every live handoff §27 step: real microphone/local checkpoint/upload/private remote R2/Google transcript/confirmation/branching, scoped failures and deletion, provider egress, touch and keyboard completion, real dynamic synthesis and repeated cache reuse.
- Physical mobile/Safari MediaRecorder formats, storage behavior and assistive technology are unverified. The automated virtual microphone and emulated viewport are not physical hardware evidence.
- Abandoned raw recordings have no timed deletion job; learner resume/manual deletion handles them. Unknown purchased dynamic synthesis requires operator reconciliation; it is never silently purchased twice. Calls have no full-duplex streaming, background STT or cross-device active-call resume.
- Independent PR audit, production Google/current ElevenLabs secret setup where required, and reviewed production gate change remain before production readiness. No merge or production deployment is authorized by this implementation report.


## Publication and deployed preview evidence

Implementation head: **`9ee8b3c6f971d783969719f6cdcdaf3f618afa10`**. [CI run 34184504981](https://github.com/Beeyach/Bloomlab/actions/runs/34184504981) SUCCESS: Checks SUCCESS, 1,741 tests / 106 files, Preview deploy SUCCESS, production correctly SKIPPED. CI applied `0004_call_room.sql` to development D1 before deploying `bloomlab-preview`; the emitted Worker version was **`6043553d-a23d-4c56-9e54-de7a5ae8cee3`**. No production Worker deployment ran.

Live checks ran on [preview](https://bloomlab-preview.cool-sunset-2169.workers.dev) starting 2026-09-08 03:51 UTC:

- Health returned HTTP 200, environment preview, app 0.1.0, content 2026.09.18, simulator 2026.09.11-r2. An authenticated call configuration read returned `enabled: false`; anonymous call configuration returned 401; the direct SAY IT route showed its disabled state. This verifies the intended gate, not live call acceptance.
- The two-device sync probe passed local-before-sync, remote receipt, offline edits, conflict preservation/convergence, deletion propagation and device revocation. A subsequent metadata-only D1 query confirmed both disposable sync devices were revoked (2/2). The cleanup now also revokes the coordinator.
- Real Phase 20 voice playback passed at all five widths, with actual browser decoding, stable character identity, private unauthenticated 401 and no direct ElevenLabs request. All five greetings decoded (4.09–5.53 seconds); cached playback made zero purchases. Revocation was enforced and authored text survived. This is saved-asset evidence, not dynamic Phase 21 TTS evidence.
- The gate-review and voice-review devices were revoked too. No session tokens, Sync Keys, provider credentials or learner microphone bytes are included in committed evidence.

Machine-readable, non-secret results are in [phase-21-call-evidence.json](phase-21-call-evidence.json). Browser captures remain local/ignored under `.review/phase-21-call/`, `.review/phase-21-regression/`, `.review/phase-21-live-sync/` and `.review/phase-21-live-voice/`.

The publication closeout changes documentation/evidence only after the implementation head above. Its exact-head Checks and preview rollout are available in [PR #23 checks](https://github.com/Beeyach/Bloomlab/pull/23/checks) and the final implementation report. Keeping that distinction avoids attributing earlier deployed observations to a later documentation commit. PR #23 remains draft/open; no merge is performed.
