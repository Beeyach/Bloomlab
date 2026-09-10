import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileSources, readContentDir } from '../src/node.ts';

const DEPRECATION_DATE = '2026-09-01';
const HISTORY =
  'Historical context: X-WH-Signature (RSA-SHA256) was deprecated on 1 September 2026; it is not supported for current delivery.';
const CURRENT = 'X-GHL-Signature with Ed25519 only';
let files: Record<string, string>;

// Fail closed on new legacy guidance, allowing only the explicitly reviewed historical sentence.
// A nearby date/disclaimer must not excuse a current fallback elsewhere in the same document.
function hasStaleSignatureGuidance(text: string): boolean {
  const current = text.replace(/\s+/g, ' ').replaceAll(HISTORY, '');
  return /x-wh-signature|\brsa(?:-sha256)?\b|legacy.{0,80}signature|signature.{0,80}(?:transition|fall\s?back)/i.test(
    current,
  );
}

beforeAll(async () => {
  ({ files } = await readContentDir(fileURLToPath(new URL('../../../content', import.meta.url))));
});

describe('CUR-023 post-2026-09-01 HighLevel webhook freshness', () => {
  it('requires current Ed25519-only guidance and preserves the conceptual fixture boundary', async () => {
    const content = await compileSources({ files });
    const feature = content.ghl_features.find((item) => item.id === 'GHL-API-WEBHOOKS')!;
    const unit = files['learning-units/LU-connect-webhooks.mdx']!;
    expect(feature.last_verified >= DEPRECATION_DATE).toBe(true);
    for (const text of [unit, feature.verification_note!]) {
      expect(text).toContain(CURRENT);
      expect(text).toContain(HISTORY);
      expect(text).toMatch(/reject a missing signature or failed verification/i);
    }
    expect(feature.simulation_fidelity).toBe('C');
    expect(unit).toContain('Bloomlab does not perform cryptographic verification here');
    expect(
      content.exercises.find((item) => item.id === 'EX-WHAT_WOULD_YOU_BUILD-connect-webhooks')!
        .fixture_checks,
    ).toHaveLength(2);
  });

  it('rejects legacy current guidance anywhere in the authored curriculum, not just CONNECT', () => {
    const stale = Object.entries(files)
      .filter(([, text]) => hasStaleSignatureGuidance(text))
      .map(([path]) => path);
    expect(stale).toEqual([]);
  });

  it.each([
    'The current HighLevel Marketplace guide prefers X-GHL-Signature with Ed25519 verification, retaining X-WH-Signature as the legacy RSA transition path.',
    'The webhook guide documents Ed25519 plus legacy RSA and retry behaviour.',
    'Verify the legacy signature when the current header is missing.',
    'The signature verification fallback remains available during transition.',
  ])('catches stale copy even alongside the dated correction: %s', (stale) => {
    expect(hasStaleSignatureGuidance(`${CURRENT}. ${HISTORY} ${stale}`)).toBe(true);
  });

  it('allows deprecated history but not a future-tense deprecation or appended fallback', () => {
    expect(hasStaleSignatureGuidance(`${CURRENT}. ${HISTORY}`)).toBe(false);
    expect(hasStaleSignatureGuidance(HISTORY.replace('was deprecated', 'will be deprecated'))).toBe(
      true,
    );
    expect(hasStaleSignatureGuidance(`${HISTORY} Use RSA as a fallback.`)).toBe(true);
  });
});
