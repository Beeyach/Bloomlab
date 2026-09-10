import { describe, expect, it } from 'vitest';
import { stablePrecacheFiles } from './precachePolicy';
import { visitedAssetUrls } from './visitedAssets';

describe('PERF-001 stable shell/curriculum precache', () => {
  it('first-visit caching includes only requested same-origin hashed code, never API/private media', () => {
    const origin = 'https://bloomlab.example';
    const names = [
      '/assets/AcademyUnit-hash.js',
      '/assets/AcademyUnit-hash.js',
      '/api/evidence/secret/image',
      '/api/call/recordings/secret/audio',
      '/assets/a-hash.js?secret=redacted',
      'https://foreign.example/assets/a-hash.js',
      '/content/private.json',
    ].map((name) => new URL(name, origin).href);
    expect(visitedAssetUrls(names, origin)).toEqual([origin + '/assets/AcademyUnit-hash.js']);
  });
  const manifest = {
    'index.html': {
      file: 'assets/index-hash.js',
      isEntry: true,
      imports: ['shared'],
      dynamicImports: ['src/workflow/WorkflowLab.tsx'],
      css: ['assets/index-hash.css'],
    },
    shared: { file: 'assets/shared-hash.js' },
    'src/screens/CommandCenter.tsx': { file: 'assets/CommandCenter-hash.js', imports: ['shared'] },
    'src/academy/AcademyUnit.tsx': {
      file: 'assets/AcademyUnit-hash.js',
      dynamicImports: ['virtual:bloomlab-unit/LU-one'],
    },
    'virtual:bloomlab-unit/LU-one': { file: 'assets/LU-one-hash.js', imports: ['shared'] },
    'src/workflow/WorkflowLab.tsx': {
      file: 'assets/WorkflowLab-heavy.js',
      imports: ['shared'],
      css: ['assets/WorkflowLab-heavy.css'],
    },
  };
  it('retains stable dependencies and curriculum, without traversing dynamic Labs', () => {
    const files = stablePrecacheFiles(manifest);
    expect([...files]).toEqual(
      expect.arrayContaining([
        'assets/index-hash.js',
        'assets/index-hash.css',
        'assets/shared-hash.js',
        'assets/CommandCenter-hash.js',
        'assets/AcademyUnit-hash.js',
        'assets/LU-one-hash.js',
      ]),
    );
    expect([...files].some((file) => file.includes('WorkflowLab'))).toBe(false);
  });
  it('fails a build if the shell starts importing Workflow eagerly', () => {
    expect(() =>
      stablePrecacheFiles({
        ...manifest,
        shared: { ...manifest.shared, imports: ['src/workflow/WorkflowLab.tsx'] },
      }),
    ).toThrow('Heavy Workflow');
  });
});
