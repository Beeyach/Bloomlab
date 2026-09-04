import { beforeEach, describe, expect, it } from 'vitest';

import type { Exercise } from '@bloomlab/content-schema';
import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { crmExerciseRuntime } from '../crm/exerciseRuntime';
import { db } from '../data/db';
import { runtimeFor } from '../exercise/runtime';
import { workflowExerciseRuntime, WORKFLOW_RUNTIME_ID } from '../workflow/exerciseRuntime';
import { rememberRun } from '../simulator/currentRun';
import { startRun } from '../simulator/store';
import { blankFunnel, saveFunnel } from './commands';
import { funnelExerciseRuntime, FUNNEL_RUNTIME_ID } from './exerciseRuntime';
import * as edit from './edit';

/**
 * Which runtime owns which exercise (EXR-024, D-121).
 *
 * `runtimeFor` throws when two runtimes claim one exercise, so this walks every authored exercise
 * and proves there is never a second claimant — the Funnel Lab takes FUNNEL ASSEMBLY, the Workflow
 * Lab declines it, and nothing else changed hands.
 */

const exercises = content.exercises as unknown as Exercise[];
const byId = (id: string): Exercise => {
  const found = exercises.find((row) => row.id === id);
  if (!found) throw new Error(`${id} is not in the content bundle`);
  return found;
};

const scenario = (): SimulatorScenario =>
  (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === 'SC-glowhaus-funnel',
  ) as SimulatorScenario;

const assembly = () => byId('EX-FUNNEL_ASSEMBLY-glowhaus-consult-funnel');

describe('the Funnel Lab claims exactly the FUNNEL ASSEMBLY family', () => {
  it('claims the assembly exercise and nothing else', () => {
    expect(runtimeFor(assembly())?.id).toBe(FUNNEL_RUNTIME_ID);
    expect(funnelExerciseRuntime.handles(byId('EX-BUILD_IT-no-show-recovery'))).toBe(false);
    expect(funnelExerciseRuntime.handles(byId('EX-FIX_IT-jordan-treatment-interest'))).toBe(false);
    expect(funnelExerciseRuntime.handles(byId('EX-SAY_IT-summit-discovery'))).toBe(false);
  });

  it('the Workflow Lab declines it, so there is exactly one claimant', () => {
    expect(workflowExerciseRuntime.handles(assembly())).toBe(false);
    expect(crmExerciseRuntime.handles(assembly())).toBe(false);
    for (const exercise of exercises) expect(() => runtimeFor(exercise)).not.toThrow();
  });

  it('leaves the workflow exercises exactly where they were', () => {
    expect(runtimeFor(byId('EX-BUILD_IT-no-show-recovery'))?.id).toBe(WORKFLOW_RUNTIME_ID);
    expect(runtimeFor(byId('EX-FIX_IT-jordan-treatment-interest'))?.id).toBe(crmExerciseRuntime.id);
    expect(runtimeFor(byId('EX-SAY_IT-summit-discovery'))).toBeNull();
  });

  it('supplies architecture, so the assembly exercise is gradable rather than refused', () => {
    expect(funnelExerciseRuntime.provides).toContain('architecture');
  });
});

describe('the context comes from the run the learner is in', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('refuses to grade when the learner never opened the Lab', async () => {
    expect(await funnelExerciseRuntime.context(assembly(), {})).toBeNull();
  });

  it('reads the funnel from the account the learner has been working in', async () => {
    const run = await startRun(scenario());
    await rememberRun(scenario().id, run.state.run_id);
    let funnel = blankFunnel('fn-mine', 'My funnel');
    funnel = edit.addStep(funnel, 'Offer', 'capture', 'st-1');
    funnel = edit.addBlock(funnel, 'st-1', 'form', 'b1');
    funnel = edit.editBlock(funnel, 'b1', { reference_id: 'consult-request' });
    const saved = await saveFunnel(run, scenario(), funnel, { createWorker: null });
    expect(saved.ok).toBe(true);

    const context = await funnelExerciseRuntime.context(assembly(), {});
    expect(context).not.toBeNull();
    expect(context?.architecture?.funnels).toHaveLength(1);
    const read = context?.architecture?.funnels?.[0];
    expect(read?.id).toBe('fn-mine');
    expect(read?.steps[0]?.purpose).toBe('capture');
    expect(read?.steps[0]?.blocks[0]).toMatchObject({
      role: 'form',
      reference_id: 'consult-request',
      reference_resolved: true,
    });
    // A funnel exercise reads funnels; the learner's workflows are not offered as their answer.
    expect(context?.architecture?.workflows).toEqual([]);
  });
});
