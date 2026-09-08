import content from 'virtual:bloomlab-content';
import { z } from 'zod';
import { authenticate } from '../sync/auth';
import { VoiceError, voiceFailure, voiceJson } from './errors.ts';
import { generateVoice, type VoiceEnvironment } from './generate.ts';
import { voiceIdentity } from './identity.ts';
import { readBounded, type VoiceProvider } from './provider.ts';
import { getAsset } from './storage.ts';

const generationRequest = z.strictObject({
  character_id: z
    .string()
    .regex(/^VC-[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  line_id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
});

export async function handleVoice(
  request: Request,
  env: VoiceEnvironment,
  provider?: VoiceProvider,
): Promise<Response> {
  if (env.BLOOMLAB_ENV !== 'local' && env.BLOOMLAB_ENV !== 'preview')
    return voiceJson({ error: 'not_found' }, 404);
  try {
    const session = await authenticate(request, env.DB);
    if (!session) throw new VoiceError('device_not_linked', 401);
    const url = new URL(request.url);
    if (url.pathname === '/api/voice/generate') {
      if (request.method !== 'POST') throw new VoiceError('method_not_allowed', 405);
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
        throw new VoiceError('invalid_request', 400);
      const body = await readBounded(request.body, 1024).catch(() => {
        throw new VoiceError('invalid_request', 400);
      });
      const parsed = generationRequest.parse(JSON.parse(new TextDecoder().decode(body)));
      return voiceJson(await generateVoice(parsed.character_id, parsed.line_id, env, provider));
    }
    if (url.pathname === '/api/voice/library') {
      if (request.method !== 'GET') throw new VoiceError('method_not_allowed', 405);
      const voice = content.voice_characters.find(
        (v) => v.id === url.searchParams.get('character'),
      );
      if (!voice) throw new VoiceError('authored_character_not_found', 404);
      const assets = await Promise.all(
        voice.lines.map(async (line) => {
          const identity = await voiceIdentity(voice, line);
          const stored = await getAsset(env.DB, identity.asset_id);
          const object =
            stored?.scope === 'authored' && stored.object_key === identity.object_key
              ? await env.MEDIA.head(stored.object_key)
              : null;
          return {
            asset_id: identity.asset_id,
            character_id: voice.id,
            line_id: line.id,
            available: !!object && object.size === stored?.byte_length,
            byte_length: object?.size ?? null,
          };
        }),
      );
      return voiceJson({ assets });
    }
    throw new VoiceError('not_found', 404);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return voiceJson({ error: 'invalid_request' }, 400);
    return voiceFailure(error);
  }
}
