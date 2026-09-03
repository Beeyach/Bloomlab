const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** `SHA-256(secret + pepper)` — the only form of the sync key that ever reaches D1 (TA§11, SYNC-003). */
export function hashSyncKey(secret: string, pepper: string): Promise<string> {
  return sha256Hex(`${secret}${pepper}`);
}

/** Session tokens are stored hashed too, so a D1 read never yields a usable token (SYNC-004). */
export function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

/** 256-bit random token in URL-safe base64, handed to a device exactly once. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function randomId(): string {
  return crypto.randomUUID();
}
