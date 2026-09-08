import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import content from 'virtual:bloomlab-content';
import { generateSyncKey } from '@bloomlab/shared';
import { link } from '../sync/handlers';
import worker from '../index';
import { generateVoice } from './generate';
import { handleVoice } from './handlers';
import { handleMedia } from './playback';
import { getAsset } from './storage';
import { sha256, voiceIdentity } from './identity';
import { elevenLabs, type VoiceProvider } from './provider';

const voice = content.voice_characters[0]!;
const line = voice.lines[0]!;
const bytes = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3, 4, 5, 6, 7]).buffer;
const provider = () =>
  vi
    .fn<VoiceProvider>()
    .mockResolvedValue({ bytes, requestId: 'test-request', billedCharacters: 12 });
async function learner() {
  return link(
    { secret: generateSyncKey(), device: { device_id: crypto.randomUUID(), label: 'Voice test' } },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
}
const generate = (p?: VoiceProvider) => generateVoice(voice.id, line.id, env, p);
const input = { character_id: voice.id, line_id: line.id };
function request(
  path: string,
  token?: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`https://bloomlab.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeEach(async () => {
  vi.restoreAllMocks();
  await env.DB.exec('DELETE FROM media_assets; DELETE FROM voice_generation_jobs;');
  const objects = await env.MEDIA.list();
  if (objects.objects.length) await env.MEDIA.delete(objects.objects.map((o) => o.key));
});
describe('VOI-002 immutable generation and private playback', () => {
  it('identifies every generation input and rejects paths; repeated identity stays stable', async () => {
    const original = await voiceIdentity(voice, line);
    expect(await voiceIdentity({ ...voice }, { ...line })).toEqual(original);
    expect(original.object_key).toMatch(/^voice\/v1\/VC-[\w-]+\/[\w-]+\/[a-f0-9]{64}\.mp3$/);
    for (const v of [
      { ...voice, voice_id: content.voice_characters[1]!.voice_id },
      { ...voice, speech_rate: 0.9 },
      { ...voice, style: 0.5 },
      { ...voice, stability: 0.8 },
    ])
      expect((await voiceIdentity(v, line)).asset_id).not.toBe(original.asset_id);
    expect((await voiceIdentity(voice, { ...line, text: 'Changed text' })).asset_id).not.toBe(
      original.asset_id,
    );
    await expect(voiceIdentity({ ...voice, id: '../../private' }, line)).rejects.toThrow();
    await expect(voiceIdentity(voice, { ...line, id: '../other' })).rejects.toThrow();
  });
  it('calls the provider once, stores only metadata in D1, and reuses without a key', async () => {
    const p = provider();
    const first = await generate(p);
    expect(first.reused).toBe(false);
    expect(await generate()).toEqual({ ...first, reused: true });
    expect(p).toHaveBeenCalledTimes(1);
    const asset = await getAsset(env.DB, first.asset_id);
    expect(asset).toMatchObject({
      scope: 'authored',
      learner_id: null,
      byte_length: 10,
      mime_type: 'audio/mpeg',
      checksum: await sha256(bytes),
    });
    expect(Object.keys(asset!)).not.toEqual(
      expect.arrayContaining(['audio', 'bytes', 'text', 'base64']),
    );
    const table = await env.DB.prepare('PRAGMA table_info(media_assets)').all<{ type: string }>();
    expect(table.results.some((c) => c.type === 'BLOB')).toBe(false);
  });
  it('arbitrates concurrent callers with one provider purchase across the durable claim', async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const p = vi.fn<VoiceProvider>(async () => {
      entered();
      await wait;
      return { bytes, requestId: null, billedCharacters: null };
    });
    const first = generate(p);
    await started;
    await expect(generate(p)).rejects.toMatchObject({ code: 'generation_needs_reconciliation' });
    release();
    await first;
    expect(p).toHaveBeenCalledTimes(1);
  });
  it('fails cleanly without a secret when the asset is absent', async () => {
    await expect(generate()).rejects.toMatchObject({ code: 'voice_not_configured' });
    expect(
      (await env.DB.prepare('SELECT * FROM voice_generation_jobs').all()).results,
    ).toHaveLength(0);
  });
  it.each(['production', 'unknown'])(
    'does not generate or offer a catalog in %s',
    async (BLOOMLAB_ENV) => {
      const p = provider();
      expect(
        (
          await handleVoice(
            request('/api/voice/generate', undefined, input),
            { ...env, BLOOMLAB_ENV },
            p,
          )
        ).status,
      ).toBe(404);
      await expect(
        generateVoice(voice.id, line.id, { ...env, BLOOMLAB_ENV }, p),
      ).rejects.toMatchObject({ status: 404 });
      expect(p).not.toHaveBeenCalled();
    },
  );
  it('requires a valid session and accepts only known authored IDs with no extra text', async () => {
    const p = provider();
    expect(
      (await handleVoice(request('/api/voice/generate', undefined, input), env, p)).status,
    ).toBe(401);
    const l = await learner();
    for (const invalid of [
      { ...input, text: 'arbitrary text' },
      { ...input, line_id: 'unknown' },
      { ...input, character_id: '../../other' },
      { ...input, line_id: 'a'.repeat(2048) },
    ])
      expect(
        (await handleVoice(request('/api/voice/generate', l.session_token, invalid), env, p))
          .status,
      ).toBe(invalid.line_id === 'unknown' ? 404 : 400);
    expect(p).not.toHaveBeenCalled();
  });
  it('does not create completed metadata after an object write failure, or blindly charge again', async () => {
    const p = provider();
    const fail = vi.spyOn(env.MEDIA, 'put').mockRejectedValue(new Error('private error'));
    await expect(generate(p)).rejects.toThrow();
    expect((await env.DB.prepare('SELECT * FROM media_assets').all()).results).toHaveLength(0);
    expect(
      await env.DB.prepare(
        'SELECT status,provider_request_id,billed_characters FROM voice_generation_jobs',
      ).first(),
    ).toEqual({
      status: 'uncertain',
      provider_request_id: 'test-request',
      billed_characters: 12,
    });
    fail.mockRestore();
    await expect(generate(p)).rejects.toMatchObject({ status: 409 });
    expect(p).toHaveBeenCalledTimes(1);
  });
  it('recovers a D1 metadata failure from existing R2 bytes without another generation', async () => {
    const p = provider();
    const prepare = env.DB.prepare.bind(env.DB);
    const fail = vi.spyOn(env.DB, 'prepare').mockImplementation((sql) => {
      if (sql.startsWith('INSERT OR IGNORE INTO media_assets'))
        throw new Error('metadata write failed');
      return prepare(sql);
    });
    await expect(generate(p)).rejects.toThrow();
    fail.mockRestore();
    expect((await generate()).reused).toBe(true);
    expect(p).toHaveBeenCalledTimes(1);
    expect(await env.MEDIA.head((await voiceIdentity(voice, line)).object_key)).not.toBeNull();
  });
  it('plays authenticated R2 bytes through the actual router without a provider/key, and refuses unauthenticated access', async () => {
    const { asset_id } = await generate(provider());
    const l = await learner();
    const noProvider = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('provider offline'));
    const result = await worker.fetch(
      request(`/api/media/voice/${asset_id}`, l.session_token),
      env,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('audio/mpeg');
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(await result.arrayBuffer()).toEqual(bytes);
    expect((await handleMedia(request(`/api/media/voice/${asset_id}`), env)).status).toBe(401);
    expect(noProvider).not.toHaveBeenCalled();
  });
  it('returns 403 for another learner scope, and 401 after device revocation', async () => {
    const { asset_id } = await generate(provider());
    const owner = await learner();
    const stranger = await learner();
    await env.DB.prepare("UPDATE media_assets SET scope='learner',learner_id=? WHERE asset_id=?")
      .bind(owner.learner_id, asset_id)
      .run();
    expect(
      (await handleMedia(request(`/api/media/voice/${asset_id}`, stranger.session_token), env))
        .status,
    ).toBe(403);
    const own = await handleMedia(
      request(`/api/media/voice/${asset_id}`, owner.session_token),
      env,
    );
    expect(own.status).toBe(200);
    await own.arrayBuffer();
    await env.DB.prepare('UPDATE devices SET revoked_at=? WHERE device_id=?')
      .bind(new Date().toISOString(), owner.device_id)
      .run();
    expect(
      (await handleMedia(request(`/api/media/voice/${asset_id}`, owner.session_token), env)).status,
    ).toBe(401);
  });
  it('returns honest 404 for missing metadata, missing objects and arbitrary keys', async () => {
    const { asset_id } = await generate(provider());
    const l = await learner();
    for (const id of ['VA-' + '0'.repeat(64), 'private.mp3', '%2e%2e%2fother'])
      expect(
        (await handleMedia(request(`/api/media/voice/${id}`, l.session_token), env)).status,
      ).toBe(404);
    await env.MEDIA.delete((await voiceIdentity(voice, line)).object_key);
    expect(
      (await handleMedia(request(`/api/media/voice/${asset_id}`, l.session_token), env)).status,
    ).toBe(404);
  });
  it.each([
    ['bytes=2-5', 206, 4, 'bytes 2-5/10'],
    ['bytes=6-', 206, 4, 'bytes 6-9/10'],
    ['bytes=-3', 206, 3, 'bytes 7-9/10'],
    ['bytes=0-999', 206, 10, 'bytes 0-9/10'],
    ['bytes=20-', 416, 0, 'bytes */10'],
    ['bytes=-0', 416, 0, 'bytes */10'],
    ['bytes=0-1,4-5', 416, 0, 'bytes */10'],
  ] as const)('supports correct browser range %s', async (range, status, size, contentRange) => {
    const { asset_id } = await generate(provider());
    const l = await learner();
    const result = await handleMedia(
      request(`/api/media/voice/${asset_id}`, l.session_token, undefined, { range }),
      env,
    );
    expect(result.status).toBe(status);
    expect(result.headers.get('content-range')).toBe(contentRange);
    expect((await result.arrayBuffer()).byteLength).toBe(size);
  });
  it('lists only safe authored metadata and reports absent assets honestly', async () => {
    const l = await learner();
    const { asset_id } = await generate(provider());
    const result = await handleVoice(
      request(`/api/voice/library?character=${voice.id}`, l.session_token),
      env,
    );
    const data = (await result.json()) as { assets: { asset_id: string; available: boolean }[] };
    expect(data.assets.find((a) => a.asset_id === asset_id)?.available).toBe(true);
    expect(data.assets.filter((a) => a.available)).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/object_key|provider|checksum|secret/i);
  });
});

describe('SEC-001 ElevenLabs boundary', () => {
  it.each([400, 401, 429, 500, 503])('sanitizes provider HTTP %s', async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('sensitive upstream detail', { status }));
    await expect(elevenLabs('test-secret', fetcher)(voice, line)).rejects.toMatchObject({
      code: status === 429 ? 'provider_rate_limited' : 'provider_rejected',
      status: 502,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('sanitizes timeouts without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    await expect(elevenLabs('test-secret', fetcher, 5)(voice, line)).rejects.toMatchObject({
      code: 'provider_timeout',
      status: 504,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['application/json', '{}'],
    ['audio/mpeg', 'not audio'],
    ['audio/mpeg', ''],
  ])('rejects invalid %s response', async (type, body) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(body, { headers: { 'content-type': type } }));
    await expect(elevenLabs('test-secret', fetcher)(voice, line)).rejects.toMatchObject({
      code: 'invalid_audio',
    });
  });
  it('rejects oversized audio while reading and makes one documented request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(new Uint8Array(2097153), { headers: { 'content-type': 'audio/mpeg' } }),
      );
    await expect(elevenLabs('test-secret', fetcher)(voice, line)).rejects.toMatchObject({
      code: 'response_too_large',
    });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toContain(`/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`);
    expect(JSON.parse(String(options?.body))).toMatchObject({
      text: line.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { speed: voice.speech_rate, style: voice.style, stability: voice.stability },
    });
  });
});
