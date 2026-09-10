import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TERRITORIES } from '../src/index.ts';
import {
  checkLock,
  compileContentDir,
  compileSources,
  hashSources,
  readContentDir,
} from '../src/node.ts';

const CONTENT_DIR = fileURLToPath(new URL('../../../content', import.meta.url));
const NOW = new Date('2026-09-02T12:00:00Z');

/**
 * The real `content/` tree compiles and its relationships resolve (CNT-002 … CNT-006, CUR-001,
 * CUR-016, CUR-033, GHL-007). Counts here are the Phase 5 seed; they grow with later phases.
 */
describe('the repository content', () => {
  it('compiles into one bundle with every content type present', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    expect(bundle.content_version).toMatch(/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/);
    expect(bundle.content_hash).toMatch(/^[0-9a-f]{64}$/);
    for (const count of Object.values(bundle.counts)) expect(count).toBeGreaterThan(0);
  });

  it('has a skill in every one of the ten territories (CUR-016)', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    for (const territory of TERRITORIES)
      expect(bundle.graph.territories[territory].length, territory).toBeGreaterThan(0);
  });

  it('orders the prerequisite graph and reports depth', async () => {
    const { graph } = await compileContentDir(CONTENT_DIR, { now: NOW });
    const position = (id: string) => graph.order.indexOf(id);
    expect(position('SK-STRATEGIZE-funnel-math')).toBeLessThan(
      position('SK-STRATEGIZE-bottleneck-diagnosis'),
    );
    expect(position('SK-AUTOMATE-appointment-reminders')).toBeLessThan(
      position('SK-AUTOMATE-no-show-recovery'),
    );
    expect(graph.depth['SK-STRATEGIZE-funnel-math']).toBe(0);
    expect(graph.depth['SK-AUTOMATE-no-show-recovery']).toBe(3);
    expect(graph.dependents['SK-AUTOMATE-workflow-foundations']).toContain(
      'SK-AUTOMATE-appointment-reminders',
    );
  });

  it('resolves each campaign to an ordered skill path with prerequisites satisfied (CUR-001)', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    const fieldReady = bundle.campaign_paths.find((path) => path.campaign === 'CAMP-FIELD_READY');
    expect(fieldReady).toBeDefined();
    const ordered = fieldReady?.ordered_skills ?? [];
    expect(new Set(ordered).size).toBe(ordered.length);
    const skills = new Map(bundle.skills.map((s) => [s.id, s]));
    ordered.forEach((id, index) => {
      for (const prerequisite of skills.get(id)?.prerequisites ?? []) {
        expect(ordered.indexOf(prerequisite), `${prerequisite} before ${id}`).toBeLessThan(index);
      }
    });
    const advanced = bundle.campaign_paths.find(
      (path) => path.campaign === 'CAMP-ADVANCED_AUTOMATION',
    );
    expect(advanced?.inherited_skills).toContain('SK-AUTOMATE-workflow-foundations');
  });

  it('resolves skill → GHL feature both ways', async () => {
    const { indexes } = await compileContentDir(CONTENT_DIR, { now: NOW });
    expect(indexes.features_by_skill['SK-AUTOMATE-workflow-foundations']).toContain('GHL-WF-WAIT');
    expect(indexes.skills_by_feature['GHL-WF-WAIT']).toContain('SK-AUTOMATE-appointment-reminders');
  });

  it('resolves exercise → scenario → client', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    const exercise = bundle.exercises.find((e) => e.id === 'EX-BUILD_IT-no-show-recovery');
    const scenario = bundle.scenarios.find((s) => s.id === exercise?.scenario);
    expect(scenario?.client).toBe('CL-glowhaus-medspa');
    expect(bundle.indexes.exercises_by_client['CL-glowhaus-medspa']).toContain(
      'EX-BUILD_IT-no-show-recovery',
    );
    expect(bundle.indexes.exercises_by_client['CL-northwind-hvac']).toContain(
      'EX-PROSPECT_IT-three-businesses',
    );
  });

  it('derives the content coverage matrix from content (CUR-033) — hand-checked row', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    const row = bundle.coverage.content.find((r) => r.skill === 'SK-AUTOMATE-no-show-recovery');
    expect(row).toMatchObject({
      learn: 2,
      guided: 1,
      practice: 0,
      fix: 0,
      independent: 1,
      pressure: 1,
      fieldwork: 1,
      sales_use: 0,
    });
    expect(row?.gaps).toEqual([]);
  });

  it('derives the GHL coverage matrix (GHL-007) and marks REAL_GHL as never simulated', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    const status = bundle.coverage.ghl.find((r) => r.feature === 'GHL-WF-APPOINTMENT-STATUS');
    expect(status?.simulator).toBe(true);
    expect(status?.exercises).toContain('EX-BUILD_IT-no-show-recovery');
    const snapshots = bundle.coverage.ghl.find((r) => r.feature === 'GHL-SNAP-SNAPSHOTS');
    expect(snapshots?.simulator).toBe(false);
    expect(snapshots?.fieldwork).toEqual(['EX-FIELDWORK-snapshot-no-show-system']);
  });

  it('lists registry records for review once they go stale (GHL-008)', async () => {
    const fresh = await compileContentDir(CONTENT_DIR, { now: NOW });
    expect(fresh.freshness.filter((row) => row.reason === 'stale')).toEqual([]);
    const later = await compileContentDir(CONTENT_DIR, { now: new Date('2027-03-01T00:00:00Z') });
    expect(later.freshness.length).toBe(fresh.ghl_features.length);
  });

  it('verifies every registry record against official documentation (GHL-006)', async () => {
    const bundle = await compileContentDir(CONTENT_DIR, { now: NOW });
    for (const feature of bundle.ghl_features) {
      // API contracts live on the official developer Marketplace, not the help centre.
      expect(['help.gohighlevel.com', 'marketplace.gohighlevel.com']).toContain(
        new URL(feature.source_url).hostname,
      );
      expect(feature.verification_note, feature.id).toBeTruthy();
    }
  });
});

describe('content version propagation (CNT-007, INF-013)', () => {
  it('stamps the manifest version and a hash of every source on the bundle', async () => {
    const sources = await readContentDir(CONTENT_DIR);
    const bundle = await compileSources(sources, { now: NOW });
    expect(bundle.content_hash).toBe(hashSources(sources));
  });

  it('changes the version and the hash when the manifest is bumped, and nothing else', async () => {
    const sources = await readContentDir(CONTENT_DIR);
    const before = await compileSources(sources, { now: NOW });
    const bumped = {
      files: {
        ...sources.files,
        'content.yaml': `content_version: '2099.01.01'\nschema_version: 1\n`,
      },
    };
    const after = await compileSources(bumped, { now: NOW });
    expect(after.content_version).toBe('2099.01.01');
    expect(after.content_hash).not.toBe(before.content_hash);
    expect(after.skills).toEqual(before.skills);
  });

  it('keeps the lock honest: changed content without a bump is refused', async () => {
    const sources = await readContentDir(CONTENT_DIR);
    const lock = { content_version: '2026.09.02', content_hash: hashSources(sources), files: 1 };
    const manifest = { content_version: '2026.09.02', schema_version: 1 };
    expect(checkLock(manifest, lock, hashSources(sources))).toBeNull();
    expect(checkLock(manifest, lock, 'f'.repeat(64))).toMatch(/bump content_version/);
    expect(
      checkLock({ ...manifest, content_version: '2026.09.03' }, lock, lock.content_hash),
    ).toMatch(/content:lock/);
    expect(checkLock(manifest, null, lock.content_hash)).toMatch(/content:lock/);
  });
});
