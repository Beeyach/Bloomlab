import { expect, it } from 'vitest';
import { gradeExercise } from '@bloomlab/exercise-engine';
import type { SimulatorScenario, Workflow, WorkflowNode } from '@bloomlab/simulator-core';
import { content } from '../content/bundle';
import { freshDatabase } from '../data/testing';
import { startRun, type StoredRun } from '../simulator/store';
import { gradingContextFrom } from '../simulator/grading';
import {
  blankWorkflow,
  saveWorkflow,
  advanceTime,
  injectScenarioAction,
} from '../workflow/commands';
import { learnerArchitecture } from '../workflow/exerciseRuntime';
import { blankFunnel, saveFunnel, submitForm } from '../funnel/commands';
import * as edit from '../funnel/edit';
import { learnerFunnels } from '../funnel/exerciseRuntime';

const ok = (result: { ok: boolean; run?: StoredRun }): StoredRun => {
  expect(result.ok).toBe(true);
  return result.run!;
};
it('Reactivation is built and graded through the real Workflow Lab, including duplicate and exclusion failures', async () => {
  const database = freshDatabase(),
    options = { database, createWorker: null };
  const scenario = content.scenarios.find(
    (row) => row.id === 'SC-glowhaus-reactivation',
  ) as unknown as SimulatorScenario;
  const exercise = content.exercises.find((row) => row.id === 'EX-BUILD_IT-reactivation-trial')!;
  const node = (
    id: string,
    type: WorkflowNode['type'],
    feature: string | null,
    config: WorkflowNode['config'],
  ): WorkflowNode => ({
    id,
    type,
    ghl_feature_id: feature,
    config,
    label: null,
    position: { x: 0, y: 0 },
  });
  const workflow: Workflow = {
    ...blankWorkflow('trial', 'Reactivation trial'),
    trigger: {
      ghl_feature_id: 'GHL-WF-CONTACT-TAG',
      filters: [{ field: 'tag', operator: 'is', value: 'reactivation-approved' }],
    },
    nodes: [
      node('eligible', 'branch', 'GHL-WF-IF-ELSE', {
        branches: [
          {
            name: 'Eligible',
            groups: [
              {
                conditions: [
                  { field: 'contact.dnd', operator: 'is', value: false },
                  { field: 'contact.tags', operator: 'not_contains', value: 'booked' },
                ],
              },
            ],
          },
        ],
      }),
      node('phone', 'branch', 'GHL-WF-IF-ELSE', {
        branches: [
          {
            name: 'Has phone',
            groups: [{ conditions: [{ field: 'contact.phone', operator: 'exists' }] }],
          },
        ],
      }),
      node('sms', 'action', 'GHL-WF-SEND-SMS', {
        template: 'Would you like to resume your consultation? Reply if useful.',
        purpose: 'reactivation',
      }),
      node('email', 'action', 'GHL-WF-SEND-EMAIL', {
        subject: 'Your consultation enquiry',
        body: 'Reply if you would like to resume.',
        purpose: 'reactivation',
      }),
      node('tag', 'action', 'GHL-WF-ADD-CONTACT-TAG', { tag: 'reactivation-sent' }),
      node('owner', 'action', 'GHL-WF-SEND-INTERNAL-NOTIFICATION', {
        channel: 'in-app',
        recipient: 'dana',
        message: 'Please own the reply to this invitation.',
      }),
      node('end', 'end', null, {}),
    ],
    edges: [
      { from: 'eligible', to: 'phone', branch: 'Eligible' },
      { from: 'eligible', to: 'end', branch: 'None' },
      { from: 'phone', to: 'sms', branch: 'Has phone' },
      { from: 'phone', to: 'email', branch: 'None' },
      { from: 'sms', to: 'tag', branch: null },
      { from: 'email', to: 'tag', branch: null },
      { from: 'tag', to: 'owner', branch: null },
      { from: 'owner', to: 'end', branch: null },
    ],
  };
  let run = await startRun(scenario, database);
  const grade = () =>
    gradeExercise({
      exercise,
      context: gradingContextFrom(run.state, {
        architecture: learnerArchitecture(run.state.account, scenario),
      }),
    });
  expect(grade().outcome).toBe('failed');
  run = ok(await saveWorkflow(run, scenario, workflow, options));
  run = ok(await advanceTime(run, scenario, 'hour', options));
  run = ok(await injectScenarioAction(run, scenario, 'repeat-maria', options));
  expect(grade().outcome, JSON.stringify(grade().tiers)).toBe('passed');
  expect(grade().failed_critical).toEqual([]);
  database.close();
});

it('Application starter requires a connected qualification path and actual new/repeat submissions', async () => {
  const database = freshDatabase(),
    options = { database, createWorker: null };
  const scenario = content.scenarios.find(
    (row) => row.id === 'SC-summit-application-build',
  ) as unknown as SimulatorScenario;
  const exercise = content.exercises.find(
    (row) => row.id === 'EX-FUNNEL_ASSEMBLY-summit-application',
  )!;
  let run = await startRun(scenario, database);
  let funnel = blankFunnel('application', 'Application path');
  for (const [id, name, purpose] of [
    ['capture', 'Apply', 'capture'],
    ['qualification', 'Readiness', 'content'],
    ['booking', 'Book', 'booking'],
    ['confirmed', 'Next action', 'confirmation'],
  ] as const)
    funnel = edit.addStep(funnel, name, purpose, id);
  for (const [step, role, id, reference] of [
    ['capture', 'outcome', 'outcome', null],
    ['capture', 'proof', 'proof', null],
    ['capture', 'form', 'form', 'consult-request'],
    ['qualification', 'survey', 'survey', 'fit-check'],
    ['booking', 'calendar', 'calendar', 'consultation'],
  ] as const) {
    funnel = edit.addBlock(funnel, step, role, id);
    if (reference) funnel = edit.editBlock(funnel, id, { reference_id: reference });
  }
  run = ok(await saveFunnel(run, scenario, funnel, options));
  const grade = () =>
    gradeExercise({
      exercise,
      context: gradingContextFrom(run.state, {
        architecture: { workflows: [], funnels: learnerFunnels(run.state.account, scenario) },
      }),
    });
  expect(grade().outcome).toBe('failed');
  const visitor = { contact_id: 'new-applicant', is_new: true };
  run = ok(
    await submitForm(
      run,
      scenario,
      visitor,
      'consult-request',
      {
        first_name: 'Alex',
        last_name: 'Chen',
        email: 'alex.chen@example.com',
        phone: '+15125550142',
        treatment_interest: 'Business coaching',
      },
      options,
    ),
  );
  run = ok(
    await submitForm(
      run,
      scenario,
      visitor,
      'consult-request',
      {
        first_name: 'Alex',
        last_name: 'Chen',
        email: 'alex.chen@example.com',
        phone: '+15125550142',
        treatment_interest: 'Leadership coaching',
      },
      options,
    ),
  );
  expect(grade().outcome, JSON.stringify(grade().tiers)).toBe('passed');
  expect(run.state.account.contacts['new-applicant']?.custom_fields['treatment_interest']).toBe(
    'Leadership coaching',
  );
  database.close();
});
