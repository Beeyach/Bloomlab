import { EVIDENCE_LIMITS, inspectEvidenceImage, type EvidenceAsset } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';

export interface LocalEvidenceAsset {
  asset_id: string;
  attempt_id: string;
  exercise_id: string;
  item_key: string;
  blob: Blob | null;
  status: 'local' | 'uploaded' | 'deleting' | 'deleted';
  upload_started: boolean;
}
export class EvidenceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function evidenceFetch(
  id: string,
  init: RequestInit = {},
  image = false,
  database: BloomlabDatabase = db,
  query = '',
) {
  if (
    !/^[a-f0-9-]{36}$/.test(id) ||
    (query &&
      !/^\?attempt_id=[a-f0-9-]{36}&exercise_id=EX-FIELDWORK-[a-z0-9-]+&item_key=[a-z][a-z0-9_]*$/.test(
        query,
      ))
  )
    throw new Error('Invalid evidence address.');
  const device = await database.device.toCollection().first();
  if (!device?.session_token)
    throw new Error(
      'Link this device with your Bloomlab Sync Key in Settings, then retry. Your proof is saved here.',
    );
  const response = await fetch(`/api/evidence/assets/${id}${image ? '/image' : ''}${query}`, {
    ...init,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
    headers: {
      ...Object.fromEntries(new Headers(init.headers)),
      authorization: `Bearer ${device.session_token}`,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new EvidenceRequestError(
      body?.error ?? 'Screenshot request failed. Your local proof is saved; retry.',
      response.status,
    );
  }
  return response;
}
export async function selectEvidence(
  file: Blob,
  identity: Omit<LocalEvidenceAsset, 'blob' | 'status' | 'upload_started'>,
  database: BloomlabDatabase = db,
) {
  if (file.size > EVIDENCE_LIMITS.maxBytes) throw new Error('Choose an image up to 8 MB.');
  inspectEvidenceImage(new Uint8Array(await file.arrayBuffer()), file.type);
  const row: LocalEvidenceAsset = {
    ...identity,
    blob: file,
    status: 'local',
    upload_started: false,
  };
  await database.evidence_assets.add(row);
  return row;
}
export async function uploadEvidence(
  id: string,
  database: BloomlabDatabase = db,
): Promise<EvidenceAsset> {
  const row = await database.evidence_assets.get(id);
  if (!row || !row.blob || row.status === 'deleting' || row.status === 'deleted')
    throw new Error('Select a screenshot to upload.');
  if (row.status === 'uploaded') return readEvidence(id, database);
  // Written before fetch: a lost response must still be deleted remotely if the learner removes it.
  await database.evidence_assets.update(id, { upload_started: true });
  const query = new URLSearchParams({
    attempt_id: row.attempt_id,
    exercise_id: row.exercise_id,
    item_key: row.item_key,
  });
  const response = await evidenceFetch(
    id,
    { method: 'PUT', headers: { 'content-type': row.blob.type }, body: row.blob },
    false,
    database,
    `?${query}`,
  );
  const asset = (await response.json()) as EvidenceAsset;
  if (asset.status !== 'ready' || asset.asset_id !== id)
    throw new Error('Screenshot is not ready. Retry.');
  await database.evidence_assets.update(id, { status: 'uploaded' });
  return asset;
}
export async function readEvidence(
  id: string,
  database: BloomlabDatabase = db,
): Promise<EvidenceAsset> {
  return (await evidenceFetch(id, {}, false, database)).json() as Promise<EvidenceAsset>;
}
export async function deleteEvidence(id: string, database: BloomlabDatabase = db) {
  const row = await database.evidence_assets.get(id);
  await database.evidence_assets.update(id, { status: 'deleting' });
  if (!row || row.upload_started) {
    // DELETE also retries a response lost after R2 succeeded; server tombstones are idempotent.
    try {
      const response = await evidenceFetch(id, { method: 'DELETE' }, false, database);
      const asset = (await response.json()) as EvidenceAsset;
      if (asset.status !== 'deleted') throw new Error('Deletion has not finished. Retry.');
    } catch (error) {
      if (!(error instanceof EvidenceRequestError) || error.status !== 404) throw error;
    }
  }
  await database.evidence_assets.put({
    ...(row ?? {
      asset_id: id,
      attempt_id: '',
      exercise_id: '',
      item_key: '',
      upload_started: true,
    }),
    blob: null,
    status: 'deleted',
  });
}
