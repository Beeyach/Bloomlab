import { currentDevice } from '../data';

export const SCENARIO_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export interface ScenarioAttachment {
  attachment_id: string;
  scenario_id: string;
  name: string;
  mime_type: 'application/pdf' | 'text/plain' | 'text/csv';
  byte_length: number;
  checksum: string;
  status: 'pending' | 'uploading' | 'ready' | 'deleting' | 'deleted';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function auth(): Promise<Record<string, string>> {
  const device = await currentDevice();
  if (!device?.session_token) throw new Error('Link this device before using scenario files.');
  return { authorization: `Bearer ${device.session_token}` };
}

async function checked<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') throw new Error(body.error);
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('Unexpected')) throw error;
  }
  throw new Error(`Scenario file request failed (${response.status}). Retry.`);
}

export async function listScenarioAttachments(scenarioId: string): Promise<ScenarioAttachment[]> {
  return checked(
    await fetch(`/api/attachments?scenario_id=${encodeURIComponent(scenarioId)}`, {
      headers: await auth(),
    }),
  );
}

function supportedType(file: File): ScenarioAttachment['mime_type'] {
  if (file.type === 'application/pdf' || file.type === 'text/plain' || file.type === 'text/csv')
    return file.type;
  if (!file.type && file.name.toLowerCase().endsWith('.csv')) return 'text/csv';
  if (!file.type && file.name.toLowerCase().endsWith('.txt')) return 'text/plain';
  throw new Error('Choose a PDF, plain-text or CSV file.');
}

export async function uploadScenarioAttachment(
  scenarioId: string,
  file: File,
): Promise<ScenarioAttachment> {
  if (!file.size || file.size > SCENARIO_ATTACHMENT_MAX_BYTES)
    throw new Error('Choose a file up to 8 MB.');
  const id = crypto.randomUUID();
  return checked(
    await fetch(
      `/api/attachments/${id}?scenario_id=${encodeURIComponent(scenarioId)}&name=${encodeURIComponent(file.name)}`,
      {
        method: 'PUT',
        headers: { ...(await auth()), 'content-type': supportedType(file) },
        body: file,
      },
    ),
  );
}

export async function downloadScenarioAttachment(attachment: ScenarioAttachment): Promise<void> {
  const response = await fetch(`/api/attachments/${attachment.attachment_id}/file`, {
    headers: await auth(),
  });
  if (!response.ok) await checked(response);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteScenarioAttachment(id: string): Promise<void> {
  await checked(await fetch(`/api/attachments/${id}`, { method: 'DELETE', headers: await auth() }));
}
