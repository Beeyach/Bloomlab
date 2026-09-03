/**
 * The Bloomlab Sync Key (spec §88, TA§10; SYNC-002): 256 bits of cryptographically secure
 * randomness shown in a friendly form, `BLM-XXXX-XXXX-…` (13 groups of 4 Crockford base32
 * characters, so no I / L / O / U to confuse with 1 / 0 / V). The canonical form the server
 * hashes is the bare 52-character string; `normalizeSyncKey` accepts what a human types.
 */

export const SYNC_KEY_BYTES = 32; // 256 bits
export const SYNC_KEY_PREFIX = 'BLM';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KEY_LENGTH = Math.ceil((SYNC_KEY_BYTES * 8) / 5); // 52 characters
const GROUP = 4;

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function decodeBase32(text: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`Invalid sync key character: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes.slice(0, SYNC_KEY_BYTES));
}

/** Generates a new key from the platform CSPRNG; returns the canonical 52-character form. */
export function generateSyncKey(
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = fillRandom,
): string {
  const bytes = random(new Uint8Array(SYNC_KEY_BYTES));
  return encodeBase32(bytes);
}

function fillRandom(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  crypto.getRandomValues(bytes);
  return bytes;
}

/** `BLM-XXXX-XXXX-…` for display, copying and the recovery file. */
export function formatSyncKey(canonical: string): string {
  const groups = canonical.match(new RegExp(`.{1,${GROUP}}`, 'g')) ?? [];
  return [SYNC_KEY_PREFIX, ...groups].join('-');
}

export type SyncKeyCheck = { ok: true; key: string } | { ok: false; reason: string };

/**
 * Turns whatever the learner typed or pasted into the canonical form: case-insensitive,
 * dashes and spaces ignored, the `BLM` prefix optional, common look-alikes corrected.
 */
export function normalizeSyncKey(input: string): SyncKeyCheck {
  let text = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (text.startsWith(SYNC_KEY_PREFIX) && text.length > KEY_LENGTH) {
    text = text.slice(SYNC_KEY_PREFIX.length);
  }
  text = text.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (text.length !== KEY_LENGTH) {
    return { ok: false, reason: `A sync key has ${KEY_LENGTH} characters after BLM` };
  }
  if (/[^0-9A-HJKMNP-TV-Z]/.test(text)) {
    return { ok: false, reason: 'That is not a Bloomlab sync key' };
  }
  return { ok: true, key: text };
}

/** The raw bytes behind a canonical key (tests use it to prove the entropy). */
export function decodeSyncKey(canonical: string): Uint8Array {
  return decodeBase32(canonical);
}
