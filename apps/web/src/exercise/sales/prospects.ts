import type { Exercise, ProspectBrief, QualificationAxis } from '@bloomlab/content-schema';

import type { ProspectDecisionResponse, SalesResponse } from './types';
import { answered } from './words';

/**
 * What PROSPECT IT counted (EXR-012, SAL-002).
 *
 * A decision is *supported* when it is one the brief accepts and every dimension the learner
 * named is backed by evidence they actually cited for that business. That is the whole reason a
 * justified Skip can score as well as a Contact: nothing here rewards contacting, and nothing
 * measures the length of the reason. Prose is the rubric's job (§62 of the phase brief).
 */
export interface ProspectProjection {
  /** Businesses the exercise puts in front of the learner. */
  total: number;
  decided: number;
  with_reasoning: number;
  with_axes: number;
  acceptable: number;
  supported: number;
}

export interface ProspectVerdict {
  client: string;
  decided: boolean;
  reasoned: boolean;
  acceptable: boolean;
  supported: boolean;
  /** Dimensions the learner named with nothing cited behind them. */
  unsupported_axes: QualificationAxis[];
}

const briefFor = (exercise: Exercise, client: string): ProspectBrief | undefined =>
  exercise.sales.prospect_briefs.find((brief) => brief.client === client);

/** Whether one named dimension is backed by evidence the learner cited for this business. */
function axisSupported(
  brief: ProspectBrief | undefined,
  axis: QualificationAxis,
  cited: readonly string[],
): boolean {
  const authored = brief?.axes.find((entry) => entry.axis === axis);
  if (!authored) return false;
  return authored.evidence.some((id) => cited.includes(id));
}

export function prospectVerdict(
  exercise: Exercise,
  client: string,
  answer: ProspectDecisionResponse | undefined,
): ProspectVerdict {
  const brief = briefFor(exercise, client);
  const decision = answer?.decision ?? null;
  const axes = answer?.axes ?? [];
  const cited = answer?.evidence ?? [];
  const decided = decision !== null;
  const reasoned = decided && answered(answer?.reason);
  const acceptable = decided && (brief?.acceptable_decisions ?? []).includes(decision);
  const unsupported = axes.filter((axis) => !axisSupported(brief, axis, cited));
  return {
    client,
    decided,
    reasoned,
    acceptable,
    supported: reasoned && acceptable && axes.length > 0 && unsupported.length === 0,
    unsupported_axes: unsupported,
  };
}

export function prospectVerdicts(exercise: Exercise, sales: SalesResponse): ProspectVerdict[] {
  return exercise.prospects.map((client) =>
    prospectVerdict(exercise, client, sales.prospects[client]),
  );
}

export function projectProspects(exercise: Exercise, sales: SalesResponse): ProspectProjection {
  const verdicts = prospectVerdicts(exercise, sales);
  const count = (predicate: (verdict: ProspectVerdict) => boolean) =>
    verdicts.filter(predicate).length;
  return {
    total: exercise.prospects.length,
    decided: count((verdict) => verdict.decided),
    with_reasoning: count((verdict) => verdict.reasoned),
    with_axes: count(
      (verdict) => (sales.prospects[verdict.client]?.axes.length ?? 0) > 0 && verdict.decided,
    ),
    acceptable: count((verdict) => verdict.acceptable),
    supported: count((verdict) => verdict.supported),
  };
}
