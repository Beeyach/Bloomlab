# Phase 21 independent audit - live acceptance

> Historical record. Phase 21 PR #23 was merged on 2026-09-08 as `59ec678910cb51559d84af3c4200590f9c7e29ec`. Main CI `34267608095` Checks and Production deploy succeeded; production migrations `0004`/`0005`, 40 voice metadata rows and Worker `291517ab-8f2b-44d3-96aa-6dd7a615cc6c` were verified. Draft/unmerged instructions below describe the earlier review stage. All acceptance limitations and seven unverified rows are preserved.

Repository: `Beeyach/Bloomlab`

Model for execution: Codex Astra High.

Do not merge PR #23. ChatGPT performs the final exact-head audit, merge decision and production verification.

## Audit state before this handoff

Independent code audit completed against implementation/final documentation head:

`bd51ea70d72aededcd6f6aaf2394ade79e4337a0`

PR #23 was open, draft, mergeable and unmerged. Exact-head CI run `34185118408` completed successfully: Checks SUCCESS, Preview deploy SUCCESS, Production deploy SKIPPED.

The independent audit found no code blocker in the implemented boundaries inspected, including:

- local Blob-before-upload recording persistence
- recording ownership, revocation and private R2 CRUD
- Worker-derived recording object keys and checksum/idempotency rules
- R2-first recovery and deletion
- Worker-only Google STT provider and credential parsing
- service-account RS256 OAuth assertion and in-memory token caching
- bounded provider responses and sanitized errors
- transcript review/correction before roleplay or grading
- raw audio exclusion from Anthropic and ElevenLabs
- server-rebuilt final AI evaluation from the completed owner-scoped call
- deterministic required/critical call gates remaining authoritative
- shared conversation/negotiation/pricing engines rather than a new LLM-owned engine
- durable turn claims and request hashes
- conservative Phase 19 AI budget accounting for call classifier/tailoring work
- constrained private dynamic TTS and cache reuse
- five SAY IT modes and exact eight-item call rubric
- advanced anchors absent from independent/pressure call DOM
- local-only Dexie recording table excluded from sync
- browser bundle provider/credential scans

The remaining gate is live external-service acceptance. Controlled fixtures, virtual microphone tests and viewport probes do not substitute for this.

## User-owned prerequisite

Do not create, print, request or commit a Google credential.

The user must first complete the Google Cloud setup outside Codex:

1. Select/create a Google Cloud project with billing enabled.
2. Enable Cloud Speech-to-Text API.
3. Create a dedicated service account for Bloomlab STT.
4. Grant only `roles/speech.client` unless a narrower verified custom role is deliberately chosen. Do not use Owner or Editor just to make the test pass.
5. Create a JSON service-account key and keep it outside Git.
6. Install the complete JSON as the preview Worker secret `GOOGLE_CLOUD_CREDENTIAL`.
7. Verify only the secret name/type, never its value.

Do not continue with live enabling until that prerequisite is confirmed.

## 1. Re-read live state

Once the user says the Google preview credential is installed:

1. `git fetch origin`
2. switch to `codex/phase-21-call-room`
3. verify the current branch head and PR #23 state
4. read this handoff completely
5. re-read `docs/operations/call-room.md`, `docs/reviews/phase-21-call-room.md`, the Phase 21 requirements and acceptance rows
6. inspect any branch delta since the audited head above

If unrelated runtime changes appeared, stop and report them rather than treating this audit as approval.

## 2. Verify credential metadata safely

Using Wrangler/Cloudflare, verify only that preview has a `GOOGLE_CLOUD_CREDENTIAL` Worker secret binding. Do not print, parse to stdout, upload to review artifacts or copy its value into environment dumps.

The current code intentionally reads `project_id`, `client_email` and `private_key` server-side from that secret. Do not introduce a browser project ID or browser credential.

## 3. Enable calls in preview only

Make the minimum reviewed gate change:

- `packages/shared/src/featureFlags.ts`: enable `voice_calls` for `preview`; keep production off.
- `worker/wrangler.jsonc`: set preview `CALLS_ENABLED` to string `"true"`.
- declare preview `GOOGLE_CLOUD_CREDENTIAL` as a required secret so preview deployment fails loudly if it disappears.
- keep production calls off.
- do not add a production Google requirement yet.
- keep the existing rotated ElevenLabs preview secret and existing Anthropic/sync secrets unchanged.

Do not weaken the Worker-side production hard gate. `handleCall` must still refuse new production calls regardless of accidental preview-style vars.

Commit this as a focused Phase 21 gate change and push. Leave PR #23 draft/open.

## 4. Exact-head CI and preview first

Wait for exact-head CI. Require:

- typecheck SUCCESS
- lint with no new errors/warnings
- format SUCCESS
- all tests SUCCESS
- docs validation SUCCESS
- content/lock SUCCESS
- voice check SUCCESS
- production build SUCCESS
- preview deployment SUCCESS
- production deploy SKIPPED
- development D1 `0004_call_room.sql` applied/no longer pending

Record exact head SHA, run ID and preview Worker version.

Do not run live acceptance against an older deployment.

## 5. Live Google/STT proof

Use a disposable linked preview learner/device. Revoke it after the probe.

Use a real browser microphone recording through the actual Call Room. Do not inject fixture audio into the Worker and call that live microphone evidence.

Prove one short turn end to end:

`microphone -> local IndexedDB Blob -> authenticated Worker upload -> private bloomlab-media-dev R2 -> Google STT V2 -> transcript review -> learner confirmation -> authored scenario transition`

Evidence must show, without secrets or raw audio:

- preview `/api/call/config` authenticated returns enabled true
- microphone permission is requested only after Record
- a real non-empty Blob is written to local IndexedDB before upload begins
- upload succeeds through Bloomlab only
- matching private R2 object exists
- matching D1 recording metadata exists with no BLOB/base64 audio column
- real Google recognition succeeds
- original transcript is displayed
- learner can correct it
- confirmed transcript, not original STT text, drives the turn
- confirmed transcript persists after raw audio deletion
- no browser request goes directly to Google, Anthropic or ElevenLabs

Record only safe metadata such as status codes, IDs, byte length, checksum, MIME, model/location/language and transcript test phrase if deliberately non-sensitive.

## 6. STT failure and recovery

Demonstrate deployed behavior, not just unit tests.

Prefer a safe reversible way to cause one transcription failure without exposing credentials or changing production. If doing so would require risky IAM/key manipulation, do not manufacture a failure. Instead use a deployed bounded failure path that does not compromise the credential and clearly label what is live vs test-only.

Minimum required live proof:

- failed transcription does not delete the saved recording
- retry operates on the existing private R2 recording, not a new browser upload
- successful retry reaches transcript review

Never delete the R2 bytes before recovery is safe.

## 7. Recording retention/privacy proof

On preview prove:

- default unretained audio is deleted only after the confirmed branch is checkpointed
- transcript/call history remains after default audio deletion
- retained audio can be replayed through authenticated Bloomlab route
- explicit Delete audio removes the actual R2 object
- deleted recording no longer plays
- anonymous request returns 401
- revoked device returns 401
- another learner cannot fetch/delete the first learner's private recording, expected 403

No public R2 URL or signed public bypass.

## 8. Real dynamic client TTS proof

Exercise a branch that actually produces an authorized `dynamic: true` client line. Do not synthesize arbitrary text just for the test.

Require:

- exact Phase 20 authored line is preferred where available and costs no new TTS generation
- genuinely dynamic authorized client text reaches ElevenLabs server-side only
- generated audio is private to learner/call scope
- first dynamic synthesis succeeds and plays
- repeat request for the same authorized response/settings reuses cached R2 bytes
- repeated request does not create another ElevenLabs generation/provider attempt
- no learner raw audio is ever sent to ElevenLabs
- if TTS is made unavailable in a safe deployed test, client text remains visible and the call can continue

Record provider usage/receipt metadata only if available without exposing secrets.

## 9. AI and call-engine proof

Using the deployed preview:

- explicit authored move must beat classification
- authored rule/single valid branch must beat classification where applicable
- AI Off must let the roleplay continue through authored fallback
- low-confidence/provider/budget failure must not invent a branch or client fact
- the same attempt/turn/transcript retry must not purchase duplicate classifier/tailoring work
- final rubric evaluation must use server-confirmed transcript text, never browser-supplied arbitrary submission, original STT text, notes or raw audio
- AI usage for SAY IT is categorized `call_feedback`
- deterministic call critical/required failures cannot be overridden by favorable rubric output

Do not burn provider spend merely to create decorative evidence. One well-chosen live path plus the deterministic exact-head regression suite is sufficient for behavior already exhaustively covered by tests.

## 10. Full call UX acceptance

Complete real preview calls, using actual microphone/STT, at minimum:

- 390 px touch-only complete call
- desktop keyboard-operated complete call

Across the five review widths 1440 / 1024 / 768 / 390 / 320 verify:

- no page-level horizontal overflow
- low-density dark Call Room composition
- all six CALL-001 elements
- 44px phone controls
- 16px phone inputs/selects where applicable
- visible keyboard focus
- no critical hover-only information
- no participant grid/Zoom clone
- independent/pressure calls do not contain advanced anchors in the DOM
- text fallback remains usable

Physical Safari/iOS is useful evidence if readily available but is not required to fabricate. Keep its status honest if not tested.

## 11. Requirement status discipline

Only after the live evidence actually supports them, promote the relevant Phase 21 rows from `IMPLEMENTED_UNVERIFIED` to `PASSED`:

- CALL-002
- CALL-003
- CALL-005
- CALL-006
- EXR-015
- VOI-003
- VOI-006
- VOI-007
- SEC-005

CALL-001 and CALL-004 are already PASSED.

Do not promote unrelated cross-cutting rows such as DATA-006, INF-001, INF-004, INF-011, RSP-*, A11Y-001, DES-017/018 unless their complete requirement is now objectively satisfied.

Keep all known carryovers honest, including PRI-001, PRI-002, NEG-003 and EXR-024.

## 12. Review/docs closeout

Update the existing Phase 21 review/evidence and control docs with the live evidence. Clearly distinguish:

- controlled fixture/virtual microphone evidence
- actual deployed preview microphone/STT/R2/ElevenLabs evidence

Never include:

- service-account JSON
- private key
- access token
- Worker secret values
- Sync Key/session token
- raw recording bytes/base64

Do not make a production-readiness claim yet.

## 13. End state after preview acceptance

Push the preview-acceptance closeout. Leave PR #23 draft/open and unmerged.

Final report to ChatGPT must include:

1. exact new head SHA
2. exact CI run and jobs
3. preview Worker version
4. Google secret binding type verified without value
5. Google project/API/IAM recognition result, sanitized
6. real microphone MIME/size/duration and local-before-upload proof
7. private R2 + D1 recording evidence
8. real STT transcript/confirmation result
9. retry/recovery result
10. default deletion + retained deletion result
11. 401/403/revocation result
12. real dynamic TTS + cache result and provider usage delta if safely available
13. provider egress evidence
14. AI Off/fallback/idempotency result
15. final call grading result and category
16. 390 touch + desktop keyboard + five-width result
17. requirement status changes
18. remaining limitations
19. confirmation that production calls remain disabled and no production deployment was run

Do not merge. ChatGPT will independently audit this new exact head and then decide the separate production-enablement gate.
