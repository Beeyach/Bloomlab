import {
  PORTFOLIO_ARTIFACT_KINDS,
  PortfolioProjectRecordSchema,
  PortfolioAssetRecordSchema,
  type ContentBundle,
  type PortfolioProjectRecord,
  type PortfolioAssetRecord,
  type Portfolio,
} from '@bloomlab/content-schema';
import { content } from '../content/bundle';
import { db, type BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { createSyncableStore } from '../data/stores';
import type { ExerciseAttemptRecord } from '../data/types';

export const portfolioId = (template: string) => `pp:${template}`;
/** Explicit portfolio references plus the template project's authored stage membership. */
export function belongsTo(
  template: Portfolio,
  attempt: ExerciseAttemptRecord,
  bundle = content,
): boolean {
  if (
    !attempt.exercise_id ||
    attempt.source.type === 'retrieval' ||
    attempt.deleted_at ||
    !attempt.completed_at ||
    (!attempt.response && !attempt.grade)
  )
    return false;
  const exercise = bundle.exercises.find((e) => e.id === attempt.exercise_id);
  const project = bundle.projects.find((p) => p.id === template.project);
  return Boolean(
    exercise &&
    (exercise.portfolio === template.id ||
      project?.stages.some((s) => s.exercises.includes(exercise.id))),
  );
}

/** Idempotent, atomic local assembly. Separate append contributions cannot overwrite each other. */
export async function collectPortfolio(
  database: BloomlabDatabase = db,
  bundle: ContentBundle = content,
) {
  return database.transaction(
    'rw',
    [
      database.device,
      database.exercise_attempts,
      database.skill_evidence,
      database.portfolio_projects,
      database.portfolio_assets,
      database.sync_queue,
    ],
    async () => {
      const writer =
        (await database.device.toCollection().first()) ?? (await ensureDevice(database));
      const attempts = await database.exercise_attempts
        .filter((a) => a.learner_id === writer.learner_id)
        .toArray();
      const evidence = await database.skill_evidence
        .filter((e) => e.learner_id === writer.learner_id && !e.deleted_at)
        .toArray();
      const projects = createSyncableStore<PortfolioProjectRecord>('portfolio_projects', database);
      const assets = createSyncableStore<PortfolioAssetRecord>('portfolio_assets', database);
      for (const template of bundle.portfolio) {
        const eligible = attempts.filter(
          (a) => belongsTo(template, a, bundle) && evidence.some((e) => e.attempt_id === a.id),
        );
        if (!eligible.length) continue;
        const id = portfolioId(template.id);
        let project = await projects.get(id);
        if (project && project.learner_id !== writer.learner_id) continue;
        if (!project) {
          project = await projects.create(
            {
              schema_version: 1,
              template_id: template.id,
              project_id: template.project,
              reflection: '',
              artifacts: Object.fromEntries(
                PORTFOLIO_ARTIFACT_KINDS.map((kind) => [
                  kind,
                  {
                    source:
                      kind === 'brief' || kind === 'business_problem' ? 'project' : 'contributions',
                    reference_id:
                      kind === 'brief' || kind === 'business_problem' ? template.project : id,
                  },
                ]),
              ) as PortfolioProjectRecord['artifacts'],
            },
            id,
          );
          PortfolioProjectRecordSchema.parse(project);
        }
        // An explicit tombstone remains hidden; collecting work never resurrects it.
        if (project.deleted_at) continue;
        for (const attempt of eligible) {
          const assetId = `pa:${template.id}:${attempt.id}`;
          if (!(await assets.get(assetId))) {
            PortfolioAssetRecordSchema.parse(
              await assets.create(
                { schema_version: 1, portfolio_id: id, attempt_id: attempt.id },
                assetId,
              ),
            );
          }
        }
      }
    },
  );
}
export async function saveReflection(
  id: string,
  reflection: string,
  database: BloomlabDatabase = db,
) {
  return database.transaction(
    'rw',
    [database.portfolio_projects, database.device, database.sync_queue],
    async () => {
      const existing = await database.portfolio_projects.get(id);
      const device = await ensureDevice(database);
      if (!existing || existing.deleted_at || existing.learner_id !== device.learner_id)
        throw new Error('This portfolio item is unavailable.');
      PortfolioProjectRecordSchema.parse({ ...existing, reflection });
      return createSyncableStore<PortfolioProjectRecord>('portfolio_projects', database).patch(id, {
        reflection,
      });
    },
  );
}
