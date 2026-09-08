import { z } from 'zod';
import { authenticate } from '../sync/auth';
import { anthropic, type Provider } from '../ai/provider';
import type { VoiceProvider } from '../voice/provider';
import { callBody, CallError, callFailure, callJson } from './errors';
import { configuredSpeech, type SpeechProvider } from './google';
import {
  currentState,
  deleteRecording,
  getAttempt,
  getRecording,
  recordingView,
  startCall,
  uploadRecording,
  type CallStorage,
  type RecordingRow,
} from './store';
import { evaluateTurn } from './turns';
import { clientAudio, playClientVoice } from './voice';

export interface CallEnv extends CallStorage {
  BLOOMLAB_ENV: string;
  GOOGLE_CLOUD_CREDENTIAL?: string;
  ANTHROPIC_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  CALLS_ENABLED?: string;
}
export interface CallDependencies {
  speech?: SpeechProvider;
  ai?: Provider;
  voice?: VoiceProvider;
}
/** Every endpoint authenticates a live, non-revoked device, including metadata and playback. */
export async function handleCall(
  request: Request,
  env: CallEnv,
  dependencies: CallDependencies = {},
): Promise<Response> {
  try {
    const session = await authenticate(request, env.DB);
    if (!session) throw new CallError('device_not_linked', 401);
    const url = new URL(request.url);
    const path = url.pathname.slice('/api/call/'.length);
    const enabled =
      env.BLOOMLAB_ENV !== 'production' &&
      (Boolean(dependencies.speech) ||
        (env.CALLS_ENABLED === 'true' && Boolean(env.GOOGLE_CLOUD_CREDENTIAL)));
    if (path === 'config' && request.method === 'GET') return callJson({ enabled });
    // Existing recording retrieval/deletion remains available even when new calls are gated.
    const audioMatch = /^voice\/(CV-[a-f0-9]{64})$/.exec(path);
    if (audioMatch && request.method === 'GET')
      return await playClientVoice(env, session, audioMatch[1]!);
    const match =
      /^(attempts|recordings)\/([^/]+)(?:\/(transcribe|turn|audio|recordings|ack))?$/.exec(path);
    if (match?.[1] === 'recordings' && request.method === 'DELETE' && !match[3])
      return callJson(await deleteRecording(env, session, match[2]!));
    if (match?.[1] === 'recordings' && request.method === 'GET') {
      const row = await getRecording(env.DB, session, match[2]!);
      if (!match[3]) return callJson(recordingView(row));
      if (match[3] === 'audio') {
        if (row.deleted_at || row.status === 'deleting')
          throw new CallError('recording_deleted', 410);
        const object = await env.MEDIA.get(row.object_key);
        if (!object) throw new CallError('recording_not_found', 404);
        return new Response(object.body, {
          headers: {
            'content-type': row.mime_type,
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
          },
        });
      }
    }
    if (match?.[1] === 'attempts' && request.method === 'GET') {
      const attempt = await getAttempt(env.DB, session, match[2]!);
      if (!match[3]) return callJson(JSON.parse(attempt.state_json).snapshot);
      if (match[3] === 'recordings') {
        const rows = await env.DB.prepare(
          'SELECT * FROM call_recordings WHERE attempt_id=? ORDER BY created_at',
        )
          .bind(attempt.attempt_id)
          .all<RecordingRow>();
        return callJson(rows.results.map(recordingView));
      }
    }
    if (!enabled) throw new CallError('calls_not_enabled', 503);
    if (path === 'attempts' && request.method === 'POST') {
      const input = z
        .strictObject({ attempt_id: z.string().uuid(), exercise_id: z.string().max(120) })
        .safeParse(await callBody(request));
      if (!input.success) throw new CallError('invalid_attempt', 400);
      return callJson(
        await startCall(env.DB, session, input.data.attempt_id, input.data.exercise_id),
      );
    }
    if (!match) throw new CallError('not_found', 404);
    const [, resource, id, action] = match;
    if (resource === 'recordings' && !action && request.method === 'PUT')
      return callJson(await uploadRecording(request, env, session, id!));
    if (resource === 'recordings' && !action && request.method === 'PATCH') {
      const input = z.strictObject({ retain: z.boolean() }).safeParse(await callBody(request));
      if (!input.success) throw new CallError('invalid_retention', 400);
      const row = await getRecording(env.DB, session, id!);
      if (row.deleted_at || row.status === 'deleting')
        throw new CallError('recording_deleted', 410);
      await env.DB.prepare('UPDATE call_recordings SET retain=? WHERE recording_id=?')
        .bind(input.data.retain ? 1 : 0, id!)
        .run();
      return callJson(recordingView(await getRecording(env.DB, session, id!)));
    }
    if (resource === 'recordings' && action === 'ack' && request.method === 'POST') {
      const row = await getRecording(env.DB, session, id!);
      if (!row.confirmed_transcript) throw new CallError('transcript_not_confirmed', 409);
      return callJson(row.retain ? recordingView(row) : await deleteRecording(env, session, id!));
    }
    if (resource === 'recordings' && action === 'transcribe' && request.method === 'POST') {
      const row = await getRecording(env.DB, session, id!);
      if (row.deleted_at || row.status === 'deleting')
        throw new CallError('recording_deleted', 410);
      if (row.original_transcript) return callJson(recordingView(row));
      const attempt = await getAttempt(env.DB, session, row.attempt_id);
      if (currentState(attempt).snapshot.turn !== row.turn)
        throw new CallError('turn_conflict', 409);
      const claimTime = new Date().toISOString();
      const stale = new Date(Date.now() - 60_000).toISOString();
      const claim = await env.DB.prepare(
        "UPDATE call_recordings SET status='transcribing',updated_at=? WHERE recording_id=? AND deleted_at IS NULL AND (status IN ('uploaded','stt_failed') OR status='transcribing' AND updated_at<?)",
      )
        .bind(claimTime, id!, stale)
        .run();
      if (!claim.meta.changes) throw new CallError('transcription_in_progress', 409);
      try {
        const object = await env.MEDIA.get(row.object_key);
        if (!object || object.size !== row.byte_length)
          throw new CallError('recording_not_found', 404);
        const text = await (dependencies.speech ?? configuredSpeech(env.GOOGLE_CLOUD_CREDENTIAL))(
          await object.arrayBuffer(),
          row.mime_type,
        );
        if (!text.trim()) throw new CallError('speech_empty');
        await env.DB.prepare(
          "UPDATE call_recordings SET status='review',original_transcript=?,updated_at=? WHERE recording_id=? AND status='transcribing' AND updated_at=?",
        )
          .bind(text, new Date().toISOString(), id!, claimTime)
          .run();
        const saved = await getRecording(env.DB, session, id!);
        if (saved.deleted_at || saved.status === 'deleting')
          throw new CallError('recording_deleted', 410);
        return callJson(recordingView(saved));
      } catch (error) {
        await env.DB.prepare(
          "UPDATE call_recordings SET status='stt_failed' WHERE recording_id=? AND status='transcribing' AND updated_at=?",
        )
          .bind(id!, claimTime)
          .run();
        throw error;
      }
    }
    if (resource === 'attempts' && action === 'turn' && request.method === 'POST')
      return callJson(
        await evaluateTurn(
          env.DB,
          session,
          id!,
          await callBody(request),
          dependencies.ai ?? (env.ANTHROPIC_API_KEY ? anthropic(env.ANTHROPIC_API_KEY) : undefined),
        ),
      );
    if (resource === 'attempts' && action === 'audio' && request.method === 'POST') {
      const input = z
        .strictObject({ turn: z.number().int().min(0).max(20) })
        .safeParse(await callBody(request));
      if (!input.success) throw new CallError('invalid_turn', 400);
      return callJson(await clientAudio(env, session, id!, input.data.turn, dependencies.voice));
    }
    throw new CallError('method_not_allowed', 405);
  } catch (error) {
    return callFailure(error);
  }
}
