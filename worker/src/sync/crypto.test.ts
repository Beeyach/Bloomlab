import { describe, expect, it } from 'vitest';

import { hashSyncKey, hashToken, randomToken } from './crypto';

describe('sync key hashing (SYNC-003, SEC-004)', () => {
  it('stores SHA-256(secret + pepper) and nothing that reveals the secret', async () => {
    const hash = await hashSyncKey('SECRET', 'pepper');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Independently computed SHA-256("SECRETpepper").
    expect(hash).toBe(await hashToken('SECRETpepper'));
    expect(hash).not.toContain('SECRET');
    expect(await hashSyncKey('SECRET', 'other-pepper')).not.toBe(hash);
  });

  it('issues distinct 256-bit session tokens', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
