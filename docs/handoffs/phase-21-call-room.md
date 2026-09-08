# Phase 21 - Call Room

Implementation handoff for `Beeyach/Bloomlab`.

Model: Codex Astra High.

Do not merge your own PR. ChatGPT performs the independent audit, exact-head CI verification, merge decision, and production verification.

## 1. Exact starting point

Phase 20 is closed and production-green.

Verified `main` baseline for this branch:

`3fa36fe05872bdaeaf5c49105a198b911aa9adce`

Branch already created from that exact SHA:

`codex/phase-21-call-room`

Before changing code:

1. `git fetch origin`
2. verify `origin/main`
3. inspect any legitimate newer main delta instead of resetting/discarding it
4. remain on `codex/phase-21-call-room`
5. do not work on `main`

## 2. Read source of truth before implementation

Read completely before planning edits:

- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md`
- `BLOOMLAB_MASTER_SPEC.md`, especially §§117-120, §149 and §152
- `TECH_ARCHITECTURE.md`
- `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md`, especially TA§§45-49 and storage/privacy sections
- `EXERCISE_ENGINE.md`
- `CONTENT_ARCHITECTURE.md`
- `DESIGN_SYSTEM.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `docs/reviews/phase-19-ai-gateway.md`
- `docs/reviews/phase-20-voice-assets.md`
- `docs/operations/voice-assets.md`

Then inspect current code around:

- `apps/web/src/exercise/ExerciseRunner.tsx`
- `apps/web/src/exercise/finalize.ts`
- `apps/web/src/exercise/attempt.ts`
- `apps/web/src/exercise/response.ts`
- `apps/web/src/exercise/runtime.ts`
- `apps/web/src/exercise/sales/`
- current conversation/discovery projections
- current negotiation engine
- current AI client/evaluation path
- current Dexie schema and local persistence queue
- `worker/src/ai/`
- `worker/src/voice/`
- `worker/src/index.ts`
- `worker/wrangler.jsonc`
- `migrations/0001_init.sql` through `0003_media_assets.sql`
- current content schemas, clients, voice characters, scenarios, exercises and rubrics

Do not design Phase 21 from this handoff alone. Reconcile it with live code first.

## 3. Phase 21 requirements that must actually work

Target the live requirements, not a demo shell.

### CALL-001

Call Room is minimal, immersive and dark. It shows:

1. client identity
2. company
3. objective
4. audio state
5. elapsed time
6. notes drawer

No participant grid. No fake Zoom layout. Very low information density.

### CALL-002

Turn-based v1 must work end to end:

`client audio -> learner response -> record -> transcribe -> show transcript -> evaluate/update scenario -> next client response`

No full-duplex realtime telephony, WebRTC room, streaming STT, always-open microphone, or Durable Object realtime system.

### CALL-003

Call grading has exactly these eight dimensions:

- questions
- listening
- diagnosis
- clarity
- jargon
- pitch timing
- objection handling
- next step

Accent is never a grading criterion or proxy criterion.

### CALL-004

Early/guided practice may show discovery anchors. More advanced independent/pressure calls remove those aids.

### CALL-005

Mobile-first. A complete call must work at 390 px with touch only.

### CALL-006

Transcript saved by default. Raw learner audio is temporary by default, optional to retain, and user-deletable.

### EXR-015

All five SAY IT practice modes exist as real content/runtime behavior:

- cold call
- discovery
- proposal presentation
- negotiation
- client explanation

### VOI-003

Dynamic ElevenLabs TTS only where genuinely open-ended roleplay needs it. Prefer Phase 20 pre-generated R2 audio whenever a reusable authored line can serve the turn. Cache reusable dynamic results.

### VOI-006

Google Cloud Speech-to-Text V2, turn-based:

`record locally -> upload through Bloomlab Worker -> transcribe -> show transcript -> evaluate`

No direct browser-to-Google call.

### VOI-007

- TTS failure: show client text fallback and continue.
- STT failure: preserve recording and let learner retry transcription or re-record.

### SEC-005

Private learner recordings are never silently sent to unrelated services.

## 4. Preserve the generic exercise architecture

Do not build five bespoke SAY IT React pages.

`/exercise/:exerciseId` remains the generic exercise entry. SAY IT may mount an immersive `CallRoom` work area/runtime from that route, but behavior must be selected from compiled content, not authored exercise IDs hardcoded into JSX.

Adding another SAY IT exercise should normally mean adding content data, not another screen implementation.

Use the existing attempt identity, response, queued write path, finalization and evidence model. Do not create a second progress system.

## 5. Call Room state machine

Model explicit states instead of scattered booleans. At minimum handle:

- ready / waiting for learner start
- microphone permission requested by user action
- client speaking
- ready for learner
- recording
- recording stopped / saved locally
- uploading
- transcribing
- transcript review
- evaluating learner turn / updating scenario
- resolving next client response
- client TTS loading
- client text fallback
- complete
- recoverable error

Microphone permission must be requested only after an intentional learner action, never automatically on page load.

The Call Room must survive refresh/reload without pretending a lost in-memory recording still exists.

## 6. Local-first raw recording safety

A learner's just-recorded response must exist locally before network upload begins.

Preferred architecture:

- add a dedicated local-only Dexie table for call recording blobs
- key by a stable `recording_id`
- associate with attempt ID and turn ID/index
- store MIME type, byte length, checksum/state and the Blob
- bump the IndexedDB schema version correctly
- do not put raw blobs into sync entities or the sync outbox

The active call transcript/state belongs in the existing `ActiveAttempt.response` shape, for example a version-tolerant `call?` property, and changes go through the existing attempt write queue.

Do not rewrite finalized historical attempts.

If retention is off, local raw audio can be deleted only after the transcript/call state needed for recovery has been safely checkpointed. On STT/upload failure, keep it.

## 7. Browser recording format and limits

Use `MediaRecorder` with capability negotiation, not one assumed MIME type.

Prefer formats current Google STT V2 auto-decoding supports and browsers actually produce. A reasonable order is:

1. WebM/Opus when supported
2. MP4/AAC or M4A-compatible recording where Safari supports it
3. another explicitly verified Google-supported browser recording format

Do not add a third-party audio conversion service just to normalize formats.

Reverify current Google STT V2 supported decoding formats before final code. Current research as of 2026-09-07/08 indicates auto-detect supports WebM/Opus and MP4/M4A AAC among other standard formats.

Keep each learner turn safely inside synchronous STT limits. Current V2 synchronous `Recognize` documentation caps a request at 10 MB or 1 minute, whichever comes first. Use a product limit below both, for example about 55 seconds and <= 8 MiB, after verifying current limits.

Stop recording cleanly at the cap and tell the learner why. Never discover the limit only after upload fails.

## 8. Private recording storage in R2

Raw learner recordings are private learner assets.

Do not try to force them into Phase 20's voice-specific `media_assets` schema if that creates awkward or dishonest columns. `0003_media_assets.sql` currently describes generated client voice audio and must not be edited.

Add a new migration, likely `0004_call_room.sql`, with the minimum real metadata needed for call recordings/transcripts/call sessions.

A clean recording metadata contract may include:

- recording_id
- learner_id
- attempt_id
- exercise_id
- call/turn identifier
- object_key
- MIME type
- byte length
- checksum
- created timestamp
- transcription state
- original STT transcript
- learner-corrected transcript if applicable
- retention preference
- deleted timestamp/state

D1 stores metadata/text only. R2 stores audio bytes.

Use deterministic normalized object paths under a learner-owned namespace. Never accept an object key from the browser.

Upload must be idempotent by stable recording ID plus checksum. Same ID/different bytes is a conflict, not silent replacement.

## 9. Google Cloud Speech-to-Text V2 provider

Implement Google STT behind the Worker only.

Prefer a focused, injectable provider using direct REST calls over pulling a large SDK into the Worker unless there is a concrete benefit.

Current verified research baseline, reverify against official docs during implementation:

- API: Speech-to-Text V2
- short-turn flow: synchronous `Recognize`
- endpoint shape: `POST https://speech.googleapis.com/v2/{recognizer=projects/*/locations/*/recognizers/*}:recognize`
- implicit recognizer `_` is supported by current docs
- current modern model identifier includes `chirp_3`
- current synchronous limit is 10 MB or 1 minute
- OAuth scope: `https://www.googleapis.com/auth/cloud-platform`
- minimum predefined IAM role for recognition is `roles/speech.client`

Do not blindly choose a region. Verify the desired recognition model/language is available there for the configured project. `asia-southeast1` may be attractive for Philippine latency only if current Google docs/project support the chosen model and `en-US`; otherwise use a verified supported region such as the appropriate `us` multi-region. Record the verification date and final choice.

### Google credential

Use a Worker secret named:

`GOOGLE_CLOUD_CREDENTIAL`

Never browser env, Vite env, Git, content, D1, R2 metadata, logs or screenshots.

If using a service-account JSON credential, parse it server-side, sign the OAuth JWT assertion with WebCrypto/RS256, exchange it for an access token at Google's OAuth token endpoint, and keep the short-lived access token only in isolate memory until near expiry. Do not persist access tokens in D1.

Use least privilege. Do not grant owner/editor just to make the probe pass.

## 10. Transcription API behavior

Use authenticated Worker routes with bounded request sizes and explicit content types.

The browser should submit only:

- stable recording ID
- attempt/exercise/turn identity
- audio bytes
- safe MIME metadata
- retention preference

The server derives the learner ID from the authenticated device session.

Recommended lifecycle:

1. validate session and authored SAY IT attempt/exercise
2. validate MIME/size/recording identity
3. write raw bytes to private R2 first
4. persist metadata/claim
5. call Google STT
6. store original transcript/status
7. return transcript

If Google fails after R2 write, return a recoverable transcription error with the existing recording ID. Retry transcription should read the existing R2 object and must not require re-upload/re-record.

Never send the recording to Anthropic.

## 11. Transcript review and grading fairness

The transcript must be visible to the learner before evaluation.

Strongly prefer allowing correction of obvious STT mistakes before grading, because STT/accent quality must not become a hidden grading criterion.

If corrections are allowed, preserve both:

- original STT transcript
- learner-confirmed/corrected transcript

Grade the learner-confirmed transcript. Keep correction transparent in the attempt metadata, not as a score penalty.

Do not infer pronunciation, accent, vocal attractiveness, gender, ethnicity or other personal traits from audio.

## 12. Hard privacy boundary between services

Enforce this in code and tests:

### Learner raw audio may travel only

`browser -> Bloomlab Worker -> private R2 -> Google Speech-to-Text V2`

### Anthropic receives

transcript text and authored scenario/rubric context only.

### ElevenLabs receives

client response text and the fictional client's authored voice settings only.

Learner raw audio must never be sent to Anthropic or ElevenLabs.

Add source/build/provider-boundary tests that fail if browser code directly calls Google Speech, Anthropic or ElevenLabs provider endpoints.

## 13. Turn intelligence, minimal AI first

Keep Bloomlab's existing hierarchy:

`code -> deterministic rules -> authored branches -> lightweight classifier -> full LLM judgment`

Do not make Claude the call engine.

For each learner transcript:

1. update deterministic measures and authored call progress
2. classify into an authored move/intent when a cheap classifier is genuinely needed
3. deterministic code applies hidden-state/conversation consequences
4. choose an authored next line when one exists
5. only for truly open-ended roleplay, strong Claude may verbalize an already-authorized response goal

Claude must not invent:

- hidden-state deltas
- client economics
- budget
- scope/concessions
- client history/facts
- arbitrary new consequences

If AI is Off, budget-refused, unavailable or low-confidence, use the authored fallback and let practice continue.

Idempotency is mandatory. A retry/reload of the same attempt + turn + transcript hash cannot create duplicate Claude spend or a different branch by accident.

## 14. Reuse current conversation and negotiation systems

Do not create a third parallel sales-dialogue engine unless the live code proves reuse is impossible.

The existing written conversation graph already models:

- client nodes
- learner moves
- authored fallbacks
- discovery topics
- diagnosis agreement
- pitch timing
- talk-share projections

The negotiation system already owns negotiation strategy/state consequences.

Prefer extending/adapting those content-driven concepts for spoken turns while preserving deterministic authority.

The call runtime can add audio/transcription orchestration without duplicating the underlying scenario logic.

## 15. Five real SAY IT modes

Author real content for all five modes:

1. Cold call
2. Discovery
3. Proposal presentation
4. Negotiation
5. Client explanation

Use persistent fictional clients and Phase 20 voice characters where appropriate.

Each exercise needs a real objective, scenario/call configuration, actual turns and grading path. No placeholder button, static transcript, screenshot-only flow, or "coming soon" shell counts.

Do not hardcode the five exercise IDs into React.

Because this is new curriculum/content, bump `content_version` and regenerate the content lock.

## 16. Discovery anchors

For guided/early calls, provide concise optional anchors such as the discovery areas the learner should remember.

Do not give the learner exact sentences to repeat unless the authored exercise is deliberately guided that strongly.

Independent and pressure-mode calls must remove the aids rather than merely hide them visually while leaving them accessible in the DOM.

## 17. Call grading rubric

Create a versioned SAY IT call-performance rubric owned by content.

It must explicitly cover the eight CALL-003 dimensions:

1. questions
2. listening
3. diagnosis
4. clarity
5. jargon
6. pitch timing
7. objection handling
8. next step

Do not add accent, pronunciation, native-like speech, voice quality or fluency-as-accent criteria.

The current discovery rubric may still be useful for discovery-specific topic coverage, but CALL-003 needs an auditable general call rubric/contract. Design the rubric composition honestly after inspecting the current grader. Do not claim eight dimensions if the stored result cannot identify them.

Use strong-model grading only where the rubric needs semantic judgment. Deterministic objective failures remain authoritative.

Final SAY IT AI evaluation should account under the existing `call_feedback` category, not `written_coaching`.

## 18. Dynamic client TTS

Phase 20 pre-generated R2 lines are preferred whenever an authored line fits.

Use dynamic ElevenLabs only for genuinely open-ended client responses.

There must be no public/open arbitrary-text TTS proxy.

Only the internal call-response flow may request dynamic synthesis, after the response text is already authorized by the call engine.

Reuse Phase 20:

- voice-character registry
- voice IDs/settings
- centralized ElevenLabs model/output format
- provider validation/limits
- private R2 playback model

Dynamic audio derived from a learner-private call should be private/learner-scoped to avoid cross-user leakage. Cache by a deterministic identity including at least the authorized text, fictional voice settings, generation version and appropriate learner/call scope.

If ElevenLabs fails or is not configured, return/show the client response text immediately and continue the call.

Do not regenerate the 40 Phase 20 assets.

## 19. Raw audio retention and deletion

Default: keep transcript, not raw audio indefinitely.

The learner can choose to retain raw call recordings. The preference must be explicit and understandable.

The learner can delete a retained recording. Deletion must actually remove the private R2 object and update metadata honestly. A deleted object cannot still play from the Worker.

Do not silently delete a recording needed to recover from an STT failure.

Do not make raw-audio retention a requirement for grading/mastery.

## 20. Failure behavior

### STT failure

- preserve local recording
- preserve/confirm R2 recording when upload succeeded
- show a clear retry transcription action
- allow re-recording
- do not lose notes/call history

### TTS failure

- show client text
- continue the call
- do not retry forever or block the exercise

### Anthropic/AI failure

- preserve transcript and deterministic call state
- allow evaluation retry when needed
- authored fallback keeps roleplay usable where possible
- no learner work lost

### Network/R2 failure

- locally saved raw recording remains available for retry
- do not pretend upload succeeded

No provider failure may crash CRM, Workflow Lab or the global app shell.

## 21. Call Room visual behavior

This is a signature environment, not a generic form inside a card stack.

Use the existing Bloomlab design language:

- deep ink/dark surface
- very low density
- quiet interface
- audio state is legible and tactile
- notes drawer is secondary
- client identity feels premium but restrained
- no participant tiles
- no giant fake waveform decoration that conveys nothing
- no generic AI avatar
- no glassmorphism wall
- no neon hacker UI
- no eyebrow/kicker
- no monospace user-facing typography

Keep animation subtle and respect reduced motion.

## 22. Mobile, keyboard and accessibility

Review at the standard five widths:

- 1440
- 1024
- 768
- 390
- 320

Acceptance includes a complete call on **390 px using touch only**.

Also verify keyboard operation on desktop.

Requirements:

- no page-level horizontal overflow
- touch targets about 44 px
- inputs/selects >=16 px on phones
- visible focus
- no hover-only critical state
- microphone/record states announced accessibly
- transcript and error states usable with assistive semantics

## 23. Feature flag

`voice_calls` currently stays off in production from Phase 20.

During implementation, enable it only in environments where the Call Room is genuinely usable and the required secrets are configured.

Do not expose a half-built production route.

By final merge readiness, if Phase 21 acceptance is fully met and production secrets are configured, production can enable the completed Call Room. If a live provider gate remains unresolved, keep the relevant requirement/status honest rather than weakening the flag.

## 24. Migrations and versions

Never edit already-applied migrations `0001`, `0002` or `0003`.

Use a new migration for Call Room data.

Likely changes:

- content version: bump, because SAY IT content and call rubric/config are new
- IndexedDB DB version: bump if adding local raw-recording table
- exercise grader version: bump only if the grading contract/composition changes

Do not bump simulator or mastery versions unless their actual contracts change.

Historical attempts must remain readable.

## 25. Secret setup, stop at the exact gate

Do not ask the user to paste any secret into chat.

Likely preview secrets:

- `GOOGLE_CLOUD_CREDENTIAL`
- existing rotated `ELEVENLABS_API_KEY` for dynamic TTS
- existing `ANTHROPIC_API_KEY`
- existing `SYNC_KEY_PEPPER`

The old ElevenLabs credential was rotated in Phase 20. Never revive it.

When live STT implementation is ready, stop and report the exact secure user action if `GOOGLE_CLOUD_CREDENTIAL` or Google project/IAM setup is missing.

Do not invent success with fixtures.

For production, Phase 21 cannot be called production-ready until the Google STT credential is securely configured. If production dynamic TTS is part of the accepted runtime, the current rotated ElevenLabs key also needs a production Worker-secret binding before merge.

## 26. Google project/IAM verification

Before live preview STT, verify current official Google documentation and the actual project setup.

At minimum prove:

- Speech-to-Text V2 enabled
- service account/credential is real and server-only
- least-privilege recognition permission works
- configured project/location/model/language are supported
- one real short recording transcribes through the Worker

Document only non-secret identifiers/evidence. Never commit private key material or access tokens.

## 27. Live preview proof required

Phase 21 is not complete from mocked providers alone.

Before final implementation report, prove on deployed preview:

1. Call Room loads behind intended feature flag.
2. A real browser microphone recording is made from user action.
3. The recording is locally preserved before upload.
4. Worker auth accepts the upload.
5. Private dev R2 receives the learner-owned recording.
6. Real Google STT V2 returns a transcript.
7. Transcript is displayed before evaluation.
8. Learner-confirmed transcript feeds the call turn, not raw audio.
9. The scenario advances deterministically.
10. At least one open-ended path uses dynamic TTS if VOI-003 is claimed PASSED.
11. Repeating the same dynamic response reuses cache instead of spending again.
12. TTS failure shows text fallback.
13. STT failure preserves recording and retry succeeds without re-recording when the existing upload is valid.
14. Anonymous access to learner recording fails.
15. Wrong learner scope fails.
16. Revoked device fails.
17. Deleting a retained recording makes it unavailable.
18. A full call completes at 390 px with touch only.
19. Keyboard flow works at desktop width.
20. No browser request directly targets Google Speech, Anthropic or ElevenLabs.

Use disposable review devices and revoke them afterward.

Do not run a production Worker deploy from the implementation branch.

## 28. Tests

Add focused automated tests covering at least:

### Recording/local persistence

- format capability selection
- max duration/size
- local blob stored before upload begins
- reload resumes metadata/transcript honestly
- failed upload preserves local blob
- successful non-retained recording cleans up only after safe checkpoint

### Worker upload/storage

- valid session required
- authored SAY IT exercise/attempt validation
- bounded MIME/size
- object key never caller-controlled
- same recording ID + same checksum idempotent
- same ID + different bytes conflicts
- private ownership
- metadata-only D1

### Google STT

- credential/server-only boundary
- OAuth token handling does not persist credentials/tokens
- provider status/body sanitization
- timeout
- malformed/no transcript
- retry from saved R2 object
- real supported MIME mapping/autodetect request

### Security

- raw audio never sent to Anthropic
- raw audio never sent to ElevenLabs
- browser bundle/source has no Google credential/provider direct call
- 401 anonymous/revoked
- 403 other learner

### Call engine

- authored branch before LLM
- deterministic consequences cannot be overridden
- AI Off/budget failure uses fallback
- idempotent per-turn classifier/response
- no invented state/economics from LLM output

### TTS

- pre-generated line preferred where available
- dynamic synthesis only from authorized internal response
- duplicate synthesis cache reuse
- text fallback on failure
- no arbitrary text proxy

### Grading

- eight exact CALL-003 dimensions exist
- no accent/pronunciation criterion
- `call_feedback` accounting
- deterministic failures remain authoritative
- rubric version pinned to attempt

### UI

- six CALL-001 elements
- no participant grid
- guided anchors vs advanced hidden aids
- notes preserved
- transcript visible before evaluation
- retry/delete/retention states
- completion on touch-only mobile

Do not weaken existing tests.

## 29. Existing Phase 20 boundaries must survive

Do not regress:

- 40 Phase 20 voice assets
- provider-free playback
- private R2 access
- checksum/content-addressed voice identity
- preview-only authored bulk generation endpoint
- rotated ElevenLabs preview secret
- `voice:check`

Dynamic Phase 21 TTS is additive. Do not turn the Phase 20 generation endpoint into a general text proxy.

## 30. Requirement status discipline

Primary Phase 21 targets:

- CALL-001
- CALL-002
- CALL-003
- CALL-004
- CALL-005
- CALL-006
- EXR-015
- VOI-003
- VOI-006
- VOI-007
- SEC-005

Potentially affected cross-cutting requirements:

- RSP-004
- DATA-001
- DATA-006
- INF-001
- INF-004
- INF-011
- SEC-001
- DES-008
- DES-017
- DES-018
- A11Y-001

Do not automatically mark broad cross-cutting rows PASSED just because Call Room improves them.

Keep unrelated carryovers honest, especially PRI-001, PRI-002, NEG-003 and EXR-024.

## 31. Documentation

Update truthfully:

- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGELOG.md`
- `docs/DECISIONS.md`
- new `docs/reviews/phase-21-call-room.md`
- operations doc for Google STT credential/project setup, retry/recovery and raw recording retention/deletion

Record external API verification dates and chosen model/location without credentials.

## 32. Review probes

Add a dedicated Call Room review probe consistent with existing repository review tooling.

At minimum exercise:

- five widths
- full 390 touch flow
- desktop keyboard flow
- reduced motion
- microphone denial
- STT failure/retry
- TTS failure/text fallback
- retention/delete
- reload during recoverable states
- unauthorized media
- no third-party browser audio egress

Re-run high-risk existing probes affected by exercise routing, app navigation, sync/auth, AI and voice/media routing.

## 33. Full verification

Run under pinned Node 22:

- typecheck
- lint
- format check
- full tests
- docs validation
- content check/lock
- voice check
- production build
- preview build
- new call-room review probe
- affected existing probes

Then push branch and let GitHub Actions prove exact head.

## 34. PR behavior

Use focused conventional commits with requirement IDs.

Open a PR from:

`codex/phase-21-call-room -> main`

Do not merge it.

Do not run production deployment from the branch.

## 35. Final Astra report

Report:

- verified base SHA
- branch
- PR number
- exact final head SHA
- requirement/status changes
- five SAY IT exercise IDs/modes
- call-content/scenario architecture
- Call Room state machine
- local raw recording persistence design
- browser recording formats and limits
- R2 object/storage model
- new migration(s)
- Google STT V2 project/location/model/language and verification date, no secrets
- Google auth/IAM approach
- raw-audio privacy boundary
- transcript correction/confirmation behavior
- AI/classifier/authoritative-state boundary
- dynamic TTS caching/fallback design
- call rubric ID/version and eight dimensions
- `call_feedback` accounting evidence
- raw retention/delete behavior
- exact live preview STT evidence
- exact live dynamic TTS evidence if VOI-003 is marked PASSED
- failure/retry evidence
- five-width/mobile/keyboard probe results
- test count/file count
- exact-head CI result
- versions changed/unchanged
- all remaining limitations
- every still-required user secret/project action

Leave the PR open for ChatGPT's independent audit.