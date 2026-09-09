import { evaluateFieldReady } from '@bloomlab/mastery-engine';
import type { ContentBundle } from '@bloomlab/content-schema';
import type { LearnerSnapshot } from '../data/learning/progress';
export function fieldReadyCompletion(snapshot: LearnerSnapshot, bundle: ContentBundle) {
  const campaign = bundle.campaigns.find((row) => row.id === 'CAMP-FIELD_READY');
  const ids = new Set(campaign?.gates.flatMap((gate) => gate.skills) ?? []);
  const evidence = evaluateFieldReady(
    snapshot.learner_id,
    bundle.skills.filter((skill) => ids.has(skill.id)),
    snapshot.evidence,
  );
  const path = snapshot.campaigns.find((row) => row.campaign_id === campaign?.id);
  return {
    complete: Boolean(evidence.complete && path?.complete),
    evidence,
    path,
    copy: campaign?.completion,
  };
}
