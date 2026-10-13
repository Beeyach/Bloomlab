import { env } from 'cloudflare:test';
import { generateSyncKey } from '@bloomlab/shared';
import { describe, expect, it, vi } from 'vitest';
import content from 'virtual:bloomlab-content';
import { link } from '../sync/handlers';
import { sha256 } from '../voice/identity';
import { startCall } from '../call/store';
import { decodeRecoveryArchive, encodeRecoveryArchive, recoveryChecksum } from './format';
import { handleRecovery } from './handlers';

const now = '2026-09-10T12:00:00.000Z';
const pdf = new TextEncoder().encode('%PDF-1.4\nSynthetic Bloomlab case file\n');
const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=',
  ),
  (character) => character.charCodeAt(0),
);
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);
const mp3 = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3, 4, 5]);
const scenario = content.scenarios[0]!.id;

async function setup() {
  const linked = await link(
    {
      secret: generateSyncKey(),
      device: { device_id: crypto.randomUUID(), label: 'Recovery test' },
    },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
  const request = (path: string, method = 'POST', body?: BodyInit, token = linked.session_token) =>
    handleRecovery(
      new Request(`https://bloomlab.test/api/recovery/${path}`, {
        method,
        headers: { authorization: `Bearer ${token}` },
        ...(body ? { body } : {}),
      }),
      env,
    );
  return { linked, request };
}

async function attachmentArchive(learnerId: string, id = crypto.randomUUID()) {
  return {
    id,
    bytes: await encodeRecoveryArchive({
      format: 'bloomlab-private-binary-recovery',
      schema_version: 1,
      backup_id: crypto.randomUUID(),
      learner_id: learnerId,
      created_at: now,
      call_attempts: [],
      assets: [
        {
          kind: 'scenario_attachment',
          id,
          mime_type: 'application/pdf',
          byte_length: pdf.byteLength,
          checksum: await recoveryChecksum(pdf),
          metadata: {
            scenario_id: scenario,
            name: 'case.pdf',
            created_at: now,
            updated_at: now,
          },
          bytes: pdf,
        },
      ],
    }),
  };
}

describe('DATA-006 staged private-media recovery', () => {
  it('returns a sanitized retryable response when export storage rejects asynchronously', async () => {
    const a = await setup();
    const archive = await attachmentArchive(a.linked.learner_id);
    const stage = (await (await a.request('preview', 'POST', archive.bytes)).json()) as {
      stage_id: string;
    };
    expect((await a.request(`stages/${stage.stage_id}/confirm`)).status).toBe(200);
    const failure = vi
      .spyOn(env.MEDIA, 'get')
      .mockRejectedValueOnce(new Error('private storage detail'));
    try {
      const response = await a.request('export');
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('private storage detail');
    } finally {
      failure.mockRestore();
    }
  });

  it('previews without mutation, confirms add, then classifies keep/repair/deleted without overwrite', async () => {
    const a = await setup();
    const archive = await attachmentArchive(a.linked.learner_id);
    const previewResponse = await a.request('preview', 'POST', archive.bytes);
    expect(previewResponse.status).toBe(200);
    const preview = (await previewResponse.json()) as {
      stage_id: string;
      counts: Record<string, number>;
    };
    expect(preview.counts).toEqual({ add: 1, repair: 0, keep: 0, deleted: 0 });
    expect(
      await env.DB.prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
        .bind(archive.id)
        .first(),
    ).toBeNull();
    expect(await (await a.request(`stages/${preview.stage_id}/confirm`)).json()).toMatchObject({
      status: 'restored',
      applied: { add: 1 },
    });
    const row = await env.DB.prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
      .bind(archive.id)
      .first<{ object_key: string; status: string }>();
    expect(row?.status).toBe('ready');
    expect(new Uint8Array(await (await env.MEDIA.get(row!.object_key))!.arrayBuffer())).toEqual(
      pdf,
    );

    const keep = (await (await a.request('preview', 'POST', archive.bytes)).json()) as {
      stage_id: string;
      counts: Record<string, number>;
    };
    expect(keep.counts.keep).toBe(1);
    expect((await a.request(`stages/${keep.stage_id}/cancel`, 'DELETE')).status).toBe(200);

    await env.MEDIA.delete(row!.object_key);
    await env.DB.prepare("UPDATE scenario_attachments SET status='pending' WHERE attachment_id=?")
      .bind(archive.id)
      .run();
    const repair = (await (await a.request('preview', 'POST', archive.bytes)).json()) as {
      stage_id: string;
      counts: Record<string, number>;
    };
    expect(repair.counts.repair).toBe(1);
    expect((await a.request(`stages/${repair.stage_id}/confirm`)).status).toBe(200);

    await env.DB.prepare(
      "UPDATE scenario_attachments SET status='deleted',deleted_at=? WHERE attachment_id=?",
    )
      .bind(now, archive.id)
      .run();
    await env.MEDIA.delete(row!.object_key);
    const deleted = (await (await a.request('preview', 'POST', archive.bytes)).json()) as {
      counts: Record<string, number>;
    };
    expect(deleted.counts.deleted).toBe(1);
  });

  it('marks a partial restore failed and retries without metadata claiming missing bytes', async () => {
    const a = await setup();
    const archive = await attachmentArchive(a.linked.learner_id);
    const preview = (await (await a.request('preview', 'POST', archive.bytes)).json()) as {
      stage_id: string;
    };
    const put = vi.spyOn(env.MEDIA, 'put').mockRejectedValueOnce(new Error('R2 unavailable'));
    expect((await a.request(`stages/${preview.stage_id}/confirm`)).status).toBe(503);
    put.mockRestore();
    expect(
      await env.DB.prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
        .bind(archive.id)
        .first(),
    ).toBeNull();
    expect(
      await env.DB.prepare('SELECT status FROM recovery_stages WHERE stage_id=?')
        .bind(preview.stage_id)
        .first(),
    ).toMatchObject({ status: 'failed' });
    expect((await a.request(`stages/${preview.stage_id}/confirm`)).status).toBe(200);
  });

  it('rejects foreign-owner and checksum-corrupted archives before creating a stage', async () => {
    const a = await setup();
    const b = await setup();
    const archive = await attachmentArchive(a.linked.learner_id);
    const before = await env.DB.prepare('SELECT COUNT(*) AS count FROM recovery_stages').first<{
      count: number;
    }>();
    expect((await b.request('preview', 'POST', archive.bytes)).status).toBe(403);
    const corrupt = archive.bytes.slice();
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
    expect((await a.request('preview', 'POST', corrupt)).status).toBe(400);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM recovery_stages').first()).toEqual(
      before,
    );
  });

  it('exports and repairs every learner-private binary class while excluding reusable authored voice', async () => {
    const a = await setup();
    const learner = a.linked.learner_id;
    const fieldAttempt = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();
    const evidenceChecksum = await recoveryChecksum(png);
    const evidenceKey = `evidence/${learner}/${evidenceId}`;
    await env.MEDIA.put(evidenceKey, png);
    await env.DB.prepare(
      "INSERT INTO evidence_assets VALUES (?,?,?,?,?,?,?,?,?,?,?,'ready',?,NULL)",
    )
      .bind(
        evidenceId,
        learner,
        fieldAttempt,
        'EX-FIELDWORK-snapshot-no-show-system',
        'destination_workflow',
        evidenceKey,
        'image/png',
        png.byteLength,
        evidenceChecksum,
        1,
        1,
        now,
      )
      .run();

    const callExercise = content.exercises.find((exercise) => exercise.call)!.id;
    const callAttempt = crypto.randomUUID();
    await startCall(
      env.DB,
      { learnerId: learner, deviceId: a.linked.device_id },
      callAttempt,
      callExercise,
    );
    const recordingId = crypto.randomUUID();
    const recordingKey = `call/raw/v1/${recordingId}.audio`;
    const recordingChecksum = await recoveryChecksum(webm);
    await env.MEDIA.put(recordingKey, webm);
    await env.DB.prepare(
      "INSERT INTO call_recordings (recording_id,learner_id,attempt_id,exercise_id,turn,object_key,mime_type,byte_length,duration_ms,checksum,created_at,updated_at,status,retain) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'uploaded',1)",
    )
      .bind(
        recordingId,
        learner,
        callAttempt,
        callExercise,
        0,
        recordingKey,
        'audio/webm;codecs=opus',
        webm.byteLength,
        1000,
        recordingChecksum,
        now,
        now,
      )
      .run();
    const hash = 'a'.repeat(64);
    const callVoiceId = `CV-${hash}`;
    const callVoiceKey = `call/voice/v1/${learner}/${callAttempt}/${callVoiceId}.mp3`;
    const callVoiceChecksum = await recoveryChecksum(mp3);
    await env.MEDIA.put(callVoiceKey, mp3);
    await env.DB.prepare("INSERT INTO call_voice_assets VALUES (?,?,?,?, 'ready',?,?,?)")
      .bind(callVoiceId, learner, callAttempt, callVoiceKey, mp3.byteLength, callVoiceChecksum, now)
      .run();

    const attachmentId = crypto.randomUUID();
    const attachmentKey = `attachments/v1/${learner}/${scenario}/${attachmentId}`;
    const attachmentChecksum = await recoveryChecksum(pdf);
    await env.MEDIA.put(attachmentKey, pdf);
    await env.DB.prepare(
      "INSERT INTO scenario_attachments (attachment_id,learner_id,scenario_id,name,object_key,mime_type,byte_length,checksum,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'ready',?,?)",
    )
      .bind(
        attachmentId,
        learner,
        scenario,
        'case.pdf',
        attachmentKey,
        'application/pdf',
        pdf.byteLength,
        attachmentChecksum,
        now,
        now,
      )
      .run();

    const authoredId = `VA-${'b'.repeat(64)}`;
    const authoredKey = `voice/v1/VC-test/line/${'c'.repeat(64)}.mp3`;
    await env.MEDIA.put(authoredKey, mp3);
    await env.DB.prepare(
      "INSERT INTO media_assets VALUES (?,'authored','voice',NULL,'CL-test','VC-test','line',?,'audio/mpeg',?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        authoredId,
        authoredKey,
        mp3.byteLength,
        await sha256(mp3.slice().buffer),
        'd'.repeat(64),
        'synthetic',
        'synthetic',
        'synthetic',
        now,
        'test',
        'e'.repeat(64),
        'v1',
      )
      .run();

    const response = await a.request('export');
    expect(response.status).toBe(200);
    const archive = new Uint8Array(await response.arrayBuffer());
    const decoded = await decodeRecoveryArchive(archive, learner);
    expect(decoded.header.assets.map((asset) => asset.kind).sort()).toEqual([
      'call_recording',
      'call_voice',
      'evidence_image',
      'scenario_attachment',
    ]);
    expect(decoded.header.assets.some((asset) => asset.id === authoredId)).toBe(false);
    const privateFiles: [string, Uint8Array][] = [
      [evidenceKey, png],
      [recordingKey, webm],
      [callVoiceKey, mp3],
      [attachmentKey, pdf],
    ];
    for (const [key] of privateFiles) await env.MEDIA.delete(key);
    const previewResponse = await a.request('preview', 'POST', archive);
    expect(previewResponse.status).toBe(200);
    const repair = (await previewResponse.json()) as {
      stage_id: string;
      counts: Record<string, number>;
    };
    expect(repair.counts).toEqual({ add: 0, repair: 4, keep: 0, deleted: 0 });
    for (const [key] of privateFiles) expect(await env.MEDIA.get(key)).toBeNull();
    expect((await a.request(`stages/${repair.stage_id}/confirm`)).status).toBe(200);
    for (const [key, original] of privateFiles)
      expect(new Uint8Array(await (await env.MEDIA.get(key))!.arrayBuffer())).toEqual(original);
    expect(new Uint8Array(await (await env.MEDIA.get(authoredKey))!.arrayBuffer())).toEqual(mp3);

    expect(await env.MEDIA.list({ prefix: `recovery/backups/v1/${learner}/` })).toMatchObject({
      objects: [],
    });
  });
});
