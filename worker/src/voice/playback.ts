import { authenticate } from '../sync/auth';
import { ASSET_ID, VOICE_OBJECT_KEY } from './identity.ts';
import { VoiceError, voiceFailure } from './errors.ts';
import { getAsset } from './storage.ts';

/** This module has no generation/provider import. Even an absent provider secret is irrelevant. */
export async function handleMedia(
  request: Request,
  env: { DB: D1Database; MEDIA: R2Bucket },
): Promise<Response> {
  try {
    const session = await authenticate(request, env.DB);
    if (!session) throw new VoiceError('device_not_linked', 401);
    if (request.method !== 'GET' && request.method !== 'HEAD')
      throw new VoiceError('method_not_allowed', 405);
    const path = new URL(request.url).pathname;
    const id = path.slice('/api/media/voice/'.length);
    if (!path.startsWith('/api/media/voice/') || !ASSET_ID.test(id))
      throw new VoiceError('not_found', 404);
    const asset = await getAsset(env.DB, id);
    if (!asset) throw new VoiceError('not_found', 404);
    if (asset.scope === 'learner' && asset.learner_id !== session.learnerId)
      throw new VoiceError('forbidden', 403);
    if (asset.kind !== 'voice' || !VOICE_OBJECT_KEY.test(asset.object_key))
      throw new VoiceError('not_found', 404);
    const head = await env.MEDIA.head(asset.object_key);
    if (!head || head.size !== asset.byte_length) throw new VoiceError('not_found', 404);
    const headers = new Headers({
      'content-type': 'audio/mpeg',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'accept-ranges': 'bytes',
      'content-length': String(head.size),
      etag: `"${asset.checksum}"`,
    });
    let range: { offset: number; length: number } | undefined;
    const requested = request.headers.get('range');
    const ifRange = request.headers.get('if-range');
    if (requested && request.method === 'GET' && (!ifRange || ifRange === headers.get('etag'))) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
      let start = NaN,
        end = NaN;
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, head.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), head.size - 1) : head.size - 1;
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= head.size
      ) {
        headers.set('content-range', `bytes */${head.size}`);
        headers.set('content-length', '0');
        return new Response(null, { status: 416, headers });
      }
      range = { offset: start, length: end - start + 1 };
      headers.set('content-range', `bytes ${start}-${end}/${head.size}`);
      headers.set('content-length', String(range.length));
    }
    if (request.method === 'HEAD') return new Response(null, { headers });
    const object = await env.MEDIA.get(asset.object_key, range ? { range } : undefined);
    if (!object) throw new VoiceError('not_found', 404);
    return new Response(object.body, { status: range ? 206 : 200, headers });
  } catch (error) {
    return voiceFailure(error);
  }
}
