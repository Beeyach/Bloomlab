import { describe, expect, it } from 'vitest';

import { freshDatabase } from './testing';
import { ensureDevice } from './device';
import { clearWorkspace, loadWorkspace, saveWorkspace } from './workspace';

describe('workspace checkpoints', () => {
  it('round-trips structured state per key and clears it', async () => {
    const database = freshDatabase();
    const positions = { nodes: { trigger: { x: 10, y: 20 } }, zoom: 1.25 };

    await saveWorkspace('workflow-lab:positions', positions, database);
    expect(await loadWorkspace('workflow-lab:positions', database)).toEqual(positions);
    expect(await loadWorkspace('missing', database)).toBeUndefined();

    await saveWorkspace('workflow-lab:positions', { ...positions, zoom: 1 }, database);
    expect(await database.workspace.count()).toBe(1);

    await clearWorkspace('workflow-lab:positions', database);
    expect(await loadWorkspace('workflow-lab:positions', database)).toBeUndefined();
  });

  it('keeps a checkpoint explicit to its learner and refuses a foreign row', async () => {
    const database = freshDatabase();
    const owner = await ensureDevice(database);
    await saveWorkspace('exercise.attempt.fixture', { text: 'owned' }, database);
    expect(await database.workspace.get('exercise.attempt.fixture')).toMatchObject({
      learner_id: owner.learner_id,
      device_id: owner.device_id,
    });
    await database.workspace.put({
      key: 'exercise.attempt.foreign',
      learner_id: 'learner:foreign',
      device_id: 'device:foreign',
      value: { text: 'not yours' },
      updated_at: new Date().toISOString(),
    });
    expect(await loadWorkspace('exercise.attempt.foreign', database)).toBeUndefined();
    await clearWorkspace('exercise.attempt.foreign', database);
    expect(await database.workspace.get('exercise.attempt.foreign')).toBeDefined();
  });
});
