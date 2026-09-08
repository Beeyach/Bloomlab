import { describe, expect, it, vi } from 'vitest';
import { googleSpeech, GOOGLE_STT } from './google';

async function credential() {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const bytes = new Uint8Array(
    (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer,
  );
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...bytes))}\n-----END PRIVATE KEY-----`;
  return {
    secret: JSON.stringify({
      type: 'service_account',
      project_id: 'call-test-project',
      client_email: 'call-test@call-test-project.iam.gserviceaccount.com',
      private_key: pem,
    }),
    publicKey: pair.publicKey,
  };
}
const decode = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
describe('VOI-006 Google STT V2 service-account REST boundary', () => {
  it('signs RS256 JWT, auto-decodes inline audio, selects us/chirp_3/en-US and caches tokens only in memory', async () => {
    const key = await credential();
    let time = 1_800_000_000_000;
    const transport = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes('oauth2.googleapis.com')) {
        const form = new URLSearchParams(String(init?.body));
        expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
        const [header, claims, signature] = form.get('assertion')!.split('.');
        expect(JSON.parse(new TextDecoder().decode(decode(header!)))).toEqual({
          alg: 'RS256',
          typ: 'JWT',
        });
        expect(JSON.parse(new TextDecoder().decode(decode(claims!)))).toMatchObject({
          iss: 'call-test@call-test-project.iam.gserviceaccount.com',
          scope: 'https://www.googleapis.com/auth/cloud-platform',
          aud: 'https://oauth2.googleapis.com/token',
        });
        expect(
          await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            key.publicKey,
            decode(signature!),
            new TextEncoder().encode(`${header}.${claims}`),
          ),
        ).toBe(true);
        return Response.json({
          access_token: 'ephemeral-test-token',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }
      expect(String(url)).toBe(
        'https://us-speech.googleapis.com/v2/projects/call-test-project/locations/us/recognizers/_:recognize',
      );
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ephemeral-test-token');
      expect(JSON.parse(String(init?.body))).toEqual({
        config: { autoDecodingConfig: {}, model: 'chirp_3', languageCodes: ['en-US'] },
        content: 'AQIDBA==',
      });
      return Response.json({
        results: [
          { alternatives: [{ transcript: '  A question.\u0000' }] },
          { alternatives: [{ transcript: 'A follow-up.' }] },
        ],
      });
    });
    const provider = googleSpeech(key.secret, transport, () => time);
    const audio = new Uint8Array([1, 2, 3, 4]).buffer;
    expect(await provider(audio, 'audio/webm;codecs=opus')).toBe('A question.  A follow-up.');
    await provider(audio, 'audio/mp4');
    expect(transport.mock.calls.filter(([url]) => String(url).includes('oauth2.'))).toHaveLength(1);
    time += 3_550_000;
    await provider(audio, 'audio/mp4');
    expect(transport.mock.calls.filter(([url]) => String(url).includes('oauth2.'))).toHaveLength(2);
    expect(GOOGLE_STT.timeoutMs).toBeLessThan(60_000);
  });
  it('rejects invalid credentials without networking and never exposes their contents', async () => {
    const transport = vi.fn<typeof fetch>();
    await expect(
      googleSpeech('PRIVATE_INVALID_JSON', transport)(new Uint8Array([1]).buffer, 'audio/mp4'),
    ).rejects.toThrow('speech_credential_invalid');
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['empty', 'malformed', 'rate_limit', 'failure'])(
    'sanitizes %s provider responses',
    async (kind) => {
      const { secret } = await credential();
      const transport = vi.fn<typeof fetch>(async (url) =>
        String(url).includes('oauth2.')
          ? Response.json({ access_token: 'test', expires_in: 3600, token_type: 'Bearer' })
          : kind === 'empty'
            ? Response.json({ results: [] })
            : kind === 'malformed'
              ? new Response('SECRET_ERROR_BODY')
              : new Response('SECRET_ERROR_BODY', { status: kind === 'rate_limit' ? 429 : 500 }),
      );
      await expect(
        googleSpeech(secret, transport)(new Uint8Array([1]).buffer, 'audio/mp4'),
      ).rejects.toThrow(/^speech_(empty|invalid_response|rate_limited|unavailable)$/);
    },
  );
  it('aborts timed-out requests and does not leak authorization data', async () => {
    const { secret } = await credential();
    let signal: AbortSignal | null | undefined;
    const transport = vi.fn<typeof fetch>((_url, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    await expect(
      googleSpeech(secret, transport, Date.now, 30)(new Uint8Array([1]).buffer, 'audio/mp4'),
    ).rejects.toThrow('speech_timeout');
    expect(signal?.aborted).toBe(true);
  });
});
