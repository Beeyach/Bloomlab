/** Phase 20 operations. No provider key here: generation goes through the preview Worker.
 * generate audition|all: disposable session, authored IDs only, duplicate/playback proof.
 * promote: copy only current authored metadata/bytes dev → prod; checksum both reads.
 * index: after the production migration, publish the reviewed manifest's metadata to D1.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContentDir } from '@bloomlab/content-schema/node';
import { generateSyncKey } from '../packages/shared/src/syncKey.ts';
import { voiceIdentity } from '../worker/src/voice/identity.ts';
import { VOICE_GENERATION } from '../worker/src/voice/config.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = join(root, 'docs/operations/voice-assets.json');
const content = await compileContentDir(join(root, 'content'), { enforceLock: true });
const command = process.argv[2];
const columns = [
  'asset_id',
  'scope',
  'kind',
  'learner_id',
  'client_id',
  'voice_character_id',
  'line_id',
  'object_key',
  'mime_type',
  'byte_length',
  'checksum',
  'source_hash',
  'provider',
  'provider_model',
  'provider_voice_id',
  'created_at',
  'content_version',
  'content_hash',
  'generation_version',
];
const expected = [];
for (const voice of content.voice_characters.filter((voice) => voice.asset_delivery !== 'text'))
  for (const line of voice.lines)
    expected.push({ voice, line, ...(await voiceIdentity(voice, line)) });
const sqlValue = (value) =>
  value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = promisify(execFile);
async function wrangler(args) {
  const result = await run(
    process.execPath,
    [join(root, 'node_modules/wrangler/bin/wrangler.js'), ...args],
    {
      cwd: join(root, 'worker'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  return result.stdout;
}
async function query(environment, sql) {
  const results = JSON.parse(
    await wrangler([
      'd1',
      'execute',
      environment === 'preview' ? 'bloomlab-dev' : 'bloomlab-prod',
      '--remote',
      '--env',
      environment,
      '--command',
      sql,
      '--json',
    ]),
  );
  assert(
    results.every((r) => r.success),
    'D1 query failed',
  );
  return results.flatMap((r) => r.results);
}
function validate(row) {
  assert.deepEqual(Object.keys(row).sort(), [...columns].sort(), 'Unexpected manifest fields');
  const authored = expected.find((e) => e.asset_id === row.asset_id);
  assert(authored, 'Asset is outside the current authored manifest');
  assert.equal(row.scope, 'authored');
  assert.equal(row.learner_id, null);
  assert.equal(row.kind, 'voice');
  assert.equal(row.object_key, authored.object_key);
  assert.equal(row.source_hash, authored.source_hash);
  assert.equal(row.client_id, authored.voice.client);
  assert.equal(row.voice_character_id, authored.voice.id);
  assert.equal(row.line_id, authored.line.id);
  assert.equal(row.provider_voice_id, authored.voice.voice_id);
  assert.equal(row.provider, 'elevenlabs');
  assert.equal(row.provider_model, VOICE_GENERATION.model);
  assert.equal(row.generation_version, VOICE_GENERATION.version);
  assert.equal(row.mime_type, VOICE_GENERATION.mimeType);
  assert(
    Number.isInteger(row.byte_length) &&
      row.byte_length > 0 &&
      row.byte_length <= VOICE_GENERATION.maxBytes,
  );
  assert.match(row.checksum, /^[a-f0-9]{64}$/);
  assert.match(row.content_hash, /^[a-f0-9]{64}$/);
  assert.match(row.content_version, /^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/);
  assert(Number.isFinite(Date.parse(row.created_at)));
  return row;
}
const scratch = mkdtempSync(join(tmpdir(), 'bloomlab-voice-'));
try {
  if (command === 'generate') {
    const mode = process.argv[3];
    assert(['audition', 'all'].includes(mode), 'Use generate audition|all');
    const base = process.env.BASE;
    assert(base && new URL(base).protocol === 'https:', 'BASE must be the HTTPS preview Worker');
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.environment, 'preview');
    assert.equal(health.versions.content, content.content_version);
    const linked = await fetch(`${base}/api/sync/link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: generateSyncKey(),
        device: { device_id: crypto.randomUUID(), label: 'Voice asset generation review' },
      }),
    });
    assert(linked.ok, 'Could not create a disposable preview session');
    const session = await linked.json();
    const headers = {
      authorization: `Bearer ${session.session_token}`,
      'content-type': 'application/json',
    };
    const results = [];
    try {
      for (const item of expected.filter((e) => mode === 'all' || e.line.kind === 'greeting')) {
        const body = JSON.stringify({ character_id: item.voice.id, line_id: item.line.id });
        const first = await fetch(`${base}/api/voice/generate`, { method: 'POST', headers, body });
        if (!first.ok) {
          const safe = await first.json();
          throw new Error(
            `Generation ${item.voice.id}/${item.line.id}: HTTP ${first.status} ${safe.error}`,
          );
        }
        const generated = await first.json();
        assert.equal(generated.asset_id, item.asset_id);
        const repeat = await fetch(`${base}/api/voice/generate`, { method: 'POST', headers, body });
        assert(repeat.ok);
        assert.equal((await repeat.json()).reused, true);
        const playback = await fetch(`${base}/api/media/voice/${item.asset_id}`, { headers });
        assert.equal(playback.status, 200);
        assert.equal(playback.headers.get('content-type'), 'audio/mpeg');
        const bytes = Buffer.from(await playback.arrayBuffer());
        const replay = await fetch(`${base}/api/media/voice/${item.asset_id}`, { headers });
        assert.equal(replay.status, 200);
        assert.equal(digest(Buffer.from(await replay.arrayBuffer())), digest(bytes));
        assert.equal((await fetch(`${base}/api/media/voice/${item.asset_id}`)).status, 401);
        const [row] = await query(
          'preview',
          `SELECT * FROM media_assets WHERE asset_id=${sqlValue(item.asset_id)}`,
        );
        validate(row);
        assert.equal(row.checksum, digest(bytes));
        assert.equal(row.byte_length, bytes.length);
        const [job] = await query(
          'preview',
          `SELECT provider_attempts,billed_characters,status FROM voice_generation_jobs WHERE asset_id=${sqlValue(item.asset_id)}`,
        );
        assert.equal(job.status, 'complete');
        assert.equal(job.provider_attempts, 1);
        results.push({
          character: item.voice.id,
          line: item.line.id,
          kind: item.line.kind,
          ...generated,
          checksum: row.checksum,
          byte_length: bytes.length,
          ...job,
          playback: 200,
          unauthorized: 401,
          duplicate_reused: true,
        });
        console.log(
          `${item.voice.id}/${item.line.id}: ${generated.reused ? 'reused' : 'generated'}, duplicate reused, playback 200, anonymous 401`,
        );
      }
      const out = resolve(process.env.REVIEW_OUT ?? join(root, '.review'));
      mkdirSync(out, { recursive: true });
      writeFileSync(
        join(out, `voice-generation-${mode}.json`),
        JSON.stringify(
          { base, at: new Date().toISOString(), content_version: content.content_version, results },
          null,
          2,
        ) + '\n',
      );
    } finally {
      const revoked = await fetch(`${base}/api/sync/devices/revoke`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ device_id: session.device_id }),
      });
      assert(revoked.ok, 'Disposable review device must be revoked');
    }
  } else if (command === 'promote') {
    const rows = await query(
      'preview',
      "SELECT * FROM media_assets WHERE scope='authored' AND kind='voice'",
    );
    const selected = expected.map((e) => {
      const row = rows.find((r) => r.asset_id === e.asset_id);
      assert(row, `Missing ${e.voice.id}/${e.line.id}`);
      return validate(row);
    });
    // Independent immutable objects can transfer concurrently. Finish each batch before cleanup.
    for (let start = 0; start < selected.length; start += 4) {
      const outcomes = await Promise.allSettled(
        selected.slice(start, start + 4).map(async (row, i) => {
          const from = join(scratch, `dev-${i}.mp3`),
            to = join(scratch, `prod-${i}.mp3`);
          await wrangler([
            'r2',
            'object',
            'get',
            `bloomlab-media-dev/${row.object_key}`,
            '--remote',
            '--file',
            from,
          ]);
          const bytes = readFileSync(from);
          assert.equal(bytes.length, row.byte_length);
          assert.equal(digest(bytes), row.checksum);
          let exists = true;
          try {
            await wrangler([
              'r2',
              'object',
              'get',
              `bloomlab-media-prod/${row.object_key}`,
              '--remote',
              '--file',
              to,
            ]);
          } catch (error) {
            if (/404|does not exist|not found|NoSuchKey/i.test(String(error.stderr)))
              exists = false;
            else
              throw new Error('Could not check production object; promotion stopped', {
                cause: error,
              });
          }
          if (exists)
            assert.equal(
              digest(readFileSync(to)),
              row.checksum,
              'Refusing to replace different historical audio',
            );
          else
            await wrangler([
              'r2',
              'object',
              'put',
              `bloomlab-media-prod/${row.object_key}`,
              '--remote',
              '--file',
              from,
              '--content-type',
              'audio/mpeg',
            ]);
          await wrangler([
            'r2',
            'object',
            'get',
            `bloomlab-media-prod/${row.object_key}`,
            '--remote',
            '--file',
            to,
          ]);
          assert.equal(digest(readFileSync(to)), row.checksum);
          assert.equal(readFileSync(to).length, row.byte_length);
          console.log(
            `${row.voice_character_id}/${row.line_id}: production checksum verified${exists ? ' (already present)' : ''}`,
          );
        }),
      );
      for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
    }
    mkdirSync(join(root, 'docs/operations'), { recursive: true });
    writeFileSync(
      manifestPath,
      JSON.stringify({ generation_version: VOICE_GENERATION.version, assets: selected }, null, 2) +
        '\n',
    );
    console.log(
      `Promoted ${selected.length} exact audio files; metadata manifest ready for post-merge production indexing.`,
    );
  } else if (command === 'index' || command === 'check') {
    // Run after migration 0003 in the main deployment job. Never generates or copies learner media.
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.generation_version, VOICE_GENERATION.version);
    assert.equal(manifest.assets.length, expected.length);
    assert.equal(new Set(manifest.assets.map((a) => a.asset_id)).size, expected.length);
    manifest.assets.forEach(validate);
    if (command === 'check') {
      console.log(
        `Verified ${manifest.assets.length} authored manifest entries without network access.`,
      );
      process.exitCode = 0;
    } else {
      for (const value of manifest.assets) {
        const row = validate(value);
        const to = join(scratch, 'prod.mp3');
        await wrangler([
          'r2',
          'object',
          'get',
          `bloomlab-media-prod/${row.object_key}`,
          '--remote',
          '--file',
          to,
        ]);
        assert.equal(digest(readFileSync(to)), row.checksum);
        assert.equal(readFileSync(to).length, row.byte_length);
      }
      const sql = manifest.assets
        .map(
          (row) =>
            `INSERT OR IGNORE INTO media_assets (${columns.join(',')}) VALUES (${columns.map((k) => sqlValue(row[k])).join(',')});`,
        )
        .join('\n');
      const file = join(scratch, 'metadata.sql');
      writeFileSync(file, sql);
      await wrangler([
        'd1',
        'execute',
        'bloomlab-prod',
        '--env',
        'production',
        '--remote',
        '--file',
        file,
        '--yes',
      ]);
      const stored = await query(
        'production',
        "SELECT * FROM media_assets WHERE scope='authored' AND kind='voice'",
      );
      for (const row of manifest.assets)
        assert.deepEqual(
          stored.find((r) => r.asset_id === row.asset_id),
          row,
          'Production metadata conflict',
        );
      console.log(`Verified ${manifest.assets.length} production metadata rows.`);
    }
  } else throw new Error('Use: voice-assets.mjs generate audition|all, promote, check, or index');
} finally {
  // The only audio files this process writes are inside its own fresh temporary directory.
  rmSync(scratch, { recursive: true, force: true });
}
