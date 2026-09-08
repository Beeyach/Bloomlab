# Phase 20 — Voice Assets

Implementation handoff for `Beeyach/Bloomlab`.

Model: Codex Astra High.

Do not merge your own PR. ChatGPT performs the independent audit, exact-head CI verification, merge decision, and production verification.

## 1. Start from the exact production baseline

Phase 19 is closed and production-green.

Verified `main` baseline before this handoff branch was created:

`f21fe161d1016fe7996e6ef29057573a439d0ca9`

The branch already exists:

`codex/phase-20-voice-assets`

This handoff file is the first branch commit.

Before editing:

1. `git fetch origin`
2. verify `origin/main`
3. inspect the delta between `origin/main` and the baseline above
4. if legitimate newer main work exists, incorporate it instead of resetting or discarding it
5. stay on `codex/phase-20-voice-assets`

Do not work on `main`.

## 2. Read the actual source of truth first

Read before planning edits:

- `BLOOMLAB_MASTER_SPEC.md` §§105, 113–119, 149, 152
- `TECH_ARCHITECTURE.md` voice/R2/security sections
- `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md` §§15–16, 43–49, 62, 79
- `REQUIREMENTS_MATRIX.md` DATA-006, DATA-007, VOI-001–007, SEC-001, INF-004, INF-010, INF-011
- `ACCEPTANCE_TESTS.md` Phase 20
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGELOG.md`
- `docs/DECISIONS.md`
- `CONTENT_ARCHITECTURE.md`
- `packages/content-schema/src/ids.ts`
- `packages/content-schema/src/bundle.ts`
- `packages/content-schema/src/schemas/client.ts`
- content compiler/index/reference validation code
- every file under `content/clients/`
- `worker/src/index.ts`
- `worker/src/sync/auth.ts`
- `worker/wrangler.jsonc`
- all migrations, especially `0001_init.sql` and `0002_ai_gateway.sql`
- feature flags and `/system` diagnostics/review patterns
- existing browser probe conventions

The repository wins over this handoff if anything has changed.

## 3. Exact Phase 20 target

Implement the Phase 20 requirements that actually belong to voice-asset infrastructure:

### VOI-001
At least one persistent fictional client has a real ElevenLabs voice configured. Do not invent a voice ID.

### VOI-002
Pre-generated voice lines exist in R2 and play without any runtime TTS call. The reusable library must cover, at minimum:

- greeting
- objection
- interruption
- voicemail
- recurring line
- scripted scenario dialogue

### VOI-004
Create the real voice-character registry. Registry entries must carry all seven contract fields:

- client
- voice ID
- speech rate
- style
- stability
- allowed emotion range
- language

Recurring characters must keep the same voice across sessions.

### VOI-005
Use the currently available ElevenLabs credits to build a reusable asset library, but do not make future Bloomlab operation depend on those credits.

### DATA-006
Audio bytes live in R2. D1 contains metadata only. Git contains authored text/configuration, never generated audio binaries.

### DATA-007
Private media is not directly public. A media fetch that requires learner authorization must return 401/403 without a valid session.

Do not implement Phase 21 work early just to make Phase 20 look bigger.

Specifically, do NOT implement:

- full Call Room
- learner microphone recording
- Google Speech-to-Text
- dynamic TTS for open-ended calls
- realtime or full-duplex telephony
- SAY IT voice exercises
- VOI-003, VOI-006 or VOI-007 unless a tiny shared primitive is unavoidable and does not falsely mark those requirements complete

Keep `voice_calls` off in production. A diagnostics/review surface is fine; an unfinished learner Call Room is not.

## 4. Current external API facts to verify again before coding

These were checked against first-party docs on 2026-09-07. Re-check the official docs immediately before locking request shapes or model names.

ElevenLabs TTS currently uses:

`POST https://api.elevenlabs.io/v1/text-to-speech/:voice_id`

with `xi-api-key` server-side only.

The current API supports `voice_settings` including:

- `stability`
- `similarity_boost`
- `style`
- `speed`
- `use_speaker_boost`

The current default TTS model shown by the official endpoint is `eleven_multilingual_v2`, and the default output format is `mp3_44100_128`.

Official references:

- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/api-reference/voices/settings/get
- https://developers.cloudflare.com/r2/get-started/workers-api/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/r2/reference/wrangler-commands/

Prefer `eleven_multilingual_v2` for the pre-generated Phase 20 library unless current official documentation or the actual selected voices provide a concrete reason to use another model. Centralize the chosen model and output format in one server/generation configuration rather than scattering literals.

Do not use ElevenLabs v3 merely because it is newer if doing so weakens the stable voice-setting contract Bloomlab is trying to author.

## 5. Voice registry belongs in content, not React or random TypeScript constants

The current persistent clients already reference logical characters such as `VC-measured-founder` and `VC-warm-owner`. Their `ClientSchema.voice.character` comment explicitly says the registry is Phase 20.

Implement that registry as content-driven data.

Preferred direction:

- add a first-class content type such as `voice-characters`
- folder `content/voice-characters/`
- ID format `VC-<slug>`
- compile into the shared content bundle
- add reference validation so a client's `voice.character` cannot silently point at nothing
- ensure the voice record's `client` matches the client that references it

A registry record should have the seven required fields plus only the extra authored data genuinely needed for pre-generation, for example:

```yaml
id: VC-measured-founder
client: CL-summit-coaching
voice_id: <real ElevenLabs voice id>
speech_rate: 0.95
style: 0
stability: 0.6
allowed_emotion_range:
  - calm
  - skeptical
  - firm
language: en
lines:
  - id: greeting-01
    kind: greeting
    text: ...
    emotion: calm
```

Exact schema is your decision after reading the compiler.

Do not put generated R2 URLs in authored client YAML. Keep authored identity/configuration in Git and storage location/bytes in the media layer.

Do not fake unresolved ElevenLabs voice IDs.

All current client `VC-*` references should become valid registry references by the end of the phase. If actual voice selection for one cannot be completed honestly, keep the affected requirement PARTIAL and report it rather than inserting a made-up ID.

Because content changes, update the content version and lock using the repository's established process. Do not bump simulator, mastery or exercise-grader versions for voice assets.

## 6. Voice selection

Use real voices from the connected ElevenLabs account/catalog.

Do not infer or fabricate IDs from documentation examples.

The current client files already contain tone, speaking style and sample phrases. Use those as the character direction when choosing voices.

A useful quality path is:

1. query the actual available ElevenLabs voices
2. select a reasonable candidate from real metadata for each existing `VC-*` character
3. generate one short audition line per character
4. listen or otherwise inspect the real generated audio where practical
5. only then generate the reusable library

Do not waste credits by bulk-generating before the voice ID/configuration is stable.

At minimum, the acceptance client must have a real stable voice and all six asset categories. Given the existing expiring-credit note, prefer a useful library across the persistent clients once the pipeline is proven, but do not burn credits just to maximize line count.

Every generated line must come from authored content. No endpoint may accept arbitrary learner-supplied text for generation in Phase 20.

## 7. R2 architecture

Introduce real R2 storage now.

Prefer separate remote buckets:

- `bloomlab-media-dev`
- `bloomlab-media-prod`

Preview uses the dev bucket. Production uses the prod bucket. Local Wrangler uses local emulation unless the repository already establishes another safe convention.

Use a Worker binding such as `MEDIA`.

Do not enable an `r2.dev` public URL and do not make the bucket public.

If the Cloudflare account does not yet contain the buckets, create them with current Wrangler. The currently documented command is:

`npx wrangler r2 bucket create <name>`

If account permissions block creation, stop and report the exact missing Cloudflare step. Do not work around it by making audio public or committing MP3 files.

Use immutable, deterministic object keys. Prefer content-addressed/versioned keys so changing text or voice configuration cannot silently replace historical bytes, for example:

`voice/v1/<voice-character>/<line-id>/<hash>.mp3`

The exact shape is your decision, but object paths must be normalized and must not be constructed from raw request paths that allow traversal or arbitrary bucket access.

## 8. D1 metadata

Add a new migration. Never modify migrations already applied in production.

The existing schema has no general media metadata table. Add the minimum real metadata structure needed for DATA-006 and future learner media.

A reasonable `media_assets` contract contains concepts such as:

- stable asset ID
- scope/kind
- learner ID when learner-owned, nullable for authored/global content
- client ID
- voice-character ID
- line ID
- R2 object key
- MIME type
- byte length
- checksum/source hash
- provider
- provider model
- provider voice ID
- created timestamp
- content version/hash or generation version

Do not store binary data or base64 audio in D1.

Do not mirror the entire curriculum into D1. This table is a storage index/metadata record, not a second curriculum database.

Make object/metadata creation idempotent. A retry must not charge ElevenLabs again when the exact generated asset already exists.

## 9. Worker boundaries

Keep ElevenLabs and R2 access server-side.

Add a focused Worker module rather than bloating `worker/src/index.ts`.

Recommended responsibilities:

### Authenticated media playback/read

A route such as:

`GET /api/media/voice/:asset_id`

must:

- authenticate using the existing device session mechanism
- resolve a known metadata/content asset, never arbitrary object keys from the caller
- read from the bound R2 bucket
- return the correct audio content type
- avoid exposing bucket credentials or internal object metadata unnecessarily
- return 401 when there is no valid session
- return 403 when a learner attempts to fetch another learner's private media, once learner-owned assets exist

For static voice audio, requiring a valid Bloomlab session is acceptable and keeps the entire media path private. Do not create a public bucket to simplify playback.

Support ordinary browser audio playback reliably. If the browser requests HTTP ranges, either implement correct byte-range behavior or prove that the chosen response behavior works in the supported browser probe. Do not return malformed partial-content headers.

### Preview/local generation

Create a tightly bounded generation path for Phase 20. It should be unavailable in production.

A route such as:

`POST /api/voice/generate`

should:

- only exist in local/preview
- require a valid device session
- accept authored voice-character ID + authored line ID, not arbitrary text
- resolve the text and voice configuration from the compiled content bundle
- verify `ELEVENLABS_API_KEY` exists server-side
- make exactly one ElevenLabs request when the asset does not already exist
- validate status/content type/size before accepting the response
- write the bytes to R2
- write/update D1 metadata
- be idempotent for the same immutable asset identity
- sanitize provider failures
- never log the API key or full authorization headers

Do not expose an open text-to-speech proxy.

Production does not need a runtime ElevenLabs call for Phase 20. Therefore do not require `ELEVENLABS_API_KEY` in production merely to play pre-generated files. Dynamic production TTS belongs to Phase 21.

The preview secret should be a Cloudflare Worker secret, not a Vite variable or committed file.

If the secret is missing, generation must fail cleanly while already generated R2 playback still works.

## 10. Generate once, promote exact bytes, do not spend twice

The desired operational flow is:

1. generate/audition against preview using the dev R2 bucket
2. prove the chosen assets are correct
3. copy the exact generated bytes to the production R2 bucket
4. do not call ElevenLabs again merely to populate production

Current Wrangler v4 supports remote object transfer with commands shaped like:

- `npx wrangler r2 object get bucket/key --remote --file <file>`
- `npx wrangler r2 object put bucket/key --remote --file <file> --content-type audio/mpeg`

Verify current syntax before scripting it.

Build a repeatable promotion script or documented command that copies only the known manifest of authored voice assets. It must never recursively copy arbitrary learner media.

Temporary local audio used during promotion must be deleted after verification and must not be committed.

## 11. Playback proof must not be a disguised TTS call

VOI-002 means the learner can replay the generated line with ElevenLabs unavailable.

Prove this explicitly.

Unit/integration tests should show that:

- generation provider is called once when the immutable asset is absent
- a repeated generation request reuses the asset without calling the provider again
- playback does not import or invoke the ElevenLabs provider at all
- playback still succeeds when the provider is configured to fail/missing
- the browser only requests Bloomlab's media endpoint during playback, not ElevenLabs

Do not claim this from architecture alone.

## 12. Internal review surface, not an unfinished Call Room

Phase 20 needs a way to inspect the voice library.

Add a small diagnostics/review surface under the existing non-production system diagnostics behavior, for example `/system/voice`, if that fits the current shell.

It may show:

- fictional client
- voice-character ID
- selected line/category
- Play control
- whether the asset exists
- safe non-secret metadata useful for review

It should not resemble or claim to be the Call Room.

Do not enable `voice_calls` as a learner feature in production during Phase 20.

Review this diagnostics surface at all five project widths if it is rendered through the web app:

1440 / 1024 / 768 / 390 / 320

Use 44 px touch targets and 16 px input/select text on phones. No new eyebrow/kicker or monospace violations.

## 13. Security and privacy

Enforce SEC-001 for the new provider:

`ELEVENLABS_API_KEY` must never appear in:

- browser code
- Vite env vars
- bundled curriculum
- Git commits
- R2 object metadata that the browser receives
- D1 rows
- logs
- PR descriptions
- screenshots

Add a source/build assertion that the client bundle contains no ElevenLabs SDK/key literal or direct request to `api.elevenlabs.io`.

Prefer direct `fetch` in the Worker over adding a provider SDK unless the SDK materially improves the implementation.

Do not store learner audio in this phase because the learner is not recording yet.

Do not expose R2 with a public development URL.

## 14. Tests

Add focused tests for at least:

- voice-character schema contains all seven required fields
- every existing client's `voice.character` resolves correctly
- client/voice registry mismatch rejected
- actual persistent voice ID is not empty/placeholder
- line IDs unique inside a character
- required six reusable line kinds represented for the acceptance library
- immutable object-key construction
- no path traversal / arbitrary R2 key access
- generation missing secret
- generation unavailable in production
- generation provider 4xx/429/5xx/timeout sanitized
- generation invalid/non-audio response rejected
- generation object write failure does not create lying completed metadata
- metadata write failure is recoverable/idempotent without unnecessary re-generation where possible
- duplicate generation is provider-free
- authenticated playback success
- unauthenticated playback 401
- wrong learner/private scope 403 where applicable
- missing object/metadata honest 404
- playback provider-free
- D1 stores metadata only
- client bundle has no ElevenLabs secret/provider code
- R2 dev/prod configuration is distinct

Do not weaken existing tests.

## 15. Browser/review probe

Add a `review:voice` style probe consistent with the repository's review system.

The probe should prove, using real preview infrastructure where possible:

- diagnostics surface renders at five widths
- client/voice identity stays stable across reload
- Play loads a real R2-backed audio response
- no horizontal overflow
- phone target/input requirements pass
- unauthorized media fetch returns 401
- playback performs no ElevenLabs request

Do not call a transport fixture "live R2 evidence". Label fixture-only browser behavior honestly.

## 16. Live infrastructure verification

Phase 20 is not complete from mocks alone.

Before opening the final PR report, prove on preview:

1. preview deploy succeeds with the R2 binding
2. preview D1 migration succeeds
3. `ELEVENLABS_API_KEY` is configured securely in preview
4. at least one real ElevenLabs TTS request succeeds through the Worker generation boundary
5. returned audio is written to `bloomlab-media-dev`
6. D1 contains matching metadata and no binary audio
7. the same asset plays through Bloomlab's media route
8. repeat playback creates no ElevenLabs call
9. repeat generation for the same immutable line does not spend again
10. an unauthenticated fetch returns 401
11. exact approved audio bytes are promoted to `bloomlab-media-prod` without another TTS generation

Do not run a production Worker deployment from the implementation branch. Production deploy remains the post-merge path.

If the preview secret, R2 buckets or account permissions are missing, stop at that exact infrastructure gate and report it. Do not fake evidence.

## 17. Secret setup likely required

Do not ask the user to paste an ElevenLabs key into chat or commit it.

When implementation reaches live preview generation, the expected secure user-side command will likely be:

```bash
cd /workspaces/Bloomlab/worker
npx wrangler secret put ELEVENLABS_API_KEY --env preview
```

Verify the branch's final Wrangler config before telling the user to run it.

Do not require a production ElevenLabs secret in Phase 20 unless runtime production TTS was explicitly moved into this phase by the live source of truth. It currently belongs to Phase 21.

## 18. Requirement status discipline

At closeout, inspect the actual matrix and acceptance tests.

Expected Phase 20 targets:

- VOI-001
- VOI-002
- VOI-004
- VOI-005
- DATA-006
- DATA-007

Potentially affected cross-cutting requirements include:

- SEC-001
- INF-001
- INF-004
- INF-011

Do not automatically mark cross-cutting requirements PASSED if their full all-phase acceptance is not proven.

Keep these later requirements honest:

- VOI-003 stays NOT_STARTED unless Phase 21 dynamic TTS is actually built
- VOI-006 stays NOT_STARTED
- VOI-007 stays NOT_STARTED
- CALL-* stays NOT_STARTED
- EXR-015 stays NOT_STARTED
- `voice_calls` remains off

If only one client has a configured registry/asset library while other existing `VC-*` references remain unresolved, VOI-004 cannot honestly be PASSED.

## 19. Versions and docs

Because the voice registry and authored line library are content, bump content version/lock according to the existing repository convention.

Do not bump:

- simulator version
- mastery version
- exercise grader version

unless you actually change those contracts.

Update:

- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md` evidence
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGELOG.md`
- `docs/DECISIONS.md`
- a new `docs/reviews/phase-20-voice-assets.md`

Document the external API verification date and chosen ElevenLabs model/output format without putting credentials in the repo.

## 20. Full verification

Run under pinned Node 22:

- typecheck
- lint
- format check
- full tests
- docs validation
- content check
- content lock validation
- production build

Run the new voice probe plus existing high-risk probes affected by Worker routing/auth/navigation.

At minimum re-run sync/auth and the app shell/navigation review if a system route or media route is added.

## 21. PR behavior

Commit focused changes using requirement IDs.

Push `codex/phase-20-voice-assets` and open a PR to `main`.

Do not merge it.

The final Astra report must include:

- verified base SHA
- branch
- PR number
- exact final head SHA
- exact requirements/statuses changed
- registry shape and how every current client reference resolves
- real ElevenLabs voice IDs used, without any secret
- current TTS model/output format and verification date
- number of generated assets and categories per client
- total ElevenLabs characters/credits consumed if the provider exposes enough information to state this accurately
- R2 dev/prod bucket names and object-key strategy
- D1 migration/table summary
- authentication behavior
- provider-free playback evidence
- duplicate-generation/idempotency evidence
- live preview generation evidence
- live preview R2 + D1 playback evidence
- production R2 promotion evidence
- test count and test-file count
- all browser/review probe results
- versions changed and deliberately unchanged
- every remaining limitation
- whether any user action is still required

Stop with the PR open.

ChatGPT performs the independent audit and merge.
