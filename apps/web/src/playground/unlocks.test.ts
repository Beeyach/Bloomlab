import { describe, expect, it } from 'vitest';

import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { featuresInScenario, unlockedFeatures } from './unlocks';

/**
 * The Playground's unlock rule (SIM-015, D-111): a feature is available once a skill teaching it
 * has evidence, or once the learner has opened a scenario that uses it. Nothing else opens one.
 */

const scenarios = content.scenarios as unknown as SimulatorScenario[];
const noShow = scenarios.find((row) => row.id === 'SC-glowhaus-no-show') as SimulatorScenario;

describe('unlockedFeatures (SIM-015)', () => {
  it('opens nothing for a learner with no evidence and no runs', () => {
    expect(unlockedFeatures(content.ghl_features, content.skills, [], [], scenarios)).toEqual([]);
  });

  it('opens what a skill with evidence teaches, and says which skill', () => {
    const found = unlockedFeatures(
      content.ghl_features,
      content.skills,
      [{ skill_id: 'SK-AUTOMATE-workflow-foundations', state: 'LEARNING', deleted_at: null }],
      [],
      scenarios,
    );
    const ids = found.map((row) => row.feature.id);
    expect(ids).toContain('GHL-WF-WAIT');
    expect(ids).toContain('GHL-WF-IF-ELSE');
    expect(found.find((row) => row.feature.id === 'GHL-WF-WAIT')).toMatchObject({
      via: 'skill',
      by: 'SK-AUTOMATE-workflow-foundations',
    });
    // UNSEEN is not evidence.
    expect(
      unlockedFeatures(
        content.ghl_features,
        content.skills,
        [{ skill_id: 'SK-AUTOMATE-workflow-foundations', state: 'UNSEEN', deleted_at: null }],
        [],
        scenarios,
      ),
    ).toEqual([]);
  });

  it('opens what a scenario the learner has run uses, runnable or not', () => {
    const found = unlockedFeatures(
      content.ghl_features,
      content.skills,
      [],
      [{ scenario_id: 'SC-glowhaus-no-show', deleted_at: null }],
      scenarios,
    );
    const ids = found.map((row) => row.feature.id);
    expect(ids).toEqual(expect.arrayContaining(featuresInScenario(noShow)));
    expect(ids).toContain('GHL-WF-CUSTOMER-BOOKED-APPOINTMENT');
    expect(ids).toContain('GHL-WF-SEND-SMS');
    // A deleted run opens nothing.
    expect(
      unlockedFeatures(
        content.ghl_features,
        content.skills,
        [],
        [{ scenario_id: 'SC-glowhaus-no-show', deleted_at: '2026-09-04T00:00:00Z' }],
        scenarios,
      ),
    ).toEqual([]);
  });

  it('never invents a feature the registry does not hold', () => {
    const found = unlockedFeatures(
      content.ghl_features,
      content.skills,
      content.skills.map((skill) => ({
        skill_id: skill.id,
        state: 'MASTERED' as const,
        deleted_at: null,
      })),
      scenarios.map((scenario) => ({ scenario_id: scenario.id, deleted_at: null })),
      scenarios,
    );
    const registry = new Set(content.ghl_features.map((feature) => feature.id));
    for (const row of found) expect(registry.has(row.feature.id)).toBe(true);
    expect(new Set(found.map((row) => row.feature.id)).size).toBe(found.length);
  });
});
