# Call Room operations

Verified against first-party API documentation on 2026-09-08. This is an implementation runbook, not evidence of a successful live STT request. See [the Phase 21 review](../reviews/phase-21-call-room.md) for the outstanding acceptance gate.

## Enable preview after secure setup

Preview currently has the rotated `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY` and `SYNC_KEY_PEPPER` Worker secrets. `GOOGLE_CLOUD_CREDENTIAL` was absent from the name-only preview secret listing. No credential value was inspected or copied into evidence.

1. Choose a Google Cloud project with billing and Speech-to-Text V2 enabled. Grant the service account `roles/speech.client` on that project. Recognition requires `speech.recognizers.recognize`; administrator/editor roles are unnecessary. Check the actual project, API enablement and IAM in Google Cloud before claiming acceptance.
2. Keep the service-account JSON outside the repository. Install it directly as a Worker secret; do not paste it into chat, commit it, place it in Wrangler `vars`, or expose it as a `VITE_*` variable:

   ```bash
   cd /workspaces/Bloomlab/worker
   npx wrangler secret put GOOGLE_CLOUD_CREDENTIAL --env preview < /path/to/service-account.json
   ```

3. Verify only binding names/types with `npx wrangler secret list --env preview`. The project ID is read from that secret, so there is no placeholder project in application code. The implementation does not follow credential-supplied URLs.
4. After setup is verified, enable preview `voice_calls` in `packages/shared/src/featureFlags.ts` and preview `CALLS_ENABLED: "true"` in `worker/wrangler.jsonc`. Commit and deploy via PR CI; migration `0004_call_room.sql` must reach development D1 first. Local development also requires the Worker gate and credentials for real services. The local browser flag alone permits UI development and explicitly controlled probes.
5. Run the handoff's live preview checklist with a real short browser microphone recording. Record only non-secret project/location/model/language, response statuses, recording ID/checksum/byte count, deletion evidence and provider usage. Revoke disposable review devices afterward.

Production remains gated in both the browser and Worker. Production readiness requires independent acceptance, the Google Worker secret, the current rotated ElevenLabs Worker secret if dynamic speech is enabled, and an explicit reviewed production gate change. Do not deploy production from this branch; merging remains a separate user action.

## Google request and authentication

`worker/src/call/google.ts` signs an RS256 service-account assertion with WebCrypto, exchanges it at Google's fixed OAuth token endpoint and keeps the token/pending exchange in isolate memory only. Tokens are refreshed before expiry. Neither token nor private key is written to D1, R2, browser storage, telemetry or logs.

The V2 synchronous endpoint is `https://us-speech.googleapis.com/v2/projects/{project}/locations/us/recognizers/_:recognize`, using `chirp_3`, `en-US`, `autoDecodingConfig: {}` and inline base64 audio. `_` is Google's implicit recognizer. The provider boundary aborts after 45 seconds and bounds/parses responses, returning application error codes rather than upstream bodies. Google documents synchronous limits of 10 MB audio and one minute; Bloomlab allows at most 8 MiB and 55 seconds per turn. These settings are documentation-verified; the actual Google project and recognition permission remain unverified.

First-party references: [V2 recognize](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers/recognize), [Chirp 3 supported locations/languages](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3), [decoding configuration](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers), [quotas and limits](https://docs.cloud.google.com/speech-to-text/docs/quotas), [Speech IAM](https://docs.cloud.google.com/speech-to-text/docs/iam), [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account).

## Recording, retention and recovery

The browser requests microphone permission only after Record reply. MediaRecorder selects WebM/Opus first, MP4/AAC second, then Ogg/Opus when supported. It stops at 55 seconds or near the 8 MiB ceiling, validates the final Blob, releases all tracks and stores the Blob/checksum/format/identity in local-only Dexie `call_recordings` before uploading. MP4 and Ogg support is implemented and tested at the format/request boundary; physical Safari/iOS and live Google decoding have not been verified.

The browser addresses recordings by UUID. It cannot choose an object key. The Worker writes private `call/raw/v1/{recording_id}.audio` with server-owned learner/attempt/turn/format/checksum metadata before inserting a D1 metadata row. Authenticated playback/deletion checks ownership and live device revocation. The same ID and bytes are idempotent; changed bytes/format or scope conflict. R2-first partial writes can be indexed or deleted without overwriting their bytes. `0004` contains four metadata/text tables (`call_attempts`, `call_recordings`, `call_turns`, `call_voice_assets`), with no audio BLOB column; migrations `0001`–`0003` are unchanged.

The original STT text remains visible alongside an editable transcript. Evaluation requires explicit confirmation. Corrections carry no penalty. The confirmed text and resolved turn cross the existing per-attempt IndexedDB write queue before default audio cleanup. Both transcripts and grading survive audio deletion, and completed evidence is immutable.

| Situation | Recovery |
| --- | --- |
| Upload/network failure | Keep the local Blob. Retry transcription uploads that saved Blob if its upload is not yet confirmed. |
| STT timeout/error/empty result | Keep local and uploaded audio. Retry transcribes the existing R2 object; a successful prior upload is not repeated. Re-recording is also available. |
| Reload before MediaRecorder saves | Explain that the interrupted in-memory turn was lost; keep earlier turns and notes. Never claim those unfinished bytes were saved. |
| Reload after local save/upload/confirmation | Recover local Blob or private metadata, reconcile the durable server turn, and preserve notes/corrected text. Pending confirmation reuses its exact saved input/hash. |
| Default retention | Delete unretained audio after the confirmed branch is checkpointed. Failed/superseded audio stays until a replacement turn is confirmed; retained audio is excluded. |
| Optional retention | Keep local and private R2 audio for replay. Delete audio removes actual bytes, keeping transcript/history. |
| Interrupted delete | Metadata enters `deleting`, so playback is refused. A retry removes R2 then marks `deleted`. Unindexed R2-first audio is also addressable for owner-authorized deletion. |
| TTS unavailable or autoplay refused | Display the client text and Continue with client text. A late audio response cannot undo a later learner phase. |
| AI Off/budget/provider failure | Use an authored roleplay fallback. Final rubric feedback remains recoverable and pending until evaluation succeeds; never invent a passing grade. |

There is no scheduled expiry sweep in this phase. Closing the app before cleanup or abandoning an unsuccessful recording can leave private audio until the learner resumes or explicitly deletes it. Browser storage eviction can remove a local copy. Retention is not a grading/mastery prerequisite. Global account erasure and commercial consent remain their existing broader scope.

## AI and audio privacy

Raw microphone bytes go from the browser to its own Bloomlab Worker, private R2, and Google Speech only. Anthropic receives confirmed text; final feedback is rebuilt from the owner-verified completed server call, never the caller's arbitrary submission. ElevenLabs receives only an internally authorized client response, which may include a confirmed learner-text quote. It never receives raw learner audio. Browser code calls Bloomlab routes only.

The shared conversation/negotiation engines own scenario transitions and economics. Explicit moves, authored phrase rules and unambiguous authored branches precede a cheap classifier. The classifier can only select an existing move/strategy at confidence >=0.8. AI Off, budget refusal, failed output and low confidence use authored fallback. In Full mode an optional strong request can select a verified literal quote followed by the exact authored clarification question; it cannot invent client facts, commitments or state deltas.

Durable `(attempt, turn)` claims and request hashes prevent duplicate branches and classifier purchases. Unknown outcomes preserve conservative AI reservations. Final rubric work and call intelligence are accounted as `call_feedback`. The eight rubric dimensions are questions, listening, diagnosis, clarity, jargon, pitch timing, objection handling and next step; accent/pronunciation are excluded. Objective critical/required failures remain authoritative.

Existing Phase 20 authored audio is preferred when exact text and character match. Dynamic synthesis accepts an owner-scoped attempt/turn only, resolves saved internal text, and hashes voice settings/generation inputs plus learner/attempt scope. It stores private R2 bytes behind a durable D1 generation claim. Retries reuse cached audio; uncertain purchases fall back to text instead of buying again. An operator must inspect private R2 metadata and provider usage before reconciling an uncertain generation. Do not delete a claim merely to force another purchase. No arbitrary-text TTS endpoint or change to the 40-asset authored library is introduced.

## Repeatable checks

Run under the pinned Node 22 major. `npm run review:call` uses native browser MediaRecorder/IndexedDB with a virtual microphone and explicit HTTP fixtures. It proves browser recovery and interaction, not remote Google/IAM/ElevenLabs/R2 acceptance. Existing `review:voice` checks real authenticated saved assets without purchasing audio. See the review for commands, artifacts and exact CI evidence.
