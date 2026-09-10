import type { ContentCoverageRow, FreshnessRow, GhlCoverageRow } from '../bundle.ts';
import { SALES_EXERCISE_TYPES } from '../schemas/index.ts';
import { isSimulatorExercise } from './resolve.ts';
import type { ParsedContent } from './validate.ts';
import { isoDate } from '../schemas/common.ts';

/** Registry records older than this are listed for review (spec §151, GHL-008). */
export const STALE_AFTER_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: Date): number {
  return Math.floor((to.getTime() - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/**
 * Skill × Learn / Guided / Practice / Fix / Independent / Pressure / Fieldwork / Sales Use
 * (spec §137, CUR-033). Derived from content only; never maintained by hand.
 */
export function buildContentCoverage(parsed: ParsedContent): ContentCoverageRow[] {
  return parsed.skills.map((skill) => {
    const units = parsed.learning_units.filter((u) => u.skills.includes(skill.id));
    const exercises = parsed.exercises.filter((e) => e.skills.includes(skill.id));
    const count = (predicate: (e: (typeof exercises)[number]) => boolean) =>
      exercises.filter(predicate).length;
    const row: ContentCoverageRow = {
      skill: skill.id,
      title: skill.title,
      territory: skill.territory,
      tier: skill.tier,
      learn: units.length,
      guided: count((e) => e.mode === 'guided'),
      practice: count((e) => e.mode === 'practice'),
      fix: count((e) => e.type === 'FIX_IT'),
      independent: count((e) => e.mode === 'independent'),
      pressure: count((e) => e.mode === 'pressure'),
      fieldwork: count((e) => e.type === 'FIELDWORK' || e.fieldwork?.required === true),
      sales_use: count((e) => SALES_EXERCISE_TYPES.includes(e.type)),
      gaps: [],
    };
    if (row.learn === 0) row.gaps.push('learn');
    if (row.guided + row.practice === 0) row.gaps.push('practice');
    if (row.independent === 0) row.gaps.push('independent');
    if (skill.mastery_requirements.pressure_test && row.pressure === 0) row.gaps.push('pressure');
    if (skill.mastery_requirements.fieldwork_required && row.fieldwork === 0)
      row.gaps.push('fieldwork');
    if (skill.mastery_requirements.sales_use && row.sales_use === 0) row.gaps.push('sales_use');
    return row;
  });
}

/** GHL Feature × Skill / Simulator / Fidelity / Exercise / Fieldwork / Last Verified (§138, GHL-007). */
export function buildGhlCoverage(parsed: ParsedContent): GhlCoverageRow[] {
  const usesFeature = (feature: string, exercise: ParsedContent['exercises'][number]) =>
    exercise.allowed_features.includes(feature) ||
    exercise.starting_state.workflows.some(
      (w) =>
        w.trigger.ghl_feature_id === feature || w.nodes.some((n) => n.ghl_feature_id === feature),
    );
  const scenarioUses = (feature: string) =>
    parsed.scenarios.some((s) =>
      s.initial_account_state.workflows.some(
        (w) =>
          w.trigger.ghl_feature_id === feature || w.nodes.some((n) => n.ghl_feature_id === feature),
      ),
    );
  return parsed.ghl_features.map((feature) => {
    const skills = new Set(feature.skills);
    for (const skill of parsed.skills)
      if (skill.ghl_features.includes(feature.id)) skills.add(skill.id);
    const exercises = parsed.exercises.filter((e) => usesFeature(feature.id, e));
    return {
      feature: feature.id,
      official_name: feature.official_name,
      status: feature.status,
      fidelity: feature.simulation_fidelity,
      skills: [...skills].sort(),
      simulator:
        feature.simulation_fidelity !== 'REAL_GHL' &&
        (exercises.some((e) => isSimulatorExercise(e.type)) || scenarioUses(feature.id)),
      exercises: exercises.map((e) => e.id),
      fieldwork: exercises
        .filter((e) => e.type === 'FIELDWORK' || e.fieldwork?.required)
        .map((e) => e.id),
      last_verified: feature.last_verified,
    };
  });
}

/** No status is upgraded here. Removed and future-dated records remain explicitly reviewable. */
export function buildFreshness(
  parsed: Pick<ParsedContent, 'ghl_features'>,
  now: Date,
  staleAfterDays = STALE_AFTER_DAYS,
): FreshnessRow[] {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isSafeInteger(staleAfterDays) ||
    staleAfterDays < 1
  )
    throw new Error('Freshness needs a valid reference date and positive whole-day threshold');
  const asOf = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const rows: FreshnessRow[] = [];
  for (const feature of parsed.ghl_features) {
    isoDate.parse(feature.last_verified);
    const days = daysBetween(feature.last_verified, asOf);
    const reason =
      feature.status === 'removed'
        ? 'removed'
        : feature.status === 'needs_review'
          ? 'needs_review'
          : feature.status === 'deprecated'
            ? 'deprecated'
            : days < 0
              ? 'future_verification'
              : days > staleAfterDays
                ? 'stale'
                : null;
    if (!reason) continue;
    rows.push({
      feature: feature.id,
      official_name: feature.official_name,
      status: feature.status,
      last_verified: feature.last_verified,
      days_since_verified: days,
      reason,
    });
  }
  return rows.sort(
    (a, b) =>
      b.days_since_verified - a.days_since_verified ||
      (a.feature < b.feature ? -1 : a.feature > b.feature ? 1 : 0),
  );
}
