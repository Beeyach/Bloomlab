import type { GhlFeature, Skill } from '@bloomlab/content-schema';
import type { SimulatorScenario } from '@bloomlab/simulator-core';

import type { SimProjectRecord, SkillProgressRecord } from '../data/types';

/**
 * What the Playground offers (SIM-015, D-111).
 *
 * The spec's rule is one line: once a feature is unlocked, keep it available in Playground. This
 * module says what "unlocked" means, in one place, so the Playground, the review and the
 * acceptance test agree:
 *
 * A registry feature is unlocked when either
 *  1. a skill that teaches it (`skill.ghl_features`) has any mastery evidence — its progress state
 *     is anything but UNSEEN — or
 *  2. the learner has opened a simulator run of a scenario whose authored account uses it (a
 *     workflow trigger or step, a form, a calendar), because a feature you have already worked
 *     beside is not a secret.
 *
 * Nothing unlocks by time, by day count or by payment, and nothing is locked that an exercise
 * has already put in front of the learner. A feature that is not simulated (fidelity C or
 * REAL_GHL) can be unlocked and is then listed as practised in GHL — the Playground never dresses
 * it up as runnable.
 */

export interface UnlockedFeature {
  feature: GhlFeature;
  /** Which rule opened it, for the screen to say so. */
  via: 'skill' | 'scenario';
  /** The skill or scenario id that opened it. */
  by: string;
}

/** The registry ids a scenario's authored account exercises. */
export function featuresInScenario(scenario: SimulatorScenario): string[] {
  const found = new Set<string>();
  for (const workflow of scenario.initial_account_state.workflows ?? []) {
    if (workflow.trigger.ghl_feature_id) found.add(workflow.trigger.ghl_feature_id);
    for (const node of workflow.nodes) if (node.ghl_feature_id) found.add(node.ghl_feature_id);
  }
  if ((scenario.initial_account_state.forms ?? []).length > 0) found.add('GHL-FORM-FORMS');
  if ((scenario.initial_account_state.calendars ?? []).length > 0) found.add('GHL-CAL-CALENDARS');
  if ((scenario.initial_account_state.pipelines ?? []).length > 0) found.add('GHL-CRM-PIPELINES');
  return [...found];
}

export function unlockedFeatures(
  features: readonly GhlFeature[],
  skills: readonly Skill[],
  progress: readonly Pick<SkillProgressRecord, 'skill_id' | 'state' | 'deleted_at'>[],
  runs: readonly Pick<SimProjectRecord, 'scenario_id' | 'deleted_at'>[],
  scenarios: readonly SimulatorScenario[],
): UnlockedFeature[] {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const opened = new Map<string, UnlockedFeature>();

  const seenSkills = new Set(
    progress
      .filter((row) => row.deleted_at === null && row.state !== 'UNSEEN')
      .map((row) => row.skill_id),
  );
  for (const skill of skills) {
    if (!seenSkills.has(skill.id)) continue;
    for (const id of skill.ghl_features) {
      const feature = byId.get(id);
      if (feature && !opened.has(id)) opened.set(id, { feature, via: 'skill', by: skill.id });
    }
  }

  const openedScenarios = new Set(
    runs.filter((row) => row.deleted_at === null).map((row) => row.scenario_id),
  );
  for (const scenario of scenarios) {
    if (!openedScenarios.has(scenario.id)) continue;
    for (const id of featuresInScenario(scenario)) {
      const feature = byId.get(id);
      if (feature && !opened.has(id)) opened.set(id, { feature, via: 'scenario', by: scenario.id });
    }
  }

  return [...opened.values()].sort((a, b) =>
    a.feature.official_name.localeCompare(b.feature.official_name),
  );
}
