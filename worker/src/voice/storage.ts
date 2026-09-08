import type { VoiceCharacter, VoiceLine } from '@bloomlab/content-schema';
import { VOICE_GENERATION } from './config.ts';
import { VoiceError } from './errors.ts';
import type { voiceIdentity } from './identity.ts';

export interface MediaAsset {
  asset_id: string;
  scope: 'authored' | 'learner';
  kind: 'voice';
  learner_id: string | null;
  client_id: string;
  voice_character_id: string;
  line_id: string;
  object_key: string;
  mime_type: string;
  byte_length: number;
  checksum: string;
  source_hash: string;
  provider: string;
  provider_model: string;
  provider_voice_id: string;
  created_at: string;
  content_version: string;
  content_hash: string;
  generation_version: string;
}

export async function getAsset(db: D1Database, id: string): Promise<MediaAsset | null> {
  return db.prepare('SELECT * FROM media_assets WHERE asset_id = ?').bind(id).first<MediaAsset>();
}

/** R2 is written first; its private metadata makes a failed D1 write recoverable without TTS. */
export async function indexStoredVoice(
  db: D1Database,
  object: R2Object,
  identity: Awaited<ReturnType<typeof voiceIdentity>>,
  voice: VoiceCharacter,
  line: VoiceLine,
): Promise<MediaAsset> {
  const meta = object.customMetadata ?? {};
  if (
    object.key !== identity.object_key ||
    object.size < 4 ||
    object.size > VOICE_GENERATION.maxBytes ||
    object.httpMetadata?.contentType !== VOICE_GENERATION.mimeType ||
    meta.source_hash !== identity.source_hash ||
    !/^[a-f0-9]{64}$/.test(meta.checksum ?? '') ||
    !meta.created_at ||
    !meta.content_version ||
    !meta.content_hash
  )
    throw new VoiceError('stored_asset_invalid', 409);
  const asset: MediaAsset = {
    ...identity,
    scope: 'authored',
    kind: 'voice',
    learner_id: null,
    client_id: voice.client,
    voice_character_id: voice.id,
    line_id: line.id,
    mime_type: VOICE_GENERATION.mimeType,
    byte_length: object.size,
    checksum: meta.checksum!,
    provider: 'elevenlabs',
    provider_model: VOICE_GENERATION.model,
    provider_voice_id: voice.voice_id,
    created_at: meta.created_at,
    content_version: meta.content_version,
    content_hash: meta.content_hash,
    generation_version: VOICE_GENERATION.version,
  };
  const columns = Object.keys(asset);
  await db
    .prepare(
      `INSERT OR IGNORE INTO media_assets (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
    )
    .bind(...Object.values(asset))
    .run();
  const stored = await getAsset(db, asset.asset_id);
  if (
    !stored ||
    columns.some((key) => stored[key as keyof MediaAsset] !== asset[key as keyof MediaAsset])
  )
    throw new VoiceError('metadata_conflict', 409);
  await db
    .prepare(
      "UPDATE voice_generation_jobs SET status='complete', provider_request_id=?, billed_characters=?, updated_at=? WHERE asset_id=?",
    )
    .bind(
      meta.provider_request_id || null,
      /^\d+$/.test(meta.billed_characters ?? '') ? Number(meta.billed_characters) : null,
      new Date().toISOString(),
      asset.asset_id,
    )
    .run();
  return stored;
}
