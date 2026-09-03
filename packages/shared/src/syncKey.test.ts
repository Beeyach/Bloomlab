// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  SYNC_KEY_BYTES,
  decodeSyncKey,
  formatSyncKey,
  generateSyncKey,
  normalizeSyncKey,
} from './syncKey';

describe('Bloomlab Sync Key (SYNC-002)', () => {
  it('carries 256 bits of randomness from the platform CSPRNG', () => {
    const key = generateSyncKey();
    expect(key).toHaveLength(52);
    expect(decodeSyncKey(key)).toHaveLength(SYNC_KEY_BYTES);
    expect(new Set([generateSyncKey(), generateSyncKey(), generateSyncKey()]).size).toBe(3);
  });

  it('round-trips the bytes it was generated from', () => {
    const bytes = Uint8Array.from({ length: SYNC_KEY_BYTES }, (_, i) => (i * 37 + 11) % 256);
    const key = generateSyncKey((target) => {
      target.set(bytes);
      return target;
    });
    expect([...decodeSyncKey(key)]).toEqual([...bytes]);
  });

  it('formats as BLM plus thirteen groups of four, with no confusable letters', () => {
    const shown = formatSyncKey(generateSyncKey());
    expect(shown).toMatch(/^BLM(-[0-9A-HJKMNP-TV-Z]{4}){13}$/);
  });

  it('normalises what a learner types back to the canonical key', () => {
    const key = generateSyncKey();
    const shown = formatSyncKey(key);
    expect(normalizeSyncKey(shown)).toEqual({ ok: true, key });
    expect(normalizeSyncKey(shown.toLowerCase().replaceAll('-', ' '))).toEqual({ ok: true, key });
    expect(normalizeSyncKey(key)).toEqual({ ok: true, key });
    const withLookAlikes = shown.replace(/0/g, 'O').replace(/1/g, 'l');
    expect(normalizeSyncKey(withLookAlikes)).toEqual({ ok: true, key });
  });

  it('rejects keys of the wrong length or alphabet', () => {
    expect(normalizeSyncKey('BLM-ABCD').ok).toBe(false);
    expect(normalizeSyncKey('U'.repeat(52)).ok).toBe(false);
    expect(normalizeSyncKey('')).toMatchObject({ ok: false });
  });
});
