import { describe, expect, it } from 'vitest';

import { freshDatabase } from './testing';
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
});
