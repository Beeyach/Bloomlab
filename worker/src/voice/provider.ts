import type { VoiceCharacter, VoiceLine } from '@bloomlab/content-schema';
import { VOICE_GENERATION } from './config.ts';
import { VoiceError } from './errors.ts';

export interface GeneratedAudio {
  bytes: ArrayBuffer;
  requestId: string | null;
  billedCharacters: number | null;
}
export type VoiceProvider = (voice: VoiceCharacter, line: VoiceLine) => Promise<GeneratedAudio>;

export async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<ArrayBuffer> {
  if (!body) throw new VoiceError('empty_response', 502);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new VoiceError('response_too_large', 502);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

/** Exactly one request, no SDK, no provider response bodies in errors or logs. */
export function elevenLabs(
  key: string,
  fetcher: typeof fetch = fetch,
  timeoutMs: number = VOICE_GENERATION.timeoutMs,
): VoiceProvider {
  return async (voice, line) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new VoiceError('provider_timeout', 504));
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        timeout,
        (async () => {
          const response = await fetcher(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=${VOICE_GENERATION.outputFormat}`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'xi-api-key': key,
                'content-type': 'application/json',
                accept: VOICE_GENERATION.mimeType,
              },
              body: JSON.stringify({
                text: line.text,
                model_id: VOICE_GENERATION.model,
                // multilingual_v2 does not support language_code. Language/emotion remain authored
                // direction; only documented numeric settings are sent to the provider.
                voice_settings: {
                  speed: voice.speech_rate,
                  stability: voice.stability,
                  style: voice.style,
                  similarity_boost: VOICE_GENERATION.similarityBoost,
                  use_speaker_boost: VOICE_GENERATION.speakerBoost,
                },
              }),
            },
          );
          if (!response.ok) {
            await response.body?.cancel();
            throw new VoiceError(
              response.status === 429 ? 'provider_rate_limited' : 'provider_rejected',
              502,
              response.status >= 400 && response.status < 500,
            );
          }
          if (
            response.headers.get('content-type')?.split(';')[0]?.trim() !==
            VOICE_GENERATION.mimeType
          ) {
            await response.body?.cancel();
            throw new VoiceError('invalid_audio', 502);
          }
          const bytes = await readBounded(response.body, VOICE_GENERATION.maxBytes);
          const prefix = new Uint8Array(bytes);
          if (
            bytes.byteLength < 4 ||
            !(
              (prefix[0] === 0x49 && prefix[1] === 0x44 && prefix[2] === 0x33) ||
              (prefix[0] === 0xff && (prefix[1]! & 0xe0) === 0xe0)
            )
          )
            throw new VoiceError('invalid_audio', 502);
          const charge = response.headers.get('character-cost');
          const id = response.headers.get('request-id');
          return {
            bytes,
            requestId: id && /^[a-zA-Z0-9_-]{1,160}$/.test(id) ? id : null,
            billedCharacters: charge && /^\d+$/.test(charge) ? Number(charge) : null,
          };
        })(),
      ]);
    } catch (error) {
      if (error instanceof VoiceError) throw error;
      throw new VoiceError('provider_unavailable', 502);
    } finally {
      clearTimeout(timer!);
    }
  };
}
