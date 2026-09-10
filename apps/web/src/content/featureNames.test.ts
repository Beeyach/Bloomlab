import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { content } from './bundle';
import { NATIVE_LABELS, nativeFeatureName } from './featureNames';
import { PALETTE } from '../workflow/palette';

describe('native terminology and registry limitations (GHL-005/009/010)', () => {
  it('uses exact registered names in native labels and every Workflow palette item', () => {
    for (const label of Object.values(NATIVE_LABELS))
      expect(content.ghl_features.some((f) => f.official_name === label)).toBe(true);
    for (const entry of PALETTE) expect(entry.name).toBe(nativeFeatureName(entry.id));
    expect(NATIVE_LABELS.objects).toBe('Custom Objects');
    expect(NATIVE_LABELS.lists).toBe('Smart Lists');
    expect(NATIVE_LABELS.conversations).toBe('Conversations');
    expect(() => nativeFeatureName('GHL-NOT-A-REAL-FEATURE')).toThrow('Missing HighLevel registry');
  });
  it('keeps every B/C limitation and its original source/verification boundary in the control document', () => {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    expect(() =>
      execFileSync(process.execPath, ['scripts/registry-limitations.mjs', '--check'], {
        cwd: root,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
