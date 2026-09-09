import {
  ClientProgressRecordSchema,
  type ClientProgressRecord,
  type ContentBundle,
} from '@bloomlab/content-schema';
import { content } from '../content/bundle';
import { db, type BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { randomId } from '../data/envelope';
import { createSyncableStore } from '../data/stores';
import { projectProgress } from './progression';

export const clientProgressId = (client: string) => `cp:${client}`;
export async function ensureClients(database = db, bundle = content) {
  return database.transaction(
    'rw',
    [database.device, database.client_progress, database.sync_queue],
    async () => {
      const device =
        (await database.device.toCollection().first()) ?? (await ensureDevice(database));
      const store = createSyncableStore<ClientProgressRecord>('client_progress', database);
      for (const client of bundle.clients) {
        const id = clientProgressId(client.id);
        if (await store.get(id)) continue;
        const row = await store.create(
          {
            schema_version: 1,
            client_id: client.id,
            relationship: client.relationship_state.stage,
            journal: [],
            engagements: {},
          },
          id,
        );
        if (row.learner_id !== device.learner_id)
          throw new Error('Client owner changed during initialization');
        ClientProgressRecordSchema.parse(row);
      }
    },
  );
}
export async function saveClientNote(
  clientId: string,
  text: string,
  relationship: ClientProgressRecord['relationship'],
  database = db,
) {
  return database.transaction(
    'rw',
    [database.device, database.client_progress, database.sync_queue],
    async () => {
      const writer = await ensureDevice(database);
      const store = createSyncableStore<ClientProgressRecord>('client_progress', database);
      const row = await store.get(clientProgressId(clientId));
      if (!row || row.deleted_at || row.learner_id !== writer.learner_id)
        throw new Error('Client is unavailable');
      const updated = ClientProgressRecordSchema.parse({
        ...row,
        relationship,
        journal: [
          ...row.journal,
          { id: randomId(), at: new Date().toISOString(), text: text.trim() },
        ],
      });
      return store.patch(row.id, { relationship: updated.relationship, journal: updated.journal });
    },
  );
}
/** Selecting earlier work clears later selections. The immutable attempt history is retained. */
export async function selectProjectAttempt(
  projectId: string,
  stageId: string,
  exerciseId: string,
  attemptId: string,
  database: BloomlabDatabase = db,
  bundle: ContentBundle = content,
) {
  return database.transaction(
    'rw',
    [
      database.device,
      database.client_progress,
      database.exercise_attempts,
      database.skill_evidence,
      database.sync_queue,
    ],
    async () => {
      const writer = await ensureDevice(database);
      const project = bundle.projects.find((row) => row.id === projectId);
      if (!project) throw new Error('Project is unavailable');
      const store = createSyncableStore<ClientProgressRecord>('client_progress', database);
      const record = await store.get(clientProgressId(project.client));
      if (!record || record.deleted_at || record.learner_id !== writer.learner_id)
        throw new Error('Client is unavailable');
      const attempts = await database.exercise_attempts.toArray();
      const evidence = await database.skill_evidence.toArray();
      const before = projectProgress(
        project,
        record,
        attempts,
        evidence,
        writer.learner_id,
        bundle,
      );
      const index = project.stages.findIndex((stage) => stage.id === stageId);
      const stage = before.stages[index];
      if (!stage?.unlocked || !stage.exercises.includes(exerciseId))
        throw new Error('Complete the earlier project stage first');
      const existing = record.engagements[projectId];
      const selections =
        existing?.content_version === bundle.content_version ? existing.stage_attempts : {};
      const stage_attempts = Object.fromEntries(
        project.stages
          .slice(0, index + 1)
          .map((s) => [
            s.id,
            s.id === stageId
              ? { ...selections[s.id], [exerciseId]: attemptId }
              : (selections[s.id] ?? {}),
          ]),
      );
      const updated = ClientProgressRecordSchema.parse({
        ...record,
        engagements: {
          ...record.engagements,
          [projectId]: { content_version: bundle.content_version, stage_attempts },
        },
      });
      const after = projectProgress(
        project,
        updated,
        attempts,
        evidence,
        writer.learner_id,
        bundle,
      );
      if (after.stages[index]?.missing.includes(exerciseId))
        throw new Error(
          'Use a current, completed result with valid evidence; Boss Client work must begin after the preceding stage',
        );
      return store.patch(record.id, { engagements: updated.engagements });
    },
  );
}
