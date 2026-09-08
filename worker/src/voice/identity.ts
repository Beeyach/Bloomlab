import type { VoiceCharacter, VoiceLine } from '@bloomlab/content-schema';
import { VOICE_GENERATION } from './config.ts';

export const ASSET_ID = /^VA-[a-f0-9]{64}$/;
export const VOICE_OBJECT_KEY =
  /^voice\/v1\/VC-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{64}\.mp3$/;

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash only this line's generation inputs. Unrelated curriculum changes never spend again. */
export async function voiceIdentity(voice: VoiceCharacter, line: VoiceLine) {
  const source_hash = await sha256(
    JSON.stringify({
      version: VOICE_GENERATION.version,
      model: VOICE_GENERATION.model,
      format: VOICE_GENERATION.outputFormat,
      similarity: VOICE_GENERATION.similarityBoost,
      speaker_boost: VOICE_GENERATION.speakerBoost,
      client: voice.client,
      character: voice.id,
      voice: voice.voice_id,
      speed: voice.speech_rate,
      style: voice.style,
      stability: voice.stability,
      language: voice.language,
      line: { id: line.id, kind: line.kind, text: line.text, emotion: line.emotion },
    }),
  );
  const object_key = `voice/${VOICE_GENERATION.version}/${voice.id}/${line.id}/${source_hash}.mp3`;
  if (!VOICE_OBJECT_KEY.test(object_key)) throw new Error('Invalid authored voice identity');
  return { asset_id: `VA-${source_hash}`, source_hash, object_key };
}
