import content from 'virtual:bloomlab-content';
import { VOICE_GENERATION } from './config.ts';
import { VoiceError } from './errors.ts';
import { sha256, voiceIdentity } from './identity.ts';
import { elevenLabs, type GeneratedAudio, type VoiceProvider } from './provider.ts';
import { indexStoredVoice } from './storage.ts';

export interface VoiceEnvironment {
  DB: D1Database;
  MEDIA: R2Bucket;
  BLOOMLAB_ENV: string;
  ELEVENLABS_API_KEY?: string;
}

export function authoredLine(character: string, id: string) {
  const voice = content.voice_characters.find((v) => v.id === character);
  const line = voice?.lines.find((l) => l.id === id);
  if (!voice || !line || voice.asset_delivery === 'text')
    throw new VoiceError('authored_line_not_found', 404);
  return { voice, line };
}

/** Called only after session auth; no caller text or voice configuration crosses this boundary. */
export async function generateVoice(
  character: string,
  id: string,
  env: VoiceEnvironment,
  provider?: VoiceProvider,
) {
  if (env.BLOOMLAB_ENV !== 'preview' && env.BLOOMLAB_ENV !== 'local')
    throw new VoiceError('not_found', 404);
  const { voice, line } = authoredLine(character, id);
  const identity = await voiceIdentity(voice, line);
  const reuse = async () => {
    const object = await env.MEDIA.head(identity.object_key);
    if (!object) return null;
    await indexStoredVoice(env.DB, object, identity, voice, line);
    return { asset_id: identity.asset_id, reused: true };
  };
  const existing = await reuse();
  if (existing) return existing;
  if (!env.ELEVENLABS_API_KEY && !provider) throw new VoiceError('voice_not_configured');
  const claim = await env.DB.prepare(
    `INSERT INTO voice_generation_jobs(asset_id,status,updated_at)
    VALUES (?,'active',?) ON CONFLICT(asset_id) DO UPDATE SET status='active',updated_at=excluded.updated_at
    WHERE voice_generation_jobs.status='retryable'`,
  )
    .bind(identity.asset_id, new Date().toISOString())
    .run();
  if (!claim.meta.changes) {
    const completed = await reuse();
    if (completed) return completed;
    throw new VoiceError('generation_needs_reconciliation', 409);
  }
  let received: GeneratedAudio | undefined;
  try {
    await env.DB.prepare(
      'UPDATE voice_generation_jobs SET provider_attempts=provider_attempts+1 WHERE asset_id=?',
    )
      .bind(identity.asset_id)
      .run();
    const audio = await (provider ?? elevenLabs(env.ELEVENLABS_API_KEY!))(voice, line);
    received = audio;
    const checksum = await sha256(audio.bytes);
    const object = await env.MEDIA.put(identity.object_key, audio.bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      sha256: checksum,
      httpMetadata: { contentType: VOICE_GENERATION.mimeType },
      customMetadata: {
        checksum,
        source_hash: identity.source_hash,
        created_at: new Date().toISOString(),
        content_version: content.content_version,
        content_hash: content.content_hash,
        provider_request_id: audio.requestId ?? '',
        billed_characters: audio.billedCharacters === null ? '' : String(audio.billedCharacters),
      },
    });
    if (!object) {
      const completed = await reuse();
      if (completed) return completed;
      throw new VoiceError('object_write_failed');
    }
    await indexStoredVoice(env.DB, object, identity, voice, line);
    return { asset_id: identity.asset_id, reused: false };
  } catch (error) {
    // A timeout, interrupted Worker or failed object write may already be billed. Never reclaim
    // that purchase automatically. A later request can still recover existing R2 bytes above.
    await env.DB.prepare(
      `UPDATE voice_generation_jobs SET status=?,updated_at=?,
       provider_request_id=COALESCE(?,provider_request_id),
       billed_characters=COALESCE(?,billed_characters) WHERE asset_id=?`,
    )
      .bind(
        error instanceof VoiceError && error.retryable ? 'retryable' : 'uncertain',
        new Date().toISOString(),
        received?.requestId ?? null,
        received?.billedCharacters ?? null,
        identity.asset_id,
      )
      .run();
    throw error;
  }
}
