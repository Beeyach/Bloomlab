# Phase 21 — Call Room review

Date: 2026-09-08. PR: [#23](https://github.com/Beeyach/Bloomlab/pull/23), draft/open, do not merge. Branch: `codex/phase-21-call-room`, based on independently merged main `3fa36fe05872bdaeaf5c49105a198b911aa9adce`. The branch began at handoff commit `f675f620c7dcdacbdc66015ce45298fcafe6a55a`.

**Preview acceptance is partial; PR #23 remains draft/open and unmerged.** The independent code audit covered `bd51ea70d72aededcd6f6aaf2394ade79e4337a0`; the only subsequent branch delta before execution was the new audit handoff. The user installed the Google preview secret, its `secret_text` type is verified, and preview calls are now enabled. Deployed Google recognition succeeds on a clearly labeled prerecorded fictional-audio diagnostic. Actual microphone calls at 390px and desktop, and successful authorized dynamic ElevenLabs synthesis/cache proof, remain outstanding. Production stays disabled. [Operations and remaining human checks](../operations/call-room.md).

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

Google STT uses Worker-only service-account RS256 OAuth, in-memory token reuse, V2 synchronous `us/chirp_3/en-US` with implicit recognizer `_` and auto-detected inline audio. The actual project is read only inside the Worker from the installed secret. Recognition authorization now succeeds in the supplementary live diagnostic; credential contents and exact IAM role configuration were not inspected. First-party model, IAM, decoding and quota documentation was checked on 2026-09-08; the runbook links it. Raw audio is never sent to Anthropic or ElevenLabs. Browser builds are scanned for provider endpoints/credential material.

Explicit moves/authored rules precede optional cheap classification; >=0.8 confidence is required. Authored fallback survives AI Off/budget/failure. Optional Full-mode strong tailoring only chooses a verifiable quote plus an authored question; all consequences stay in the existing engines. Durable attempt/turn/hash claims and per-stage usage IDs prevent duplicate purchases and advancement. Final feedback uses the server-confirmed call under `CALL_PERFORMANCE_RUBRIC_V1`, category `call_feedback`, with exact dimensions questions/listening/diagnosis/clarity/jargon/pitch_timing/objection_handling/next_step. Accent, pronunciation and STT correction are not grading dimensions; deterministic critical/required gates cannot be overridden by a favorable model judgment.

Exact available Phase 20 authored audio is preferred. Dynamic TTS accepts only saved authorized call text, with private owner/attempt/voice-settings identity and durable generation claims. Cached synthesis is reused; uncertain failures show client text. Static missing lines also show text. The unchanged 40 authored assets keep their existing provider-free playback and manifest.

## Requirement decisions

| Status | Requirements | Evidence/boundary |
| --- | --- | --- |
| PASSED | CALL-001, CALL-004 | Five-width local browser/UI review; six elements and advanced anchors absent from DOM. |
| IMPLEMENTED_UNVERIFIED | CALL-002, CALL-003, CALL-005, CALL-006, EXR-015, VOI-003, VOI-006, VOI-007, SEC-005 | Implementation and controlled tests/probes exist; the complete real-microphone/live-service checklist in the independent audit handoff is outstanding. Supplementary live results below do not close that gate. |

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

- Real microphone capture through the actual Call Room, including local-before-upload evidence and complete 390px touch/desktop keyboard calls. This Codespace exposes zero microphone inputs; no human participation result was received. Google binding installation and recognition authorization are now verified through live behavior.
- Finish the independent audit handoff on the enabled preview, including an actual authorized `dynamic: true` response followed by successful private ElevenLabs playback and cache reuse. One deliberately tight-budget call and two Full-mode clarification attempts kept authored fallback text; none produced an authorized dynamic line. No arbitrary-text synthesis or forced server state was used to manufacture a pass.
- Physical mobile/Safari MediaRecorder formats, storage behavior and assistive technology are unverified. The automated virtual microphone and emulated viewport are not physical hardware evidence.
- Abandoned raw recordings have no timed deletion job; learner resume/manual deletion handles them. Unknown purchased dynamic synthesis requires operator reconciliation; it is never silently purchased twice. Calls have no full-duplex streaming, background STT or cross-device active-call resume.
- A final independent audit of the new head, production Google/current ElevenLabs secret setup where required, and reviewed production gate change remain before production readiness. No merge or production deployment is authorized by this implementation report.


## Publication and deployed preview evidence

Implementation head: **`9ee8b3c6f971d783969719f6cdcdaf3f618afa10`**. [CI run 34184504981](https://github.com/Beeyach/Bloomlab/actions/runs/34184504981) SUCCESS: Checks SUCCESS, 1,741 tests / 106 files, Preview deploy SUCCESS, production correctly SKIPPED. CI applied `0004_call_room.sql` to development D1 before deploying `bloomlab-preview`; the emitted Worker version was **`6043553d-a23d-4c56-9e54-de7a5ae8cee3`**. No production Worker deployment ran.

Live checks ran on [preview](https://bloomlab-preview.cool-sunset-2169.workers.dev) starting 2026-09-08 03:51 UTC:

- Health returned HTTP 200, environment preview, app 0.1.0, content 2026.09.18, simulator 2026.09.11-r2. An authenticated call configuration read returned `enabled: false`; anonymous call configuration returned 401; the direct SAY IT route showed its disabled state. This verifies the intended gate, not live call acceptance.
- The two-device sync probe passed local-before-sync, remote receipt, offline edits, conflict preservation/convergence, deletion propagation and device revocation. A subsequent metadata-only D1 query confirmed both disposable sync devices were revoked (2/2). The cleanup now also revokes the coordinator.
- Real Phase 20 voice playback passed at all five widths, with actual browser decoding, stable character identity, private unauthenticated 401 and no direct ElevenLabs request. All five greetings decoded (4.09–5.53 seconds); cached playback made zero purchases. Revocation was enforced and authored text survived. This is saved-asset evidence, not dynamic Phase 21 TTS evidence.
- The gate-review and voice-review devices were revoked too. No session tokens, Sync Keys, provider credentials or learner microphone bytes are included in committed evidence.

Machine-readable, non-secret results are in [phase-21-call-evidence.json](phase-21-call-evidence.json). Browser captures remain local/ignored under `.review/phase-21-call/`, `.review/phase-21-regression/`, `.review/phase-21-live-sync/` and `.review/phase-21-live-voice/`.

The publication closeout changes documentation/evidence only after the implementation head above. Its exact-head Checks and preview rollout are available in [PR #23 checks](https://github.com/Beeyach/Bloomlab/pull/23/checks) and the final implementation report. Keeping that distinction avoids attributing earlier deployed observations to a later documentation commit. PR #23 remains draft/open; no merge is performed.

## Independent audit handoff execution — partial preview acceptance

The user confirmed Google secret installation before enabling preview. The focused gate commit is `0a53c9b1c47df7f79d46707297ab273b52be575c`. [CI 34189056984](https://github.com/Beeyach/Bloomlab/actions/runs/34189056984) passed Checks and Preview deploy, with Production deploy SKIPPED and no pending development migration. Provider diagnostics ran only after that exact head deployed as Worker version `d3e2888f-e7a1-413b-95fb-cc292f115b58`.

That deployed review found a real phone-input issue: notes inherited 14px from the sidebar, and move selectors inherited their label size. `1b89de9325466fbf3d243c14105a3aa07e4070bf` sets call text inputs/selects to 16px and extends the browser probe to check notes, transcript and move controls at 390/320. The controlled browser regression passes, including full touch/keyboard fixture calls. [CI 34190127856](https://github.com/Beeyach/Bloomlab/actions/runs/34190127856) passes all checks and preview deployment; Worker version `c1b9b495-2dd7-45cb-901b-39540444b1c2` serves that exact runtime head. Both runs pass **1,743 tests / 106 files**, with the one existing ExerciseRunner lint warning, unchanged content warnings, docs/content lock/voice checks, production build and no pending `0004` migration. Production deployment is SKIPPED. The provider implementation is unchanged between these two heads. The preview build's local-emulation warning lists required secrets because build-time values are intentionally absent; deployment and live recognition separately verify the installed Worker binding.

### Supplementary live evidence and remaining handoff gates

The input source was the existing fictional Gary greeting from the private Phase 20 library, converted in the browser using Web Audio and native MediaRecorder. There were **no fixture HTTP/provider responses** in these diagnostics, but this was **not human microphone audio**, and API confirmation did not exercise the Call Room's local confirmation queue. All generated raw diagnostic objects were deleted, all review devices revoked, and only sanitized metadata is retained. A request observer lost its local log during two cleanup callbacks; scoped D1 reads independently confirmed those devices were already revoked. Neither failure is reported as a passed browser assertion.

| Handoff item | Result and evidence boundary |
| --- | --- |
| Exact head | Runtime acceptance head `1b89de9325466fbf3d243c14105a3aa07e4070bf`; provider diagnostic head `0a53c9b1c47df7f79d46707297ab273b52be575c`. This subsequent closeout changes docs/evidence only; its exact head/run are recorded in the PR and final report. |
| CI | Runs `34189056984` and `34190127856`: Checks SUCCESS, Preview deploy SUCCESS, Production deploy SKIPPED. All required checks pass as detailed above. |
| Preview version | Provider diagnostics: `d3e2888f-e7a1-413b-95fb-cc292f115b58`; input-fix/deployed UI review: `c1b9b495-2dd7-45cb-901b-39540444b1c2`. |
| Google binding | `GOOGLE_CLOUD_CREDENTIAL`, Worker `secret_text`, preview only. No value, service-account JSON, project identifier, private key or access token inspected. |
| Google authorization | Seven successful recognition requests returned HTTP 200 using the configured `us/chirp_3/en-US` V2 path. This verifies working recognition authorization, not the exact IAM role or billing configuration. |
| Real microphone/local Blob | **Outstanding.** The Codespace exposes zero audio inputs and no human microphone result was received. Diagnostic source: WebM/Opus, 68,882 bytes, 4,273ms. The real local-before-upload queue remains supported by controlled browser tests only. |
| Private R2/D1 | Remote `bloomlab-media-dev` objects existed before recognition; authenticated bytes matched checksums. D1 metadata matched recording IDs, attempt/turn, MIME, byte length and duration; the schema has no BLOB/base64 audio column. Seven disposable recording objects were subsequently removed. |
| Transcript/confirmation | Real Google returned the fictional greeting. Deliberately non-sensitive corrected text was confirmed through authenticated API calls, drove authored transitions and remained after raw deletion. Visible original/corrected transcript review through an actual microphone UI flow remains outstanding. |
| Failure/recovery | One disposable D1 byte-length value was temporarily increased by one. The deployed bounds check returned sanitized `404 recording_not_found`, marked `stt_failed`, and preserved R2 bytes. The value was restored in `finally`; retry returned Google HTTP 200 using the same object/checksum and one observed upload. This is a live storage-boundary fault, not a Google outage. |
| Default/retained deletion | Four confirmed unretained API acknowledgements removed actual R2 objects and preserved confirmed text. Retained diagnostic audio decoded/replayed for 4.26 seconds; explicit deletion removed R2 bytes and playback then returned 410. The real browser confirmation-checkpoint-before-delete ordering still needs human microphone acceptance. |
| Authorization | Anonymous recording reads: 401. Another learner's fetch/delete: 403. Revoked outsider recording reads: 401. Scoped D1 reads confirm diagnostic owner devices revoked. No public/signed bypass was used. |
| Dynamic TTS/cache | **Outstanding.** Available Phase 20 authored audio was returned with `source: authored, cached: true`. The tight-budget path and two Full-mode clarification attempts retained authored fallback (`dynamic: false`). No authorized dynamic line reached ElevenLabs; there is no successful synthesis/cache or provider-billing delta claim. Do not force state or relax quote validation to manufacture one. |
| Egress | Observed browser request/resource origins were Bloomlab only. Server raw-audio exclusion from Anthropic/ElevenLabs remains supported by the independent audit and exact-head regression suite; no provider packet trace is claimed. |
| AI routing/retries | Deployed AI Off advanced through authored fallback with zero spend. The tight-budget path preserved fallback. Explicit, single-branch and authored-rule choices advanced without classification purchases; identical confirmed-turn retries returned identical state. Two Full-mode attempts also retained authored fallback. Total recorded Anthropic usage across the three diagnostics was $0.009143; no residual reservation remains. |
| Final grading | One completed API call returned HTTP 200, score 82, all eight rubric items and `call_feedback` usage. Changing arbitrary browser submission text returned the identical saved rubric run, supporting server-confirmed reconstruction. Deterministic critical/required override remains covered by exact-head tests; no separate favorable-model critical-failure live case was purchased. |
| Full call UX | The fixed deployed UI has no overflow, 16px notes inputs, 44px button heights, six room elements and no advanced anchors at all five widths; desktop focus is visible. A controlled browser transport failure keeps client text usable and Continue works. Native microphone calls count 0 before Record and 1 afterward, with zero audio devices. Controlled fixture calls complete with 390px touch and desktop keyboard. **Actual microphone/STT completion on both input modes remains outstanding.** |
| Requirement changes | None. CALL-001/CALL-004 remain PASSED; the nine live-acceptance rows remain IMPLEMENTED_UNVERIFIED. Roll-up and unrelated carryovers are unchanged. |
| Limitations | Real microphone/local queue/visible transcript acceptance, full touch/keyboard voice calls, successful dynamic TTS/cache, physical Safari/iOS and exact IAM-role inspection remain unverified. Existing abandoned-recording retention and uncertain-provider reconciliation limitations remain. |
| Production/PR | Production browser flag remains false; the Worker hard gate refuses new production calls even with accidental preview-style vars. No production Google secret requirement was added, no production deployment ran, and PR #23 remains draft/open and unmerged. |

Machine-readable results are added to `phase-21-call-evidence.json`. The local diagnostic reports and captures live under ignored `.review/phase-21-live-acceptance/`; no raw audio, Sync Key, session token or provider credential is included in committed evidence. The remaining human workflow is in the operations runbook. Full acceptance and production readiness are not claimed.
