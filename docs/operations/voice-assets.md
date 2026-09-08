# Voice asset operations

Phase 20 generates authored fictional-client speech once in preview, then promotes the same bytes to production. The production Worker never needs ElevenLabs to play these files. Run commands from the repository root with Node 22 and an authenticated Wrangler session.

## Author and audition

1. Verify voice IDs against the connected ElevenLabs account's catalog. Author identity, settings, line text and emotion in `content/voice-characters/`. Every client's `voice.character` must resolve back to that client.
2. Bump `content/content.yaml` and run `npm run content:lock`. Run the repository checks. Generation inputs are hashed independently of unrelated curriculum changes.
3. Configure the preview Worker's `ELEVENLABS_API_KEY` as a Cloudflare **Secret**, never a plain variable or Vite variable. In a terminal you control, use `cd worker` then `npx wrangler secret put ELEVENLABS_API_KEY --env preview`; paste only into Wrangler's hidden prompt. Do not paste credentials into chat. A pending undeployed version may require completing its deployment or using Wrangler's versioned secret flow first.
4. Build preview with `CLOUDFLARE_ENV=preview npm run build:preview -w @bloomlab/web`, apply preview migrations from `worker/` with `npx wrangler d1 migrations apply bloomlab-dev --remote --env preview`, and deploy from `apps/web/` using `npx wrangler deploy`. Verify the generated configuration names `bloomlab-preview` and `bloomlab-media-dev` first.
5. Run `BASE=https://bloomlab-preview.cool-sunset-2169.workers.dev npm run voice:generate -- audition`. This creates a disposable session, generates only the five authored greetings, repeats each request, checks two media reads against D1 checksums, verifies anonymous 401, and revokes the session.
6. Inspect the real audio at `/system/voice`. `BASE=... npm run review:voice` decodes it in Chrome, checks signal levels and private playback at all five widths, and writes a local report to `.review/`. Override `CHROME` and `CHROME_FLAGS` for the installed browser/container. This automated inspection does not establish subjective accent or performance quality.
7. Once the voice choices are stable, run `BASE=... npm run voice:generate -- all`. Greetings are reused; only missing authored lines reach ElevenLabs. Every line covers a fixed authored request, never caller-supplied text. Reports contain provider-reported billed character units when available, not a guessed dollar cost. Run the browser probe again with `VOICE_REVIEW_ALL=1` to decode every saved line before promotion.

The six kinds are greeting, objection, interruption, voicemail, recurring and scenario. Changing text, voice settings or generation configuration creates a new asset identity. Keep historical objects; do not overwrite or delete them merely because current content changed.

## Promote and deploy

`npm run voice:promote` reads only the current authored manifest from preview D1. For each known asset it downloads development bytes, verifies SHA-256 and length, checks for an existing production object, refuses different historical bytes, uploads missing bytes with `audio/mpeg`, and downloads production bytes to verify them again. Transfers use bounded batches of four independent objects, settling the entire batch before cleanup. It deletes its own temporary audio directory even on failure. It does not call ElevenLabs or select learner-owned media.

Commit the resulting `docs/operations/voice-assets.json`: metadata only, including stable IDs, private object keys, checksums, provenance and creation timestamps. Audio files stay outside Git. `npm run voice:check` verifies manifest coverage and provenance against compiled content without network access; CI runs it before accepting a PR. Re-running promotion is safe and does not spend provider credits.

After independent review and merge, the main CI deployment applies `0003_media_assets.sql` to production, runs `npm run voice:index`, then deploys the Worker. Indexing verifies all production bytes before publishing authored metadata to production D1 and refuses conflicting rows. Production credentials need D1 write and R2 read permissions in addition to the existing Worker deployment permissions. A failure stops deployment; repair the exact permission/object/metadata issue and rerun. Never generate a second production copy using TTS. The implementation branch may promote R2 objects but must not migrate/deploy the production Worker or run production indexing.

Both `bloomlab-media-dev` and `bloomlab-media-prod` keep public `r2.dev` access disabled. Browser playback authenticates a Bloomlab device session at `/api/media/voice/:asset_id`; it receives no bucket URL or provider credential. Native playback uses a fetched blob URL because an audio element cannot attach the session's bearer header. Private responses use `no-store`; media is fetched again after reload rather than added to the PWA cache. The route also implements single HTTP byte ranges, HEAD and If-Range.

## Reconcile a failed purchase

`voice_generation_jobs` records the atomic claim, provider attempt count, outcome, provider request ID and billed units when received. D1 `media_assets` contains metadata only. Preview R2 objects retain private recovery metadata so a metadata-write failure can be repaired by repeating the same authored generation request without contacting ElevenLabs.

- Missing provider secret: configure it only if new generation is needed. Saved media remains playable.
- Known provider 4xx/429 rejection: an explicit retry may claim the job again; the Worker performs no automatic retry.
- Timeout, interrupted Worker, invalid provider response or failed object write: the outcome may already be billed. The job stays active/uncertain and a subsequent request returns `generation_needs_reconciliation` (409) if no valid object exists. Do not clear the claim automatically.
- Use the recorded request ID and ElevenLabs generation history to establish whether usable paid audio exists. Recover matching bytes and verified metadata through an operator-controlled repair if possible. Only mark a job retryable after confirming no usable purchase exists or explicitly deciding to pay for replacement. There is no automatic history import or reconciliation UI in Phase 20.
- Existing R2 bytes with invalid recovery metadata or a conflicting D1 row stop with 409; inspect the exact asset instead of overwriting it.

The centralized generation contract is `worker/src/voice/config.ts`: `eleven_multilingual_v2`, `mp3_44100_128`, at most 2 MiB and a 30-second provider deadline. Language and emotion are authored direction; this model does not support `language_code`, so only documented numeric voice settings are transmitted. Actual voices may change in the provider catalog; previously stored audio remains available regardless.

Official request/storage references verified 2026-09-07: [ElevenLabs TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [voice catalog](https://elevenlabs.io/docs/api-reference/voices/search), [voice settings](https://elevenlabs.io/docs/api-reference/voices/settings/get), [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [R2 Wrangler commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/).
