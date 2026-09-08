import { z } from 'zod';
import { CALL_LIMITS, type CallMime } from '@bloomlab/shared';
import { boundedBody, CallError } from './errors';

/** Official V2 docs verified 2026-09-08; live project/IAM verification is recorded separately. */
export const GOOGLE_STT = {
  location: 'us',
  model: 'chirp_3',
  language: 'en-US',
  timeoutMs: 45_000,
} as const;
export type SpeechProvider = (audio: ArrayBuffer, mime: CallMime) => Promise<string>;
const credentialSchema = z.object({
  type: z.literal('service_account'),
  project_id: z.string().regex(/^[a-z][a-z0-9-]{4,62}$/),
  client_email: z.string().regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/),
  private_key: z.string().startsWith('-----BEGIN PRIVATE KEY-----'),
});
const encode = (bytes: Uint8Array): string => {
  let text = '';
  for (let start = 0; start < bytes.length; start += 8192)
    text += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(text);
};
const jwtPart = (value: unknown) =>
  encode(new TextEncoder().encode(JSON.stringify(value)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
async function json(response: Response) {
  if (!response.ok)
    throw new CallError(response.status === 429 ? 'speech_rate_limited' : 'speech_unavailable');
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(response.body, 96_000)),
    ) as unknown;
  } catch {
    throw new CallError('speech_invalid_response');
  }
}

/** Injectable direct REST; access tokens exist only in this isolate's memory. */
export function googleSpeech(
  secret: string,
  transport: typeof fetch = fetch,
  now = Date.now,
  timeoutMs: number = GOOGLE_STT.timeoutMs,
): SpeechProvider {
  let cached: { token: string; expires: number } | null = null;
  let pending: Promise<string> | null = null;
  async function token(signal: AbortSignal): Promise<string> {
    if (cached && cached.expires - 60_000 > now()) return cached.token;
    if (pending) return pending;
    pending = (async () => {
      let credential: z.infer<typeof credentialSchema>;
      try {
        credential = credentialSchema.parse(JSON.parse(secret));
      } catch {
        throw new CallError('speech_credential_invalid');
      }
      let signingKey: CryptoKey;
      try {
        const pem = credential.private_key.replace(
          /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
          '',
        );
        signingKey = await crypto.subtle.importKey(
          'pkcs8',
          Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['sign'],
        );
      } catch {
        throw new CallError('speech_credential_invalid');
      }
      const issued = Math.floor(now() / 1000);
      const unsigned = `${jwtPart({ alg: 'RS256', typ: 'JWT' })}.${jwtPart({ iss: credential.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600 })}`;
      const signature = new Uint8Array(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          signingKey,
          new TextEncoder().encode(unsigned),
        ),
      );
      const assertion = `${unsigned}.${encode(signature).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
      const value = await json(
        await transport('https://oauth2.googleapis.com/token', {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
          }).toString(),
        }),
      );
      const parsed = z
        .object({
          access_token: z.string().min(1),
          expires_in: z.number().positive().max(86400),
          token_type: z.string(),
        })
        .safeParse(value);
      if (!parsed.success || parsed.data.token_type.toLowerCase() !== 'bearer')
        throw new CallError('speech_auth_unavailable');
      cached = { token: parsed.data.access_token, expires: now() + parsed.data.expires_in * 1000 };
      return cached.token;
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  }
  return async (audio, _mime) => {
    if (!audio.byteLength || audio.byteLength > CALL_LIMITS.maxBytes)
      throw new CallError('invalid_audio_size', 413);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          let project: string;
          try {
            project = credentialSchema.parse(JSON.parse(secret)).project_id;
          } catch {
            throw new CallError('speech_credential_invalid');
          }
          const access = await token(controller.signal);
          const value = await json(
            await transport(
              `https://${GOOGLE_STT.location}-speech.googleapis.com/v2/projects/${project}/locations/${GOOGLE_STT.location}/recognizers/_:recognize`,
              {
                method: 'POST',
                signal: controller.signal,
                headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
                body: JSON.stringify({
                  config: {
                    autoDecodingConfig: {},
                    languageCodes: [GOOGLE_STT.language],
                    model: GOOGLE_STT.model,
                  },
                  content: encode(new Uint8Array(audio)),
                }),
              },
            ),
          );
          const parsed = z
            .object({
              results: z
                .array(
                  z.object({
                    alternatives: z.array(z.object({ transcript: z.string() })).optional(),
                  }),
                )
                .optional(),
            })
            .safeParse(value);
          if (!parsed.success) throw new CallError('speech_invalid_response');
          const transcript = (parsed.data.results ?? [])
            .map((result) => result.alternatives?.[0]?.transcript ?? '')
            .join(' ')
            .replace(/\p{Cc}/gu, ' ')
            .trim();
          if (!transcript) throw new CallError('speech_empty');
          if (transcript.length > CALL_LIMITS.maxTranscript)
            throw new CallError('speech_transcript_too_long');
          return transcript;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new CallError('speech_timeout'));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (error instanceof CallError) throw error;
      throw new CallError(controller.signal.aborted ? 'speech_timeout' : 'speech_unavailable');
    } finally {
      clearTimeout(timer);
    }
  };
}
let current: { secret: string; provider: SpeechProvider } | null = null;
export function configuredSpeech(secret?: string): SpeechProvider {
  if (!secret) throw new CallError('speech_not_configured');
  if (!current || current.secret !== secret) current = { secret, provider: googleSpeech(secret) };
  return current.provider;
}
