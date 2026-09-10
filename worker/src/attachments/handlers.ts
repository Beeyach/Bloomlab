import { z } from 'zod';
import content from 'virtual:bloomlab-content';
import { authenticate, type Session } from '../sync/auth';
import { sha256 } from '../voice/identity';

export const ATTACHMENT_MIME_TYPES = ['application/pdf', 'text/plain', 'text/csv'] as const;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

export interface ScenarioAttachment {
  attachment_id: string;
  scenario_id: string;
  name: string;
  mime_type: (typeof ATTACHMENT_MIME_TYPES)[number];
  byte_length: number;
  checksum: string;
  status: 'pending' | 'uploading' | 'ready' | 'deleting' | 'deleted';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ScenarioAttachmentRow extends ScenarioAttachment {
  learner_id: string;
  object_key: string;
}

type Storage = { DB: D1Database; MEDIA: R2Bucket };

export class AttachmentError extends Error {
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

export function validateAttachmentBytes(bytes: Uint8Array, mime: string): void {
  if (!ATTACHMENT_MIME_TYPES.includes(mime as (typeof ATTACHMENT_MIME_TYPES)[number]))
    throw new AttachmentError(415, 'Choose a PDF, plain-text or CSV file.');
  if (bytes.byteLength < 1 || bytes.byteLength > ATTACHMENT_MAX_BYTES)
    throw new AttachmentError(413, 'Choose a file up to 8 MB.');
  if (mime === 'application/pdf') {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
      throw new AttachmentError(415, 'The file is not a valid PDF.');
    return;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new AttachmentError(415, 'Text attachments must be valid UTF-8.');
  }
  if (text.includes('\0')) throw new AttachmentError(415, 'Text attachments cannot be binary.');
}

async function boundedBody(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > ATTACHMENT_MAX_BYTES)
    throw new AttachmentError(413, 'Choose a file up to 8 MB.');
  if (!request.body) throw new AttachmentError(400, 'Choose a file.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > ATTACHMENT_MAX_BYTES) {
        await reader.cancel();
        throw new AttachmentError(413, 'Choose a file up to 8 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const view = ({ learner_id: _learner, object_key: _key, ...row }: ScenarioAttachmentRow) => row;

async function rowById(db: D1Database, session: Session, id: string) {
  const row = await db
    .prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
    .bind(id)
    .first<ScenarioAttachmentRow>();
  if (!row) throw new AttachmentError(404, 'Attachment not found.');
  if (row.learner_id !== session.learnerId) throw new AttachmentError(403, 'Forbidden.');
  return row;
}

function scenarioId(url: URL): string {
  const parsed = z.string().max(160).safeParse(url.searchParams.get('scenario_id'));
  if (!parsed.success || !content.scenarios.some((scenario) => scenario.id === parsed.data))
    throw new AttachmentError(400, 'Unknown scenario.');
  return parsed.data;
}

async function upload(request: Request, env: Storage, session: Session, id: string, url: URL) {
  if ([...url.searchParams.keys()].some((key) => !['scenario_id', 'name'].includes(key)))
    throw new AttachmentError(400, 'Invalid attachment metadata.');
  const scenario = scenarioId(url);
  const name = (url.searchParams.get('name') ?? '').trim();
  if (
    !name ||
    name.length > 100 ||
    name.includes('/') ||
    name.includes('\\') ||
    [...name].some((character) => character.charCodeAt(0) <= 31)
  )
    throw new AttachmentError(400, 'Use a file name up to 100 characters without path separators.');
  const mime = request.headers.get('content-type')?.toLowerCase() ?? '';
  const bytes = await boundedBody(request);
  validateAttachmentBytes(bytes, mime);
  const checksum = await sha256(bytes.slice().buffer);
  const key = `attachments/v1/${session.learnerId}/${scenario}/${id}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO scenario_attachments (attachment_id,learner_id,scenario_id,name,object_key,mime_type,byte_length,checksum,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'pending',?,?)",
  )
    .bind(id, session.learnerId, scenario, name, key, mime, bytes.byteLength, checksum, now, now)
    .run();
  const row = await rowById(env.DB, session, id);
  if (row.deleted_at || row.status === 'deleting')
    throw new AttachmentError(410, 'Attachment was deleted. Choose it again as a new file.');
  if (
    row.scenario_id !== scenario ||
    row.name !== name ||
    row.mime_type !== mime ||
    row.byte_length !== bytes.byteLength ||
    row.checksum !== checksum ||
    row.object_key !== key
  )
    throw new AttachmentError(409, 'This attachment ID already contains a different file.');
  if (row.status === 'ready') {
    if (!(await env.MEDIA.head(key)))
      throw new AttachmentError(409, 'Attachment bytes are missing.');
    return view(row);
  }
  const claim = await env.DB.prepare(
    "UPDATE scenario_attachments SET status='uploading',updated_at=? WHERE attachment_id=? AND status='pending' AND deleted_at IS NULL",
  )
    .bind(now, id)
    .run();
  if (!claim.meta.changes) throw new AttachmentError(409, 'Upload is already in progress.');
  try {
    await env.MEDIA.put(key, bytes, {
      sha256: checksum,
      httpMetadata: { contentType: mime },
      customMetadata: { learner_id: session.learnerId, checksum, attachment_id: id },
    });
    await env.DB.prepare(
      "UPDATE scenario_attachments SET status='ready',updated_at=? WHERE attachment_id=? AND status='uploading'",
    )
      .bind(now, id)
      .run();
    return view(await rowById(env.DB, session, id));
  } catch (error) {
    await env.DB.prepare(
      "UPDATE scenario_attachments SET status='pending',updated_at=? WHERE attachment_id=? AND status='uploading'",
    )
      .bind(new Date().toISOString(), id)
      .run();
    throw error;
  }
}

export async function handleAttachments(request: Request, env: Storage): Promise<Response> {
  try {
    const session = await authenticate(request, env.DB);
    if (!session) throw new AttachmentError(401, 'Link this device before using scenario files.');
    const url = new URL(request.url);
    if (url.pathname === '/api/attachments') {
      if (request.method !== 'GET') throw new AttachmentError(405, 'Method not allowed.');
      const scenario = scenarioId(url);
      const rows = await env.DB.prepare(
        'SELECT * FROM scenario_attachments WHERE learner_id=? AND scenario_id=? AND deleted_at IS NULL ORDER BY created_at,attachment_id',
      )
        .bind(session.learnerId, scenario)
        .all<ScenarioAttachmentRow>();
      return json(rows.results.map(view));
    }
    const match = /^\/api\/attachments\/([a-f0-9-]{36})(\/file)?$/.exec(url.pathname);
    if (!match || !z.string().uuid().safeParse(match[1]).success)
      throw new AttachmentError(404, 'Not found.');
    const id = match[1]!;
    if (request.method === 'PUT' && !match[2])
      return json(await upload(request, env, session, id, url));
    const row = await rowById(env.DB, session, id);
    if (request.method === 'GET' && match[2]) {
      if (row.status !== 'ready' || row.deleted_at)
        throw new AttachmentError(410, 'Attachment is not available.');
      const object = await env.MEDIA.get(row.object_key);
      if (!object || object.size !== row.byte_length)
        throw new AttachmentError(409, 'Attachment bytes are missing. Restore or upload again.');
      return new Response(object.body, {
        headers: {
          'content-type': row.mime_type,
          'content-length': String(row.byte_length),
          'content-disposition': `attachment; filename="${row.name.replace(/["\\]/g, '_')}"`,
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    if (request.method === 'GET' && !match[2]) return json(view(row));
    if (request.method === 'DELETE' && !match[2]) {
      if (row.status === 'deleted') return json(view(row));
      const now = new Date().toISOString();
      if (!row.deleted_at)
        await env.DB.prepare(
          "UPDATE scenario_attachments SET status='deleting',deleted_at=?,updated_at=? WHERE attachment_id=?",
        )
          .bind(now, now, id)
          .run();
      await env.MEDIA.delete(row.object_key);
      await env.DB.prepare(
        "UPDATE scenario_attachments SET status='deleted',updated_at=? WHERE attachment_id=?",
      )
        .bind(new Date().toISOString(), id)
        .run();
      return json(view(await rowById(env.DB, session, id)));
    }
    throw new AttachmentError(405, 'Method not allowed.');
  } catch (error) {
    if (error instanceof AttachmentError) return json({ error: error.message }, error.status);
    console.error(
      JSON.stringify({ message: 'scenario attachment failed', error: 'storage_unavailable' }),
    );
    return json({ error: 'Scenario file storage is unavailable. Retry.' }, 503);
  }
}
