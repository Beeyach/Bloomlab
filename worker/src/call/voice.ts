import content from 'virtual:bloomlab-content';
import type { VoiceLine } from '@bloomlab/content-schema';
import type { Session } from '../sync/auth';
import { voiceIdentity, sha256 } from '../voice/identity';
import { elevenLabs, type GeneratedAudio, type VoiceProvider } from '../voice/provider';
import { VOICE_GENERATION } from '../voice/config';
import { getAsset } from '../voice/storage';
import { callContent, currentState, getAttempt, type CallStorage } from './store';
import { CallError } from './errors';
interface VoiceRow {
  asset_id: string;
  learner_id: string;
  attempt_id: string;
  object_key: string;
  status: string;
  byte_length: number | null;
  checksum: string | null;
}
/** The caller supplies a saved attempt/turn only. Text and voice always come from server state. */
export async function clientAudio(
  env: CallStorage & { ELEVENLABS_API_KEY?: string },
  session: Session,
  attemptId: string,
  turn: number,
  injected?: VoiceProvider,
) {
  const attempt = await getAttempt(env.DB, session, attemptId);
  const state = currentState(attempt).snapshot;
  const line =
    turn === state.turn ? state.current : state.turns.find((t) => t.turn === turn)?.client;
  if (!Number.isInteger(turn) || !line) throw new CallError('unknown_turn', 404);
  const { client } = callContent(attempt.exercise_id);
  const voice = content.voice_characters.find((v) => v.id === client.voice.character)!;
  const authored = voice.lines.find((candidate) => candidate.text.trim() === line.text.trim());
  if (authored) {
    const identity = await voiceIdentity(voice, authored);
    if (
      !(await getAsset(env.DB, identity.asset_id)) ||
      !(await env.MEDIA.head(identity.object_key))
    )
      throw new CallError('audio_unavailable', 404);
    return { url: `/api/media/voice/${identity.asset_id}`, source: 'authored', cached: true };
  }
  if (!line.dynamic) throw new CallError('audio_unavailable', 404);
  // The generation hash includes every Phase 20 voice/model/format setting plus owner/call scope.
  const fictional: VoiceLine = {
    id: 'call-response',
    kind: 'scenario',
    text: line.text,
    emotion: voice.allowed_emotion_range[0]!,
  };
  const identity = await voiceIdentity(voice, fictional);
  const assetId = `CV-${await sha256(`${session.learnerId}:${attemptId}:${identity.source_hash}`)}`;
  const key = `call/voice/v1/${session.learnerId}/${attemptId}/${assetId}.mp3`;
  const row = await env.DB.prepare('SELECT * FROM call_voice_assets WHERE asset_id=?')
    .bind(assetId)
    .first<VoiceRow>();
  if (row?.status === 'ready' && (await env.MEDIA.head(key)))
    return { url: `/api/call/voice/${assetId}`, source: 'dynamic', cached: true };
  // Recover an R2 write completed before its D1 update without contacting ElevenLabs again.
  const stored = await env.MEDIA.head(key);
  if (
    row &&
    stored?.customMetadata?.source_hash === identity.source_hash &&
    /^[a-f0-9]{64}$/.test(stored.customMetadata?.checksum ?? '') &&
    stored.httpMetadata?.contentType === 'audio/mpeg' &&
    stored.size >= 4 &&
    stored.size <= VOICE_GENERATION.maxBytes
  ) {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE call_voice_assets SET status='ready',byte_length=?,checksum=? WHERE asset_id=?",
      ).bind(stored.size, stored.customMetadata.checksum, assetId),
      env.DB.prepare(
        "UPDATE voice_generation_jobs SET status='complete',provider_request_id=?,billed_characters=?,updated_at=? WHERE asset_id=?",
      ).bind(
        stored.customMetadata.provider_request_id || null,
        /^\d+$/.test(stored.customMetadata.billed_characters ?? '')
          ? Number(stored.customMetadata.billed_characters)
          : null,
        new Date().toISOString(),
        assetId,
      ),
    ]);
    return { url: `/api/call/voice/${assetId}`, source: 'dynamic', cached: true };
  }
  if (row) throw new CallError('audio_unavailable');
  if (!injected && !env.ELEVENLABS_API_KEY) throw new CallError('audio_unavailable');
  const mode = await env.DB.prepare('SELECT ai_mode FROM learners WHERE learner_id=?')
    .bind(session.learnerId)
    .first<{ ai_mode: string | null }>();
  if (mode?.ai_mode === 'Off') throw new CallError('audio_unavailable');
  const claim = await env.DB.prepare(
    "INSERT OR IGNORE INTO call_voice_assets (asset_id,learner_id,attempt_id,object_key,status,created_at) VALUES (?,?,?,?,'processing',?)",
  )
    .bind(assetId, session.learnerId, attemptId, key, new Date().toISOString())
    .run();
  if (!claim.meta.changes) throw new CallError('audio_in_progress', 409);
  let received: GeneratedAudio | undefined;
  try {
    // Reuse the existing provider receipt ledger, scoped by the private CV asset identity.
    // The call_voice_assets claim still owns authorization and prevents a second purchase.
    await env.DB.prepare(
      "INSERT INTO voice_generation_jobs (asset_id,status,provider_attempts,updated_at) VALUES (?,'active',1,?)",
    )
      .bind(assetId, new Date().toISOString())
      .run();
    const generated = await (injected ?? elevenLabs(env.ELEVENLABS_API_KEY!))(voice, fictional);
    received = generated;
    if (generated.bytes.byteLength < 4 || generated.bytes.byteLength > VOICE_GENERATION.maxBytes)
      throw new CallError('audio_unavailable');
    const checksum = await sha256(generated.bytes);
    await env.MEDIA.put(key, generated.bytes, {
      httpMetadata: { contentType: 'audio/mpeg' },
      customMetadata: {
        checksum,
        source_hash: identity.source_hash,
        provider_request_id: generated.requestId ?? '',
        billed_characters:
          generated.billedCharacters === null ? '' : String(generated.billedCharacters),
      },
    });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE call_voice_assets SET status='ready',byte_length=?,checksum=? WHERE asset_id=?",
      ).bind(generated.bytes.byteLength, checksum, assetId),
      env.DB.prepare(
        "UPDATE voice_generation_jobs SET status='complete',provider_request_id=?,billed_characters=?,updated_at=? WHERE asset_id=?",
      ).bind(generated.requestId, generated.billedCharacters, new Date().toISOString(), assetId),
    ]);
    return { url: `/api/call/voice/${assetId}`, source: 'dynamic', cached: false };
  } catch {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE call_voice_assets SET status='uncertain' WHERE asset_id=? AND status!='ready'",
      ).bind(assetId),
      env.DB.prepare(
        "UPDATE voice_generation_jobs SET status='uncertain',provider_request_id=COALESCE(?,provider_request_id),billed_characters=COALESCE(?,billed_characters),updated_at=? WHERE asset_id=? AND status!='complete'",
      ).bind(
        received?.requestId ?? null,
        received?.billedCharacters ?? null,
        new Date().toISOString(),
        assetId,
      ),
    ]);
    throw new CallError('audio_unavailable');
  }
}
export async function playClientVoice(env: CallStorage, session: Session, id: string) {
  if (!/^CV-[a-f0-9]{64}$/.test(id)) throw new CallError('not_found', 404);
  const row = await env.DB.prepare('SELECT * FROM call_voice_assets WHERE asset_id=?')
    .bind(id)
    .first<VoiceRow>();
  if (!row) throw new CallError('not_found', 404);
  if (row.learner_id !== session.learnerId) throw new CallError('forbidden', 403);
  if (row.status !== 'ready') throw new CallError('audio_unavailable', 404);
  const audio = await env.MEDIA.get(row.object_key);
  if (!audio || audio.size !== row.byte_length) throw new CallError('audio_unavailable', 404);
  return new Response(audio.body, {
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
