import { z } from 'zod';
import content from 'virtual:bloomlab-content';
import { EVIDENCE_LIMITS, inspectEvidenceImage, type EvidenceAsset } from '@bloomlab/shared';
import { authenticate, type Session } from '../sync/auth';
import { sha256 } from '../voice/identity';

interface Storage {
  DB: D1Database;
  MEDIA: R2Bucket;
}
interface Row extends EvidenceAsset {
  learner_id: string;
  object_key: string;
  updated_at: string;
}
class AssetError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
const view = ({
  asset_id,
  attempt_id,
  exercise_id,
  item_key,
  mime_type,
  byte_length,
  checksum,
  width,
  height,
  status,
  deleted_at,
}: Row): EvidenceAsset => ({
  asset_id,
  attempt_id,
  exercise_id,
  item_key,
  mime_type,
  byte_length,
  checksum,
  width,
  height,
  status,
  deleted_at,
});
async function owned(env: Storage, session: Session, id: string) {
  const row = await env.DB.prepare(
    'SELECT * FROM evidence_assets WHERE asset_id=? AND learner_id=?',
  )
    .bind(id, session.learnerId)
    .first<Row>();
  if (!row) throw new AssetError(404, 'Screenshot not found.');
  return row;
}
async function boundedBytes(request: Request) {
  if (!request.body) throw new AssetError(400, 'Choose an image.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > EVIDENCE_LIMITS.maxBytes) {
        await reader.cancel();
        throw new AssetError(413, 'Image exceeds 8 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
async function upload(request: Request, env: Storage, session: Session, id: string, url: URL) {
  const input = z
    .strictObject({
      attempt_id: z.string().uuid(),
      exercise_id: z.string().max(120),
      item_key: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!input.success) throw new AssetError(400, 'Invalid screenshot reference.');
  const { attempt_id, exercise_id, item_key } = input.data;
  const exercise = content.exercises.find((e) => e.id === exercise_id && e.type === 'FIELDWORK');
  if (!exercise?.fieldwork?.proof?.screenshots.some((i) => i.key === item_key))
    throw new AssetError(400, 'Unknown screenshot request.');
  const bytes = await boundedBytes(request);
  let shape;
  try {
    shape = inspectEvidenceImage(bytes, request.headers.get('content-type') ?? '');
  } catch {
    throw new AssetError(
      415,
      'Choose a PNG, JPEG or WebP up to 8 MB, 8192 pixels per side and 32 megapixels.',
    );
  }
  const checksum = await sha256(bytes.buffer);
  const now = new Date().toISOString();
  const key = `evidence/${session.learnerId}/${id}`;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO evidence_assets (asset_id,learner_id,attempt_id,exercise_id,item_key,object_key,mime_type,byte_length,checksum,width,height,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?)",
  )
    .bind(
      id,
      session.learnerId,
      attempt_id,
      exercise_id,
      item_key,
      key,
      shape.mime_type,
      bytes.length,
      checksum,
      shape.width,
      shape.height,
      now,
    )
    .run();
  const row = await owned(env, session, id);
  if (row.deleted_at || row.status === 'deleting')
    throw new AssetError(410, 'Screenshot deleted. Choose a new image.');
  if (
    row.attempt_id !== attempt_id ||
    row.exercise_id !== exercise_id ||
    row.item_key !== item_key ||
    row.checksum !== checksum
  )
    throw new AssetError(409, 'This screenshot reference already contains different proof.');
  if (row.status === 'ready') {
    if (!(await env.MEDIA.head(row.object_key)))
      throw new AssetError(409, 'Private screenshot is unavailable. Replace it.');
    return view(row);
  }
  const stale = new Date(Date.now() - 60_000).toISOString();
  const claim = await env.DB.prepare(
    "UPDATE evidence_assets SET status='uploading',updated_at=? WHERE asset_id=? AND (status='pending' OR (status='uploading' AND updated_at<?)) AND deleted_at IS NULL",
  )
    .bind(now, id, stale)
    .run();
  if (!claim.meta.changes) throw new AssetError(409, 'Upload in progress. Retry in a minute.');
  try {
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: shape.mime_type } });
    const saved = await env.DB.prepare(
      "UPDATE evidence_assets SET status='ready' WHERE asset_id=? AND status='uploading' AND updated_at=? AND deleted_at IS NULL",
    )
      .bind(id, now)
      .run();
    if (!saved.meta.changes) {
      const latest = await owned(env, session, id);
      if (latest.deleted_at || latest.status === 'deleting') await env.MEDIA.delete(key);
      throw new AssetError(409, 'Screenshot changed during upload. Retry.');
    }
    return view(await owned(env, session, id));
  } catch (error) {
    await env.DB.prepare(
      "UPDATE evidence_assets SET status='pending' WHERE asset_id=? AND status='uploading' AND updated_at=?",
    )
      .bind(id, now)
      .run();
    throw error;
  }
}
/** Same-origin browser -> authenticated Worker -> private R2/D1. No GHL or provider API. */
export async function handleEvidence(request: Request, env: Storage): Promise<Response> {
  try {
    const session = await authenticate(request, env.DB);
    if (!session)
      throw new AssetError(401, 'Link this device with your Bloomlab Sync Key, then retry.');
    const url = new URL(request.url);
    const match = /^\/api\/evidence\/assets\/([a-f0-9-]{36})(\/image)?$/.exec(url.pathname);
    if (!match || !z.string().uuid().safeParse(match[1]).success)
      throw new AssetError(404, 'Not found.');
    const id = match[1]!;
    if (request.method === 'PUT' && !match[2])
      return json(await upload(request, env, session, id, url));
    if (request.method === 'DELETE' && !match[2]) {
      // A delete may overtake a slow upload before its body has arrived. Reserve the ID as
      // a tombstone so that late upload can never resurrect it. Foreign IDs still return 404.
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO evidence_assets (asset_id,learner_id,attempt_id,exercise_id,item_key,object_key,mime_type,byte_length,checksum,width,height,status,updated_at,deleted_at) VALUES (?,?,'','','',?,'',0,'',0,0,'deleted',?,?)",
      )
        .bind(id, session.learnerId, `evidence/${session.learnerId}/${id}`, now, now)
        .run();
    }
    const row = await owned(env, session, id);
    if (request.method === 'DELETE' && !match[2]) {
      // Tombstone first; failed R2 deletion stays explicit and is retryable.
      await env.DB.prepare(
        "UPDATE evidence_assets SET status='deleting',deleted_at=COALESCE(deleted_at,?),updated_at=? WHERE asset_id=?",
      )
        .bind(new Date().toISOString(), new Date().toISOString(), id)
        .run();
      await env.MEDIA.delete(row.object_key);
      await env.DB.prepare("UPDATE evidence_assets SET status='deleted' WHERE asset_id=?")
        .bind(id)
        .run();
      return json(view(await owned(env, session, id)));
    }
    if (request.method !== 'GET') throw new AssetError(405, 'Method not allowed.');
    if (row.deleted_at || row.status !== 'ready') {
      if (match[2]) throw new AssetError(410, 'Screenshot is not available.');
      return json(view(row));
    }
    if (!match[2]) {
      if (!(await env.MEDIA.head(row.object_key)))
        throw new AssetError(409, 'Private screenshot is unavailable. Replace it.');
      return json(view(row));
    }
    const image = await env.MEDIA.get(row.object_key);
    if (!image) throw new AssetError(404, 'Screenshot not found.');
    return new Response(image.body, {
      headers: {
        'content-type': row.mime_type,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
        'content-disposition': 'inline; filename="evidence"',
      },
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof AssetError
            ? error.message
            : 'Screenshot service unavailable. Your local proof is saved; retry.',
      },
      error instanceof AssetError ? error.status : 503,
    );
  }
}
