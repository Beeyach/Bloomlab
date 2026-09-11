import content from 'virtual:bloomlab-content';
import { CALL_MIME_TYPES, inspectEvidenceImage, type CallMime } from '@bloomlab/shared';
import { authenticate, type Session } from '../sync/auth';
import { validContainer } from '../call/store';
import {
  ATTACHMENT_MAX_BYTES,
  AttachmentError,
  validateAttachmentBytes,
} from '../attachments/handlers';
import {
  decodeRecoveryArchive,
  encodeRecoveryArchive,
  RECOVERY_MAX_BYTES,
  RECOVERY_MEDIA_TYPE,
  recoveryChecksum,
  RecoveryFormatError,
  type RecoveryAsset,
  type RecoveryAssetInput,
  type RecoveryHeader,
} from './format';

type Storage = { DB: D1Database; MEDIA: R2Bucket };
type Disposition = 'add' | 'repair' | 'keep' | 'deleted';

interface EvidenceRow {
  asset_id: string;
  learner_id: string;
  attempt_id: string;
  exercise_id: string;
  item_key: string;
  object_key: string;
  mime_type: 'image/png' | 'image/jpeg' | 'image/webp';
  byte_length: number;
  checksum: string;
  width: number;
  height: number;
  status: string;
  updated_at: string;
  deleted_at: string | null;
}
interface RecordingRow {
  recording_id: string;
  learner_id: string;
  attempt_id: string;
  exercise_id: string;
  turn: number;
  object_key: string;
  mime_type: CallMime;
  byte_length: number;
  duration_ms: number;
  checksum: string;
  created_at: string;
  updated_at: string;
  status: 'uploaded' | 'stt_failed' | 'review' | 'confirmed';
  original_transcript: string | null;
  confirmed_transcript: string | null;
  retain: number;
  deleted_at: string | null;
}
interface VoiceRow {
  asset_id: string;
  learner_id: string;
  attempt_id: string;
  object_key: string;
  status: string;
  byte_length: number;
  checksum: string;
  created_at: string;
}
interface AttachmentRow {
  attachment_id: string;
  learner_id: string;
  scenario_id: string;
  name: string;
  object_key: string;
  mime_type: 'application/pdf' | 'text/plain' | 'text/csv';
  byte_length: number;
  checksum: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
interface CallAttemptRow {
  attempt_id: string;
  learner_id: string;
  exercise_id: string;
  content_version: string;
  revision: number;
  state_json: string;
  created_at: string;
  updated_at: string;
}
interface StageRow {
  stage_id: string;
  learner_id: string;
  backup_id: string;
  object_key: string;
  byte_length: number;
  checksum: string;
  asset_count: number;
  status: string;
  expires_at: string;
}

class RecoveryError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });

async function boundedArchive(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > RECOVERY_MAX_BYTES)
    throw new RecoveryError(413, 'Recovery archive exceeds 25 MB.');
  if (!request.body) throw new RecoveryError(400, 'Choose a Bloomlab recovery archive.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > RECOVERY_MAX_BYTES) {
        await reader.cancel();
        throw new RecoveryError(413, 'Recovery archive exceeds 25 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const archive = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return archive;
}

function canonicalKey(asset: RecoveryAsset, learnerId: string): string {
  switch (asset.kind) {
    case 'evidence_image':
      return `evidence/${learnerId}/${asset.id}`;
    case 'call_recording':
      return `call/raw/v1/${asset.id}.audio`;
    case 'call_voice':
      return `call/voice/v1/${learnerId}/${asset.metadata.attempt_id}/${asset.id}.mp3`;
    case 'scenario_attachment':
      return `attachments/v1/${learnerId}/${asset.metadata.scenario_id}/${asset.id}`;
  }
}

async function objectBytes(env: Storage, key: string, length: number, checksum: string) {
  const object = await env.MEDIA.get(key);
  if (!object || object.size !== length)
    throw new RecoveryError(409, 'Private asset bytes are missing.');
  const bytes = new Uint8Array(await object.arrayBuffer());
  if ((await recoveryChecksum(bytes)) !== checksum)
    throw new RecoveryError(409, 'Private asset checksum does not match its metadata.');
  return bytes;
}

async function objectMatches(
  env: Storage,
  key: string,
  length: number,
  checksum: string,
): Promise<boolean | null> {
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  if (object.size !== length) return false;
  return (await recoveryChecksum(new Uint8Array(await object.arrayBuffer()))) === checksum;
}

function validateAssetBytes(asset: RecoveryAsset, bytes: Uint8Array): void {
  try {
    switch (asset.kind) {
      case 'evidence_image': {
        const image = inspectEvidenceImage(bytes, asset.mime_type);
        if (image.width !== asset.metadata.width || image.height !== asset.metadata.height)
          throw new Error('dimensions');
        return;
      }
      case 'call_recording':
        if (
          !CALL_MIME_TYPES.includes(asset.mime_type) ||
          !validContainer(bytes.slice().buffer, asset.mime_type)
        )
          throw new Error('audio');
        return;
      case 'call_voice':
        if (bytes.byteLength < 4 || bytes.byteLength > 2 * 1024 * 1024) throw new Error('voice');
        return;
      case 'scenario_attachment':
        if (bytes.byteLength > ATTACHMENT_MAX_BYTES) throw new Error('attachment');
        validateAttachmentBytes(bytes, asset.mime_type);
        return;
    }
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new RecoveryError(415, `Recovery archive contains invalid ${asset.kind} bytes.`);
  }
}

function validateCallAttempt(attempt: RecoveryHeader['call_attempts'][number]): void {
  const exercise = content.exercises.find(
    (candidate) =>
      candidate.id === attempt.exercise_id && candidate.type === 'SAY_IT' && candidate.call,
  );
  if (!exercise)
    throw new RecoveryError(400, 'Recovery archive references an unknown call exercise.');
  try {
    const state = JSON.parse(attempt.state_json) as { snapshot?: Record<string, unknown> };
    if (
      !state.snapshot ||
      state.snapshot.attempt_id !== attempt.attempt_id ||
      state.snapshot.exercise_id !== attempt.exercise_id ||
      state.snapshot.content_version !== attempt.content_version ||
      !Array.isArray(state.snapshot.turns)
    )
      throw new Error('state');
  } catch {
    throw new RecoveryError(400, 'Recovery archive contains invalid call state.');
  }
}

async function collectExport(env: Storage, session: Session, backupId: string) {
  const [evidence, recordings, voices, attachments] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM evidence_assets WHERE learner_id=? AND status='ready' AND deleted_at IS NULL ORDER BY asset_id",
    )
      .bind(session.learnerId)
      .all<EvidenceRow>(),
    env.DB.prepare(
      "SELECT * FROM call_recordings WHERE learner_id=? AND status IN ('uploaded','stt_failed','review','confirmed') AND deleted_at IS NULL ORDER BY recording_id",
    )
      .bind(session.learnerId)
      .all<RecordingRow>(),
    env.DB.prepare(
      "SELECT * FROM call_voice_assets WHERE learner_id=? AND status='ready' ORDER BY asset_id",
    )
      .bind(session.learnerId)
      .all<VoiceRow>(),
    env.DB.prepare(
      "SELECT * FROM scenario_attachments WHERE learner_id=? AND status='ready' AND deleted_at IS NULL ORDER BY attachment_id",
    )
      .bind(session.learnerId)
      .all<AttachmentRow>(),
  ]);
  const count =
    evidence.results.length +
    recordings.results.length +
    voices.results.length +
    attachments.results.length;
  if (count > 64)
    throw new RecoveryError(413, 'This archive would exceed the 64-asset recovery limit.');
  const assets: RecoveryAssetInput[] = [];
  for (const row of evidence.results) {
    const bytes = await objectBytes(env, row.object_key, row.byte_length, row.checksum);
    const asset: RecoveryAssetInput = {
      kind: 'evidence_image',
      id: row.asset_id,
      mime_type: row.mime_type,
      byte_length: row.byte_length,
      checksum: row.checksum,
      metadata: {
        attempt_id: row.attempt_id,
        exercise_id: row.exercise_id,
        item_key: row.item_key,
        width: row.width,
        height: row.height,
        updated_at: row.updated_at,
      },
      bytes,
    };
    validateAssetBytes({ ...asset, offset: 0 }, bytes);
    assets.push(asset);
  }
  for (const row of recordings.results) {
    const bytes = await objectBytes(env, row.object_key, row.byte_length, row.checksum);
    const asset: RecoveryAssetInput = {
      kind: 'call_recording',
      id: row.recording_id,
      mime_type: row.mime_type,
      byte_length: row.byte_length,
      checksum: row.checksum,
      metadata: {
        attempt_id: row.attempt_id,
        exercise_id: row.exercise_id,
        turn: row.turn,
        duration_ms: row.duration_ms,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        original_transcript: row.original_transcript,
        confirmed_transcript: row.confirmed_transcript,
        retain: Boolean(row.retain),
      },
      bytes,
    };
    validateAssetBytes({ ...asset, offset: 0 }, bytes);
    assets.push(asset);
  }
  for (const row of voices.results) {
    const bytes = await objectBytes(env, row.object_key, row.byte_length, row.checksum);
    const asset: RecoveryAssetInput = {
      kind: 'call_voice',
      id: row.asset_id,
      mime_type: 'audio/mpeg',
      byte_length: row.byte_length,
      checksum: row.checksum,
      metadata: { attempt_id: row.attempt_id, created_at: row.created_at },
      bytes,
    };
    validateAssetBytes({ ...asset, offset: 0 }, bytes);
    assets.push(asset);
  }
  for (const row of attachments.results) {
    const bytes = await objectBytes(env, row.object_key, row.byte_length, row.checksum);
    const asset: RecoveryAssetInput = {
      kind: 'scenario_attachment',
      id: row.attachment_id,
      mime_type: row.mime_type,
      byte_length: row.byte_length,
      checksum: row.checksum,
      metadata: {
        scenario_id: row.scenario_id,
        name: row.name,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      bytes,
    };
    validateAssetBytes({ ...asset, offset: 0 }, bytes);
    assets.push(asset);
  }
  const attemptIds = [
    ...new Set(
      assets
        .filter((asset) => asset.kind === 'call_recording' || asset.kind === 'call_voice')
        .map((asset) => asset.metadata.attempt_id),
    ),
  ];
  const callAttempts: RecoveryHeader['call_attempts'] = [];
  for (const attemptId of attemptIds) {
    const row = await env.DB.prepare(
      'SELECT * FROM call_attempts WHERE attempt_id=? AND learner_id=?',
    )
      .bind(attemptId, session.learnerId)
      .first<CallAttemptRow>();
    if (!row) throw new RecoveryError(409, 'Call media is missing its call state.');
    const attempt = {
      attempt_id: row.attempt_id,
      exercise_id: row.exercise_id,
      content_version: row.content_version,
      revision: row.revision,
      state_json: row.state_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    validateCallAttempt(attempt);
    callAttempts.push(attempt);
  }
  return encodeRecoveryArchive({
    format: 'bloomlab-private-binary-recovery',
    schema_version: 1,
    backup_id: backupId,
    learner_id: session.learnerId,
    created_at: new Date().toISOString(),
    call_attempts: callAttempts,
    assets,
  });
}

async function validateArchiveSemantics(
  decoded: Awaited<ReturnType<typeof decodeRecoveryArchive>>,
): Promise<void> {
  const callAttempts = new Map(
    decoded.header.call_attempts.map((attempt) => [attempt.attempt_id, attempt]),
  );
  const identities = new Set<string>();
  for (const attempt of decoded.header.call_attempts) validateCallAttempt(attempt);
  for (const asset of decoded.header.assets) {
    const identity = `${asset.kind}:${asset.id}`;
    if (identities.has(identity))
      throw new RecoveryError(400, 'Recovery archive repeats an asset.');
    identities.add(identity);
    const bytes = decoded.bytes(asset);
    validateAssetBytes(asset, bytes);
    if (asset.kind === 'evidence_image') {
      const exercise = content.exercises.find(
        (candidate) =>
          candidate.id === asset.metadata.exercise_id && candidate.type === 'FIELDWORK',
      );
      if (
        !exercise?.fieldwork?.proof?.screenshots.some(
          (item) => item.key === asset.metadata.item_key,
        )
      )
        throw new RecoveryError(400, 'Recovery archive contains unknown screenshot proof.');
    } else if (asset.kind === 'scenario_attachment') {
      if (!content.scenarios.some((scenario) => scenario.id === asset.metadata.scenario_id))
        throw new RecoveryError(400, 'Recovery archive contains an unknown scenario file.');
    } else {
      const attempt = callAttempts.get(asset.metadata.attempt_id);
      if (
        !attempt ||
        (asset.kind === 'call_recording' && attempt.exercise_id !== asset.metadata.exercise_id)
      )
        throw new RecoveryError(400, 'Recovery archive contains orphaned call media.');
    }
  }
}

type Existing = EvidenceRow | RecordingRow | VoiceRow | AttachmentRow;

async function existingAsset(env: Storage, asset: RecoveryAsset): Promise<Existing | null> {
  switch (asset.kind) {
    case 'evidence_image':
      return env.DB.prepare('SELECT * FROM evidence_assets WHERE asset_id=?')
        .bind(asset.id)
        .first<EvidenceRow>();
    case 'call_recording':
      return env.DB.prepare('SELECT * FROM call_recordings WHERE recording_id=?')
        .bind(asset.id)
        .first<RecordingRow>();
    case 'call_voice':
      return env.DB.prepare('SELECT * FROM call_voice_assets WHERE asset_id=?')
        .bind(asset.id)
        .first<VoiceRow>();
    case 'scenario_attachment':
      return env.DB.prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
        .bind(asset.id)
        .first<AttachmentRow>();
  }
}

function compatible(asset: RecoveryAsset, row: Existing, learnerId: string): boolean {
  if (row.learner_id !== learnerId || row.object_key !== canonicalKey(asset, learnerId))
    return false;
  switch (asset.kind) {
    case 'evidence_image': {
      const value = row as EvidenceRow;
      return (
        value.asset_id === asset.id &&
        value.attempt_id === asset.metadata.attempt_id &&
        value.exercise_id === asset.metadata.exercise_id &&
        value.item_key === asset.metadata.item_key &&
        value.mime_type === asset.mime_type &&
        value.byte_length === asset.byte_length &&
        value.checksum === asset.checksum &&
        value.width === asset.metadata.width &&
        value.height === asset.metadata.height
      );
    }
    case 'call_recording': {
      const value = row as RecordingRow;
      return (
        value.recording_id === asset.id &&
        value.attempt_id === asset.metadata.attempt_id &&
        value.exercise_id === asset.metadata.exercise_id &&
        value.turn === asset.metadata.turn &&
        value.mime_type === asset.mime_type &&
        value.byte_length === asset.byte_length &&
        value.duration_ms === asset.metadata.duration_ms &&
        value.checksum === asset.checksum
      );
    }
    case 'call_voice': {
      const value = row as VoiceRow;
      return (
        value.asset_id === asset.id &&
        value.attempt_id === asset.metadata.attempt_id &&
        value.byte_length === asset.byte_length &&
        value.checksum === asset.checksum
      );
    }
    case 'scenario_attachment': {
      const value = row as AttachmentRow;
      return (
        value.attachment_id === asset.id &&
        value.scenario_id === asset.metadata.scenario_id &&
        value.name === asset.metadata.name &&
        value.mime_type === asset.mime_type &&
        value.byte_length === asset.byte_length &&
        value.checksum === asset.checksum
      );
    }
  }
}

function deleted(row: Existing): boolean {
  return 'deleted_at' in row && Boolean(row.deleted_at);
}

function ready(asset: RecoveryAsset, row: Existing): boolean {
  if (asset.kind === 'call_recording')
    return ['uploaded', 'stt_failed', 'review', 'confirmed'].includes(row.status);
  return row.status === 'ready';
}

async function storedObjectMatches(
  env: Storage,
  asset: RecoveryAsset,
  key: string,
): Promise<boolean | null> {
  return objectMatches(env, key, asset.byte_length, asset.checksum);
}

async function disposition(
  env: Storage,
  session: Session,
  asset: RecoveryAsset,
): Promise<{ action: Disposition; reason: string }> {
  const row = await existingAsset(env, asset);
  if (row && row.learner_id !== session.learnerId)
    throw new RecoveryError(403, 'Recovery archive conflicts with another learner.');
  if (row && deleted(row)) return { action: 'deleted', reason: 'local tombstone wins' };
  if (row && !compatible(asset, row, session.learnerId))
    return { action: 'keep', reason: 'existing metadata differs' };
  const stored = await storedObjectMatches(env, asset, canonicalKey(asset, session.learnerId));
  if (stored === false) return { action: 'keep', reason: 'existing private bytes differ' };
  if (row && ready(asset, row) && stored) return { action: 'keep', reason: 'already complete' };
  return {
    action: row ? 'repair' : 'add',
    reason: stored ? 'index missing or incomplete' : 'private bytes missing',
  };
}

async function plan(env: Storage, session: Session, header: RecoveryHeader) {
  const assets = [];
  const counts: Record<Disposition, number> = { add: 0, repair: 0, keep: 0, deleted: 0 };
  for (const asset of header.assets) {
    const result = await disposition(env, session, asset);
    counts[result.action] += 1;
    assets.push({ kind: asset.kind, id: asset.id, ...result });
  }
  return { counts, assets };
}

async function ensureCallAttempts(env: Storage, session: Session, header: RecoveryHeader) {
  for (const attempt of header.call_attempts) {
    const existing = await env.DB.prepare('SELECT * FROM call_attempts WHERE attempt_id=?')
      .bind(attempt.attempt_id)
      .first<CallAttemptRow>();
    if (existing && existing.learner_id !== session.learnerId)
      throw new RecoveryError(403, 'Recovery archive conflicts with another learner.');
    if (existing) continue;
    await env.DB.prepare(
      'INSERT OR IGNORE INTO call_attempts (attempt_id,learner_id,exercise_id,content_version,revision,state_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    )
      .bind(
        attempt.attempt_id,
        session.learnerId,
        attempt.exercise_id,
        attempt.content_version,
        attempt.revision,
        attempt.state_json,
        attempt.created_at,
        attempt.updated_at,
      )
      .run();
    const inserted = await env.DB.prepare('SELECT * FROM call_attempts WHERE attempt_id=?')
      .bind(attempt.attempt_id)
      .first<CallAttemptRow>();
    if (!inserted || inserted.learner_id !== session.learnerId)
      throw new RecoveryError(409, 'Call state changed during recovery. Retry.');
  }
}

async function writeObject(
  env: Storage,
  session: Session,
  asset: RecoveryAsset,
  bytes: Uint8Array,
) {
  const key = canonicalKey(asset, session.learnerId);
  const before = await storedObjectMatches(env, asset, key);
  if (before === false)
    throw new RecoveryError(409, 'Existing private bytes differ; nothing was overwritten.');
  if (before === true) return;
  await env.MEDIA.put(key, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    sha256: asset.checksum,
    httpMetadata: { contentType: asset.mime_type },
    customMetadata: {
      learner_id: session.learnerId,
      asset_id: asset.id,
      kind: asset.kind,
      checksum: asset.checksum,
    },
  });
  if ((await storedObjectMatches(env, asset, key)) !== true)
    throw new RecoveryError(409, 'Private bytes changed during recovery. Retry.');
}

async function indexAsset(env: Storage, session: Session, asset: RecoveryAsset) {
  const key = canonicalKey(asset, session.learnerId);
  switch (asset.kind) {
    case 'evidence_image':
      await env.DB.prepare(
        "INSERT OR IGNORE INTO evidence_assets (asset_id,learner_id,attempt_id,exercise_id,item_key,object_key,mime_type,byte_length,checksum,width,height,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'ready',?)",
      )
        .bind(
          asset.id,
          session.learnerId,
          asset.metadata.attempt_id,
          asset.metadata.exercise_id,
          asset.metadata.item_key,
          key,
          asset.mime_type,
          asset.byte_length,
          asset.checksum,
          asset.metadata.width,
          asset.metadata.height,
          asset.metadata.updated_at,
        )
        .run();
      await env.DB.prepare(
        "UPDATE evidence_assets SET status='ready',updated_at=? WHERE asset_id=? AND learner_id=? AND checksum=? AND deleted_at IS NULL",
      )
        .bind(new Date().toISOString(), asset.id, session.learnerId, asset.checksum)
        .run();
      break;
    case 'call_recording':
      await env.DB.prepare(
        'INSERT OR IGNORE INTO call_recordings (recording_id,learner_id,attempt_id,exercise_id,turn,object_key,mime_type,byte_length,duration_ms,checksum,created_at,updated_at,status,original_transcript,confirmed_transcript,retain) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
        .bind(
          asset.id,
          session.learnerId,
          asset.metadata.attempt_id,
          asset.metadata.exercise_id,
          asset.metadata.turn,
          key,
          asset.mime_type,
          asset.byte_length,
          asset.metadata.duration_ms,
          asset.checksum,
          asset.metadata.created_at,
          asset.metadata.updated_at,
          asset.metadata.status,
          asset.metadata.original_transcript,
          asset.metadata.confirmed_transcript,
          asset.metadata.retain ? 1 : 0,
        )
        .run();
      break;
    case 'call_voice':
      await env.DB.prepare(
        "INSERT OR IGNORE INTO call_voice_assets (asset_id,learner_id,attempt_id,object_key,status,byte_length,checksum,created_at) VALUES (?,?,?,?,'ready',?,?,?)",
      )
        .bind(
          asset.id,
          session.learnerId,
          asset.metadata.attempt_id,
          key,
          asset.byte_length,
          asset.checksum,
          asset.metadata.created_at,
        )
        .run();
      await env.DB.prepare(
        "UPDATE call_voice_assets SET status='ready',byte_length=?,checksum=? WHERE asset_id=? AND learner_id=? AND checksum=?",
      )
        .bind(asset.byte_length, asset.checksum, asset.id, session.learnerId, asset.checksum)
        .run();
      break;
    case 'scenario_attachment':
      await env.DB.prepare(
        "INSERT OR IGNORE INTO scenario_attachments (attachment_id,learner_id,scenario_id,name,object_key,mime_type,byte_length,checksum,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'ready',?,?)",
      )
        .bind(
          asset.id,
          session.learnerId,
          asset.metadata.scenario_id,
          asset.metadata.name,
          key,
          asset.mime_type,
          asset.byte_length,
          asset.checksum,
          asset.metadata.created_at,
          asset.metadata.updated_at,
        )
        .run();
      await env.DB.prepare(
        "UPDATE scenario_attachments SET status='ready',updated_at=? WHERE attachment_id=? AND learner_id=? AND checksum=? AND deleted_at IS NULL",
      )
        .bind(new Date().toISOString(), asset.id, session.learnerId, asset.checksum)
        .run();
      break;
  }
  const row = await existingAsset(env, asset);
  if (!row || !compatible(asset, row, session.learnerId) || !ready(asset, row))
    throw new RecoveryError(409, 'Asset metadata changed during recovery. Retry.');
}

async function exportArchive(env: Storage, session: Session): Promise<Response> {
  const backupId = crypto.randomUUID();
  const now = new Date().toISOString();
  // Do not retain an unmanaged server-side copy. Canonical bytes stay in private R2; only an
  // archive explicitly uploaded for restore is staged there for confirmation.
  const archive = await collectExport(env, session, backupId);
  return new Response(archive, {
    headers: {
      'content-type': RECOVERY_MEDIA_TYPE,
      'content-length': String(archive.byteLength),
      'content-disposition': `attachment; filename="bloomlab-private-media-${now.slice(0, 10)}.blb"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function previewArchive(request: Request, env: Storage, session: Session) {
  const archive = await boundedArchive(request);
  const decoded = await decodeRecoveryArchive(archive, session.learnerId);
  await validateArchiveSemantics(decoded);
  const preview = await plan(env, session, decoded.header);
  const stageId = crypto.randomUUID();
  const key = `recovery/stages/v1/${session.learnerId}/${stageId}.blb`;
  const checksum = await recoveryChecksum(archive);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO recovery_stages (stage_id,learner_id,backup_id,object_key,byte_length,checksum,asset_count,status,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,'uploading',?,?,?)",
  )
    .bind(
      stageId,
      session.learnerId,
      decoded.header.backup_id,
      key,
      archive.byteLength,
      checksum,
      decoded.header.assets.length,
      now,
      now,
      expires,
    )
    .run();
  try {
    await env.MEDIA.put(key, archive, {
      onlyIf: { etagDoesNotMatch: '*' },
      sha256: checksum,
      httpMetadata: { contentType: RECOVERY_MEDIA_TYPE },
      customMetadata: { learner_id: session.learnerId, stage_id: stageId, checksum },
    });
    const stored = await env.MEDIA.get(key);
    if (
      !stored ||
      stored.size !== archive.byteLength ||
      (await recoveryChecksum(new Uint8Array(await stored.arrayBuffer()))) !== checksum
    )
      throw new RecoveryError(503, 'Staged archive storage could not be verified. Retry.');
    const saved = await env.DB.prepare(
      "UPDATE recovery_stages SET status='staged',updated_at=? WHERE stage_id=? AND status='uploading'",
    )
      .bind(new Date().toISOString(), stageId)
      .run();
    if (!saved.meta.changes) throw new RecoveryError(409, 'Recovery stage changed. Retry.');
    return {
      stage_id: stageId,
      backup_id: decoded.header.backup_id,
      expires_at: expires,
      ...preview,
    };
  } catch (error) {
    await env.DB.prepare(
      "UPDATE recovery_stages SET status='failed',updated_at=? WHERE stage_id=? AND status='uploading'",
    )
      .bind(new Date().toISOString(), stageId)
      .run();
    throw error;
  }
}

async function ownedStage(env: Storage, session: Session, id: string) {
  const row = await env.DB.prepare('SELECT * FROM recovery_stages WHERE stage_id=?')
    .bind(id)
    .first<StageRow>();
  if (!row) throw new RecoveryError(404, 'Recovery stage not found.');
  if (row.learner_id !== session.learnerId) throw new RecoveryError(403, 'Forbidden.');
  return row;
}

async function readStage(env: Storage, session: Session, row: StageRow) {
  if (new Date(row.expires_at).getTime() <= Date.now())
    throw new RecoveryError(410, 'Recovery preview expired. Upload the archive again.');
  const object = await env.MEDIA.get(row.object_key);
  if (!object || object.size !== row.byte_length)
    throw new RecoveryError(409, 'Staged recovery bytes are missing. Upload the archive again.');
  const archive = new Uint8Array(await object.arrayBuffer());
  if ((await recoveryChecksum(archive)) !== row.checksum)
    throw new RecoveryError(409, 'Staged recovery checksum failed. Upload the archive again.');
  const decoded = await decodeRecoveryArchive(archive, session.learnerId);
  if (
    decoded.header.backup_id !== row.backup_id ||
    decoded.header.assets.length !== row.asset_count
  )
    throw new RecoveryError(409, 'Staged recovery metadata does not match.');
  await validateArchiveSemantics(decoded);
  return decoded;
}

async function confirmStage(env: Storage, session: Session, id: string) {
  const stage = await ownedStage(env, session, id);
  if (!['staged', 'failed'].includes(stage.status))
    throw new RecoveryError(409, 'Recovery stage cannot be confirmed in its current state.');
  const decoded = await readStage(env, session, stage);
  const before = await plan(env, session, decoded.header);
  const claimed = await env.DB.prepare(
    "UPDATE recovery_stages SET status='restoring',updated_at=? WHERE stage_id=? AND status IN ('staged','failed')",
  )
    .bind(new Date().toISOString(), id)
    .run();
  if (!claimed.meta.changes) throw new RecoveryError(409, 'Recovery is already in progress.');
  try {
    await ensureCallAttempts(env, session, decoded.header);
    for (const asset of decoded.header.assets) {
      const current = await disposition(env, session, asset);
      if (current.action === 'keep' || current.action === 'deleted') continue;
      await writeObject(env, session, asset, decoded.bytes(asset));
      await indexAsset(env, session, asset);
    }
    await env.MEDIA.delete(stage.object_key);
    await env.DB.prepare(
      "UPDATE recovery_stages SET status='restored',updated_at=? WHERE stage_id=? AND status='restoring'",
    )
      .bind(new Date().toISOString(), id)
      .run();
    return { stage_id: id, status: 'restored', applied: before.counts };
  } catch (error) {
    await env.DB.prepare(
      "UPDATE recovery_stages SET status='failed',updated_at=? WHERE stage_id=? AND status='restoring'",
    )
      .bind(new Date().toISOString(), id)
      .run();
    throw error;
  }
}

async function cancelStage(env: Storage, session: Session, id: string) {
  const stage = await ownedStage(env, session, id);
  if (!['staged', 'failed', 'uploading'].includes(stage.status))
    throw new RecoveryError(409, 'Recovery stage cannot be cancelled in its current state.');
  await env.MEDIA.delete(stage.object_key);
  await env.DB.prepare(
    "UPDATE recovery_stages SET status='cancelled',updated_at=? WHERE stage_id=? AND status IN ('staged','failed','uploading')",
  )
    .bind(new Date().toISOString(), id)
    .run();
  return { stage_id: id, status: 'cancelled' };
}

export async function handleRecovery(request: Request, env: Storage): Promise<Response> {
  let stageId: string | undefined;
  try {
    const session = await authenticate(request, env.DB);
    if (!session)
      throw new RecoveryError(401, 'Link this device before using private-media recovery.');
    const url = new URL(request.url);
    if (url.pathname === '/api/recovery/export' && request.method === 'POST')
      return await exportArchive(env, session);
    if (url.pathname === '/api/recovery/preview' && request.method === 'POST')
      return json(await previewArchive(request, env, session));
    const match = /^\/api\/recovery\/stages\/([a-f0-9-]{36})\/(confirm|cancel)$/.exec(url.pathname);
    if (
      !match ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(match[1]!)
    )
      throw new RecoveryError(404, 'Not found.');
    stageId = match[1]!;
    if (match[2] === 'confirm' && request.method === 'POST')
      return json(await confirmStage(env, session, stageId));
    if (match[2] === 'cancel' && request.method === 'DELETE')
      return json(await cancelStage(env, session, stageId));
    throw new RecoveryError(405, 'Method not allowed.');
  } catch (error) {
    if (error instanceof RecoveryFormatError) {
      const status =
        error.message === 'archive_too_large'
          ? 413
          : error.message === 'foreign_learner'
            ? 403
            : 400;
      return json(
        { error: `Recovery archive rejected: ${error.message.replaceAll('_', ' ')}.` },
        status,
      );
    }
    if (error instanceof AttachmentError || error instanceof RecoveryError)
      return json({ error: error.message }, error.status);
    console.error(
      JSON.stringify({
        message: 'private media recovery failed',
        stage_id: stageId,
        error: 'storage_unavailable',
      }),
    );
    return json(
      { error: 'Private-media recovery is unavailable. Retry; no existing asset was overwritten.' },
      503,
    );
  }
}
