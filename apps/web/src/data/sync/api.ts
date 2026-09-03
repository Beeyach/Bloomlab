import type {
  DevicesResponse,
  LinkRequest,
  LinkResponse,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
} from '@bloomlab/shared';

/** A failed call: `status` 0 means the network was unreachable. */
export class SyncApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
  get offline(): boolean {
    return this.status === 0;
  }
  /** The session is gone (revoked or unknown): the device must be linked again. */
  get unauthorized(): boolean {
    return this.status === 401;
  }
}

export interface SyncApi {
  link(body: LinkRequest): Promise<LinkResponse>;
  push(token: string, body: PushRequest): Promise<PushResponse>;
  pull(token: string, body: PullRequest): Promise<PullResponse>;
  devices(token: string): Promise<DevicesResponse>;
  revoke(token: string, deviceId: string): Promise<DevicesResponse>;
  label(token: string, label: string): Promise<DevicesResponse>;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SyncApiError(0, 'The server could not be reached');
  }
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && payload.error
        ? String(payload.error)
        : `The server responded ${response.status}`;
    throw new SyncApiError(response.status, message);
  }
  return payload as T;
}

/** The Worker's /api/sync endpoints (TECH_ARCHITECTURE §7). */
export const syncApi: SyncApi = {
  link: (body) => request('POST', '/api/sync/link', body),
  push: (token, body) => request('POST', '/api/sync/push', body, token),
  pull: (token, body) => request('POST', '/api/sync/pull', body, token),
  devices: (token) => request('GET', '/api/sync/devices', undefined, token),
  revoke: (token, deviceId) =>
    request('POST', '/api/sync/devices/revoke', { device_id: deviceId }, token),
  label: (token, label) => request('POST', '/api/sync/devices/label', { label }, token),
};
