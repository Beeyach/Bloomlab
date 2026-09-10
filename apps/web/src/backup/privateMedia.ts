import { currentDevice } from '../data';

export const PRIVATE_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export interface PrivateMediaPreview {
  stage_id: string;
  backup_id: string;
  expires_at: string;
  counts: { add: number; repair: number; keep: number; deleted: number };
  assets: Array<{
    kind: 'evidence_image' | 'call_recording' | 'call_voice' | 'scenario_attachment';
    id: string;
    action: 'add' | 'repair' | 'keep' | 'deleted';
    reason: string;
  }>;
}

async function authorization(): Promise<string> {
  const device = await currentDevice();
  if (!device?.session_token)
    throw new Error('Link this device before using private-media recovery.');
  return `Bearer ${device.session_token}`;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new Error(body.error);
  } catch {
    // Use the bounded generic message below for non-JSON edge/service responses.
  }
  return new Error(`Private-media recovery failed (${response.status}). Retry.`);
}

export async function exportPrivateMedia(): Promise<void> {
  const response = await fetch('/api/recovery/export', {
    method: 'POST',
    headers: { authorization: await authorization() },
  });
  if (!response.ok) throw await responseError(response);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'bloomlab-private-media.blb';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function previewPrivateMedia(file: File): Promise<PrivateMediaPreview> {
  if (file.size > PRIVATE_MEDIA_MAX_BYTES) throw new Error('Choose an archive up to 25 MB.');
  const response = await fetch('/api/recovery/preview', {
    method: 'POST',
    headers: {
      authorization: await authorization(),
      'content-type': 'application/vnd.bloomlab.recovery-v1',
    },
    body: file,
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as PrivateMediaPreview;
}

export async function confirmPrivateMedia(stageId: string): Promise<void> {
  const response = await fetch(`/api/recovery/stages/${stageId}/confirm`, {
    method: 'POST',
    headers: { authorization: await authorization() },
  });
  if (!response.ok) throw await responseError(response);
}

export async function cancelPrivateMedia(stageId: string): Promise<void> {
  const response = await fetch(`/api/recovery/stages/${stageId}/cancel`, {
    method: 'DELETE',
    headers: { authorization: await authorization() },
  });
  if (!response.ok) throw await responseError(response);
}
