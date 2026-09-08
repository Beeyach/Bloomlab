import {
  type PORTFOLIO_ARTIFACT_KINDS,
  PortfolioProjectRecordSchema,
  PortfolioAssetRecordSchema,
  PortfolioCaptureSchema,
  type PortfolioProjectRecord,
  type Portfolio,
} from '@bloomlab/content-schema';
import { validateEvidence } from '@bloomlab/mastery-engine';
import { content } from '../content/bundle';
import { db, type BloomlabDatabase } from '../data/db';
import { stripEnvelope } from '../data/learning/shape';
import type { ExerciseAttemptRecord, SkillEvidenceRecord } from '../data/types';
import { belongsTo } from './store';

export type ArtifactKind = (typeof PORTFOLIO_ARTIFACT_KINDS)[number];
export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  brief: 'Brief',
  business_problem: 'Business problem',
  architecture: 'Architecture',
  funnel: 'Funnel',
  workflows: 'Workflows',
  screenshots: 'Screenshots',
  learner_reasoning: 'Learner reasoning',
  skills_demonstrated: 'Skills demonstrated',
  assistance_level: 'Assistance level',
  real_ghl_evidence: 'Real-GHL evidence',
};
export interface PortfolioView {
  record: PortfolioProjectRecord;
  template: Portfolio;
  brief: string;
  problems: string[];
  attempts: ExerciseAttemptRecord[];
  evidence: SkillEvidenceRecord[];
  captures: {
    attempt: ExerciseAttemptRecord;
    capture: NonNullable<ExerciseAttemptRecord['portfolio_capture']>;
  }[];
  reasoning: { title: string; text: string }[];
  screenshots: {
    asset_id: string;
    attempt_id: string;
    exercise_id: string;
    item_key: string;
    deleted: boolean;
  }[];
  realGhl: SkillEvidenceRecord[];
  available: Record<ArtifactKind, boolean>;
}

/** Availability always resolves saved sources, not an optimistic stored "complete" bit. */
export async function readPortfolio(database: BloomlabDatabase = db): Promise<PortfolioView[]> {
  const device = await database.device.toCollection().first();
  if (!device) return [];
  const mine = <T extends { learner_id: string; deleted_at: string | null }>(r: T) =>
    r.learner_id === device.learner_id && r.deleted_at === null;
  const [records, contributions, savedAttempts, savedEvidence, images] = await Promise.all([
    database.portfolio_projects.filter(mine).toArray(),
    database.portfolio_assets.filter(mine).toArray(),
    database.exercise_attempts.filter(mine).toArray(),
    database.skill_evidence.filter(mine).toArray(),
    database.evidence_assets.toArray(),
  ]);
  return records
    .map((raw) => {
      const record = PortfolioProjectRecordSchema.parse(raw);
      const template = content.portfolio.find(
        (t) => t.id === record.template_id && t.project === record.project_id,
      );
      if (!template)
        throw new Error(
          'A saved portfolio template is unavailable in this content version. Your records are preserved.',
        );
      const project = content.projects.find((p) => p.id === record.project_id)!;
      const linked = contributions.filter(
        (c) => PortfolioAssetRecordSchema.safeParse(c).success && c.portfolio_id === record.id,
      );
      const attempts = savedAttempts
        .filter((a) => linked.some((c) => c.attempt_id === a.id) && belongsTo(template, a))
        .sort((a, b) => a.completed_at.localeCompare(b.completed_at) || a.id.localeCompare(b.id));
      const evidence = savedEvidence.filter(
        (e) =>
          attempts.some((a) => a.id === e.attempt_id && a.exercise_id === e.exercise_id) &&
          validateEvidence(stripEnvelope(e)).length === 0,
      );
      const captures = attempts.flatMap((attempt) => {
        const parsed = PortfolioCaptureSchema.safeParse(attempt.portfolio_capture);
        return parsed.success ? [{ attempt, capture: parsed.data }] : [];
      });
      const reasoning = attempts.flatMap((a) => {
        const exercise = content.exercises.find((e) => e.id === a.exercise_id)!;
        const entries = [
          { title: exercise.title, text: a.response?.text ?? '' },
          ...(a.response?.sales?.turns ?? []).map((turn, i) => ({
            title: `${exercise.title} · Your reply ${i + 1}`,
            text: turn.text,
          })),
          ...(a.response?.negotiation?.turns ?? []).map((turn, i) => ({
            title: `${exercise.title} · Your negotiation reply ${i + 1}`,
            text: turn.action.text,
          })),
          ...(a.response?.pricing?.exclusions ?? []).map((text) => ({
            title: 'Your scope exclusion',
            text,
          })),
          ...exercise.written_fields.map((f) => ({
            title: f.label,
            text: a.response?.written?.[f.key] ?? '',
          })),
          ...Object.values(a.response?.fieldwork?.explanations ?? {}).map((text) => ({
            title: 'Fieldwork explanation',
            text,
          })),
          ...Object.values(a.response?.fieldwork?.reasoning ?? {}).map((text) => ({
            title: 'Fieldwork reasoning',
            text,
          })),
        ];
        return entries.filter((e) => e.text.trim());
      });
      const screenshots = attempts.flatMap((a) =>
        Object.entries(a.response?.fieldwork?.screenshots ?? {})
          .filter(([, id]) => /^[a-f0-9-]{36}$/.test(id))
          .map(([key, id]) => ({
            asset_id: id,
            attempt_id: a.id,
            exercise_id: a.exercise_id!,
            item_key: key,
            deleted: images.some(
              (i) => i.asset_id === id && (i.status === 'deleted' || i.status === 'deleting'),
            ),
          })),
      );
      const realGhl = evidence.filter(
        (e) =>
          (e.kind === 'fieldwork' || e.kind === 'real_ghl') &&
          e.source.type === 'fieldwork' &&
          e.result === 'passed' &&
          e.real_ghl?.provided &&
          !e.critical_failures.length,
      );
      const problems = content.clients.find((c) => c.id === project.client)?.problems ?? [];
      const architecture =
        captures.some((c) => c.capture.workflows.length || c.capture.funnels.length) ||
        attempts.some((a) => Boolean(a.response?.choice));
      return {
        record,
        template,
        brief: project.brief,
        problems,
        attempts,
        evidence,
        captures,
        reasoning,
        screenshots,
        realGhl,
        available: {
          brief: Boolean(project.brief),
          business_problem: problems.length > 0,
          architecture,
          funnel: captures.some((c) => c.capture.funnels.length > 0),
          workflows: captures.some((c) => c.capture.workflows.length > 0),
          screenshots: screenshots.some((s) => !s.deleted),
          learner_reasoning: reasoning.length > 0 || Boolean(record.reflection.trim()),
          skills_demonstrated: evidence.some(
            (e) => e.result === 'passed' && !e.critical_failures.length,
          ),
          assistance_level: evidence.length > 0,
          real_ghl_evidence: realGhl.length > 0,
        },
      };
    })
    .sort((a, b) => a.template.progression_number - b.template.progression_number);
}
