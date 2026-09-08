# Phase 20 — Voice assets review

Implementation review on 2026-09-07/08. The PR is for independent audit and must not be merged by its implementation agent.

## Baseline and scope

Verified production/main baseline: `f21fe161d1016fe7996e6ef29057573a439d0ca9`. `git fetch origin` found no newer main delta. Branch: `codex/phase-20-voice-assets`, starting with the handoff commit `e3c1c067631cb4309ee1ae60ff8d447f3ec1ebe4`. The final PR report records the PR number and exact head SHA after committing this evidence.

The Phase 20 handoff was read completely. This change implements reusable authored voice assets, private media infrastructure and an internal review surface. Recording, transcription, dynamic TTS, SAY IT and the Call Room remain outside scope. `voice_calls` stays off in production, and `/system/voice` uses the existing local/preview diagnostics flag.

## Requirements

| Requirement | Before | After | Evidence / remaining scope |
|---|---|---|---|
| VOI-001 | NOT_STARTED | PASSED | Five distinct real voices selected from the connected account's catalog, then auditioned through the actual preview Worker. |
| VOI-002 | NOT_STARTED | PASSED | Forty saved lines cover all six kinds; duplicate generation and playback are provider-free. Real browser decoding covers every line. |
| VOI-004 | NOT_STARTED | PASSED | Seven required registry fields, compiled YAML, all five current client references resolved bidirectionally, identity stable after reload. |
| VOI-005 | NOT_STARTED | PASSED | Purchased library with measured usage; exact bytes promoted without a second purchase. Future playback needs no ElevenLabs credits/key. |
| DATA-006 | NOT_STARTED | PARTIAL | Phase 20 audio acceptance passes: bytes in R2, metadata only in D1, no generated audio in Git. The full matrix also names later screenshot, portfolio, fieldwork, backup and attachment flows; those are not implemented. |
| DATA-007 | NOT_STARTED | PASSED | Private buckets, known asset IDs, authenticated Worker reads, invalid/revoked session 401 and other-owner 403. |
| SEC-001 | NOT_STARTED | PARTIAL | Current preview Worker secret, browser source/build scans and provider-free playback imports. Required credential rotation is complete; full all-phase credential coverage remains incomplete. |

INF-001, INF-004 and INF-011 remain PARTIAL with updated evidence. INF-010 remains PASSED. VOI-003, VOI-006, VOI-007, CALL-* and EXR-015 stay NOT_STARTED. Roll-up: 313 requirements; 189 PASSED, 23 PARTIAL, 8 IN_PROGRESS, 2 DEFERRED, 91 NOT_STARTED. No implementation requirement is marked BLOCKED or FAILED at closeout.

## Registry and voice selection

`content/voice-characters/VC-*.yaml` compiles into `ContentBundle.voice_characters`. Each record has `id`, the seven contract fields (`client`, `voice_id`, `speech_rate`, `style`, `stability`, `allowed_emotion_range`, `language`) and authored `lines` with unique ID, kind, text and emotion. Validation rejects unresolved/mismatched client references, invalid/placeholder IDs, duplicate lines or emotions, out-of-range numeric settings and a line emotion outside its character's range. Storage keys and URLs are not authored into client YAML.

Catalog metadata was retrieved from the connected ElevenLabs account on 2026-09-07. These are verified premade catalog entries, not invented documentation examples or personal voice clones:

| Client | Character | Real voice ID | Catalog voice | Rate / style / stability | Lines | Billed units |
|---|---|---|---|---|---|---|
| CL-northwind-hvac | VC-blunt-tradesman | `CwhRBWXzGAHq8TQ4Fs17` | Roger — Laid-Back, Casual, Resonant | 1.03 / 0 / 0.55 | 8 | 381 |
| CL-summit-coaching | VC-measured-founder | `cjVigY5qzO86Huf0OWal` | Eric — Smooth, Trustworthy | 0.95 / 0 / 0.65 | 8 | 395 |
| CL-ridgeline-roofing | VC-storm-season-roofer | `iP95p4xoKVk53GoZ742B` | Chris — Charming, Down-to-Earth | 1.08 / 0 / 0.5 | 8 | 388 |
| CL-halcyon-yoga | VC-studio-manager | `XrExE9yKIg1WjnnlVkGX` | Matilda — Knowledgable, Professional | 0.98 / 0 / 0.6 | 8 | 378 |
| CL-glowhaus-medspa | VC-warm-owner | `EXAVITQu4vr4xnSDxMaL` | Sarah — Mature, Reassuring, Confident | 1.05 / 0 / 0.55 | 8 | 392 |

Every client has one greeting, two objections, one interruption, one voicemail, one recurring line and two scripted scenario lines. Total: **40 files, 3,155,660 bytes, approximately 194.49 seconds of decoded audio**. Authored lines follow each existing client's tone, role and examples.

Generation is centralized in `worker/src/voice/config.ts`: model `eleven_multilingual_v2`, output `mp3_44100_128`, MIME `audio/mpeg`, similarity boost 0.75, speaker boost enabled, maximum 2 MiB, 30-second deadline. The chosen voices support this model. Official [TTS request](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [voice settings](https://elevenlabs.io/docs/api-reference/voices/settings/get) and [catalog](https://elevenlabs.io/docs/api-reference/voices/search) documentation was verified on **2026-09-07**. Language is `en`; language/emotion remain authored direction because multilingual_v2 does not accept `language_code` and has no deterministic emotion parameter.

Five greetings were generated and inspected first. Real Chrome decoding produced durations 4.27 / 4.41 / 4.09 / 5.53 / 5.20 seconds, RMS 0.060–0.132 and no clipped samples. Only then were the remaining 35 lines generated. The full-library browser pass decoded all 40, also with no clipping. This is technical inspection, not a claim that a person listened or approved accents/acting.

## Live generation, privacy and replay

Preview: `https://bloomlab-preview.cool-sunset-2169.workers.dev`. Migration `0003_media_assets.sql` applied successfully to `bloomlab-dev`. Initial media deployment `8d1f3423-4a8b-4019-981c-70259caac07f` generated the files; final preview deployment `3a91912e-506e-43bf-a316-c0ff651cc51e` carries the final review UI. Both bound `MEDIA` to `bloomlab-media-dev`.

`POST /api/voice/generate` authenticates the existing device session, accepts only an authored character ID and line ID, and is unavailable in production. It makes one bounded provider request when an immutable asset is absent. `voice_generation_jobs` atomically arbitrates concurrent callers; uncertain purchases cannot be automatically reclaimed. R2 is written before D1 indexing; its private recovery metadata lets a retry repair a metadata failure without another provider request.

For **every one of the 40 assets**, the operational probe confirmed:

- Authored generation succeeds, and a repeated request returns the identical asset ID with `reused: true`.
- D1's job is complete with exactly one provider attempt; metadata has matching byte length/checksum and no audio payload.
- Two authenticated media requests return HTTP 200 `audio/mpeg` with identical SHA-256; anonymous access returns 401.

Both generation devices were subsequently verified revoked in D1. The final browser review also revoked its device and retained authored text after the library refresh returned an authorization error.

Playback is a separate module whose transitive local import graph excludes the generation/provider modules. An integration test calls the actual Worker router with an absent provider key and a global fetch configured to throw; R2 playback succeeds and fetch is never invoked. Browser resource evidence shows exactly one Bloomlab media request per Play and no ElevenLabs request. A valid device can read authored assets; another learner's private scope returns 403 in integration, invalid/revoked sessions return 401, and absent metadata/object or arbitrary keys return 404. Responses use `private, no-store`, correct MIME, nosniff, ETag, HEAD and single byte-range semantics including 416 and If-Range.

The account's [subscription usage](https://elevenlabs.io/docs/api-reference/user/subscription/get) increased from **4,713 to 6,647**, exactly **1,934 billed units**, matching the sum of all 40 `character-cost` response headers. The inputs contained 3,515 authored text characters; input length and billed units are reported separately. Account limit observed: 218,508. No dollar cost or historical expiry estimate is inferred. Replays and repeated generation added no provider attempts. A final account read after all 40 browser replays and production promotion still returned 6,647: zero additional billed units. The final deployed preview binding was independently verified as secret_text.

## Storage and promotion

Private buckets: `bloomlab-media-dev` and `bloomlab-media-prod`; Wrangler verified public `r2.dev` access disabled on both. Local development uses R2 emulation. Keys are immutable `voice/v1/<VC-character>/<line-id>/<SHA-256-of-generation-inputs>.mp3`; asset IDs are `VA-<same-hash>`. The hash includes text and voice/model settings, not unrelated curriculum version changes. Historical bytes are preserved.

Migration `0003_media_assets.sql` adds `media_assets` (19 metadata columns, authored/learner ownership constraint, byte/MIME constraints, unique object key and owner index) and `voice_generation_jobs` (claim status, attempt count, provider receipt/usage). Existing migrations are unchanged; no binary or base64 audio is stored in D1.

**Promotion passed on 2026-09-08: all 40 production objects have the same SHA-256 and byte length as preview.** `npm run voice:promote` selects only the current authored manifest, checks development length/SHA-256, refuses different existing production bytes, copies missing objects as audio/mpeg, then downloads production bytes to verify exact identity. Transfers run in bounded batches of four independent immutable objects, with each batch settled before temporary-file cleanup. Temporary audio is deleted. The first transfer run stopped on a Cloudflare OAuth-expiry 401 after 13 completed objects; Wrangler refreshed the credential, and the successful repeat run re-verified/reused those files. No generation is part of promotion. The resulting [metadata manifest](../operations/voice-assets.json) is the production index input; [operations](../operations/voice-assets.md) document reruns and reconciliation. The main CI job applies the production migration, verifies all production bytes and indexes this metadata before Worker deployment. No production D1 migration/index or Worker deployment was run from the branch.

## Verification

Node **22.22.1**. Full suite: **1,692 tests across 100 files**, all passed (50 more tests and three more files than the baseline). After the final receipt-retention and request-size adjustments, the focused Worker file passed all 30 tests and Worker typechecking passed. The final small UI error-state adjustment passed web typechecking and both builds.

- Full workspace typecheck passed; ESLint passed with zero errors and the existing `ExerciseRunner.tsx:114` dependency warning.
- The 40-entry manifest passes `voice:check`. Applying all migrations and inserting the exact manifest twice in local SQLite leaves exactly 40 metadata rows with no BLOB columns.
- Format check, control-document validation, content validation and lock enforcement passed; existing content coverage warnings remain.
- Production and preview builds passed the new browser-output secret/provider scan. A separate in-memory comparison confirmed the actual credential value is absent from tracked/candidate repository files; no value was written to evidence or logs.
- Tests cover schema/reference/kind coverage, immutable paths, missing secrets, production restrictions, authorization, sanitized HTTP/timeout/provider failures, invalid/oversized audio, object-write failure, recovery after metadata failure, concurrent claims, duplicate reuse, metadata-only D1, authenticated/private playback and ranges.
- Live `review:voice` passed **1440 / 1024 / 768 / 390 / 320**: no overflow, 44 px app controls, 16 px selects, stable identity after reload, actual private audio decoding, anonymous 401 and no direct provider requests. Native keyboard Tab/focus/Enter at 1440 and real touch dispatch at 390/320 passed. All five screenshots were visually inspected. The first keyboard attempt used an incomplete CDP Enter event; using the same character-event pattern as the existing Academy/Funnel probes corrected the probe, with no app activation fix required.
- Live `review:sync` passed all nine stages: link, local-first note, second-device receipt, offline edits, conflict preservation/convergence, tombstone propagation and revocation. Live `review:rail` passed all five widths and existing destination reachability.

Committed [machine-readable evidence](phase-20-voice-evidence.json) contains sanitized generation/usage and browser results. Local detailed artifacts: `.review/voice-generation-audition.json`, `.review/voice-generation-all.json`, `.review/phase-20-voice-final/voice-probe.json` and five screenshots, `.review/phase-20-sync/sync-probe.json`, `.review/phase-20-rail/rail-probe.json`. Local review captures are ignored by Git; generated audio is also ignored and never committed.

Versions: content **2026.09.16 → 2026.09.17**, lock hash `e5b65b8efbe39f0f8197d4bb0b0584b91aa25547be7411994c79f44a3de4aa3e` (149 content sources). App **0.1.0**, schema **1**, simulator **2026.09.11-r2**, mastery **2026.09.03-r4** and exercise grader **2026.09.16** deliberately unchanged.

## Independent audit security closeout — 2026-09-08

The [independent audit handoff](../handoffs/phase-20-independent-audit-closeout.md) made rotation of the credential entered as a plain-text Worker variable a required pre-merge remediation. The user confirmed that the old ElevenLabs key was revoked/rotated and the replacement preview binding is a Worker secret. Read-only metadata for active preview version `1c88ea20-fc44-4307-a6da-93fea19576b6` independently confirmed the binding type as `secret_text` on 2026-09-08. This closes the rotation requirement. No secret value is committed or printed, and no deletion of historical Worker versions is claimed.

No audio is regenerated for this closeout. The existing 40 immutable assets and their production R2 promotion remain valid; production still requires no ElevenLabs key for Phase 20 playback. SEC-001 stays PARTIAL across its broader all-phase scope, and all other requirement statuses and `voice_calls` remain unchanged. This closeout changes documentation/evidence only; PR #22 remains open for ChatGPT's final merge decision.

## Remaining limitations and handoff

- Human listening/acting quality is unverified; numeric voice settings are supported, but authored emotion/language are not guaranteed expression controls.
- General non-audio media, recording, transcription, dynamic TTS, Call Room and SAY IT are future work. Full DATA-006/SEC-001 and the affected cross-cutting infrastructure requirements retain honest partial statuses.
- Media requires an online authenticated fetch after reload; no offline audio cache is implemented. Revocation cannot recall bytes already delivered to a device.
- Ambiguous purchases require manual reconciliation; provider-history recovery has no automated UI. Promotion/indexing deliberately refuse conflicting bytes or metadata.
- Production Worker/D1 deployment and production playback verification await independent merge and CI. The deployment credential must permit R2 reads and D1 writes. No production ElevenLabs key is required.
- Existing lint/content warnings remain as recorded above. No user action is required to finish the implementation PR; independent audit and merge remain with ChatGPT/the reviewer.
