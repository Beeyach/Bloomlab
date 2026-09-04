import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Exercise } from '@bloomlab/content-schema';
import { gradeExercise } from '@bloomlab/exercise-engine';
import type { SimulatorScenario, Workflow } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { crmExerciseRuntime } from '../crm/exerciseRuntime';
import type { BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { freshDatabase } from '../data/testing';
import { runtimeFor } from '../exercise/runtime';
import { gradingContextFrom } from '../simulator/grading';
import { startRun, type StoredRun } from '../simulator/store';
import {
  advanceTime,
  advanceTimeTo,
  blankWorkflow,
  bookAppointment,
  changeAppointmentStatus,
  enrolTestContact,
  saveWorkflow,
} from './commands';
import {
  learnerArchitecture,
  workflowExerciseRuntime,
  WORKFLOW_RUNTIME_ID,
} from './exerciseRuntime';

/**
 * The Workflow Lab as an exercise runtime (EXR-004 … EXR-007, EXR-019, EXR-023, D-112).
 *
 * The authored no-show recovery BUILD IT is built through the command layer, Maria no-shows in
 * the same account, and the exercise is graded from that run: architecture from the definition
 * the learner saved, events from what the engine did, timing from the instant the account
 * recorded. Nothing is a fixture written to suit the grader.
 */

const scenario = (content.scenarios as unknown as SimulatorScenario[]).find(
  (row) => row.id === 'SC-glowhaus-no-show',
) as SimulatorScenario;
const buildIt = content.exercises.find(
  (row) => row.id === 'EX-BUILD_IT-no-show-recovery',
) as Exercise;
const missingPhone = content.exercises.find(
  (row) => row.id === 'EX-EDGE_CASE-no-show-missing-phone',
) as Exercise;

let database: BloomlabDatabase;
const direct = () => ({ database, createWorker: null });

beforeEach(async () => {
  database = freshDatabase();
  await ensureDevice(database);
});
afterEach(() => database.close());

const ok = <T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
};

/** The worked example from the exercise's own hint, built as data. */
const recovery = (): Workflow => ({
  ...blankWorkflow('wf-no-show-recovery', 'No-show recovery'),
  trigger: {
    ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
    filters: [{ field: 'appointment_status', operator: 'is', value: 'no_show' }],
  },
  nodes: [
    {
      id: 'n1',
      type: 'branch',
      ghl_feature_id: 'GHL-WF-IF-ELSE',
      label: null,
      position: { x: 0, y: 0 },
      config: {
        branches: [
          {
            name: 'Has phone',
            groups: [{ conditions: [{ field: 'contact.phone', operator: 'exists' }] }],
          },
        ],
      },
    },
    {
      id: 'n2',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-SMS',
      label: null,
      position: { x: 0, y: 1 },
      config: {
        template:
          'Sorry we missed you, {{contact.first_name}}. Rebook: {{custom_values.booking_link}}',
        purpose: 'rebooking',
      },
    },
    {
      id: 'n3',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-EMAIL',
      label: null,
      position: { x: 1, y: 1 },
      config: {
        subject: 'We missed you',
        body: 'Rebook: {{custom_values.booking_link}}',
        purpose: 'rebooking',
      },
    },
    {
      id: 'n4',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-INTERNAL-NOTIFICATION',
      label: null,
      position: { x: 0, y: 2 },
      config: {
        channel: 'in-app',
        recipient: 'dana',
        message: '{{contact.first_name}} no-showed; please call.',
      },
    },
    {
      id: 'n5',
      type: 'wait',
      ghl_feature_id: 'GHL-WF-WAIT',
      label: null,
      position: { x: 0, y: 3 },
      config: { wait_type: 'period', days: 3 },
    },
    {
      id: 'n6',
      type: 'branch',
      ghl_feature_id: 'GHL-WF-IF-ELSE',
      label: null,
      position: { x: 0, y: 4 },
      config: {
        branches: [
          {
            name: 'Rebooked',
            groups: [
              { conditions: [{ field: 'contact.tags', operator: 'contains', value: 'rebooked' }] },
            ],
          },
        ],
      },
    },
    {
      id: 'n7',
      type: 'action',
      ghl_feature_id: 'GHL-WF-CREATE-UPDATE-OPPORTUNITY',
      label: null,
      position: { x: 0, y: 5 },
      config: { pipeline: 'consultations', stage: 'Lost' },
    },
    {
      id: 'n8',
      type: 'end',
      ghl_feature_id: null,
      label: null,
      config: {},
      position: { x: 1, y: 5 },
    },
  ],
  edges: [
    { from: 'n1', to: 'n2', branch: 'Has phone' },
    { from: 'n1', to: 'n3', branch: 'None' },
    { from: 'n2', to: 'n4', branch: null },
    { from: 'n3', to: 'n4', branch: null },
    { from: 'n4', to: 'n5', branch: null },
    { from: 'n5', to: 'n6', branch: null },
    { from: 'n6', to: 'n8', branch: 'Rebooked' },
    { from: 'n6', to: 'n7', branch: 'None' },
  ],
});

describe('who grades what (EXR-024)', () => {
  it('claims the workflow exercises, leaves the CRM ones to the CRM runtime, and never doubles up', () => {
    expect(runtimeFor(buildIt)?.id).toBe(WORKFLOW_RUNTIME_ID);
    expect(runtimeFor(missingPhone)?.id).toBe(WORKFLOW_RUNTIME_ID);
    const crm = content.exercises.find(
      (row) => row.id === 'EX-FIX_IT-jordan-treatment-interest',
    ) as Exercise;
    expect(runtimeFor(crm)?.id).toBe(crmExerciseRuntime.id);
    for (const exercise of content.exercises) expect(() => runtimeFor(exercise)).not.toThrow();
    // A roleplay exercise on a call scenario has no run to grade from.
    const sayIt = content.exercises.find(
      (row) => row.id === 'EX-SAY_IT-summit-discovery',
    ) as Exercise;
    expect(runtimeFor(sayIt)).toBeNull();
  });

  it('refuses to grade when the learner has never opened the scenario', async () => {
    expect(await workflowExerciseRuntime.context(buildIt, {})).toBeNull();
  });
});

describe('architecture comes from what the learner built (D-112)', () => {
  it('offers new and changed workflows, not the scenario’s untouched ones', async () => {
    let run = await startRun(scenario, database);
    expect(learnerArchitecture(run.state.account, scenario).workflows).toEqual([]);
    run = ok(await saveWorkflow(run, scenario, recovery(), direct())).run;
    const theirs = learnerArchitecture(run.state.account, scenario);
    expect(theirs.workflows.map((row) => row.id)).toEqual(['wf-no-show-recovery']);
    expect(theirs.workflows[0]?.nodes.some((node) => 'position' in node)).toBe(false);
    // Editing the authored confirmation makes it theirs too.
    const confirmation = run.state.account.workflows['wf-booking-confirmation'] as Workflow;
    run = ok(
      await saveWorkflow(run, scenario, { ...confirmation, name: 'Confirmation v2' }, direct()),
    ).run;
    expect(
      learnerArchitecture(run.state.account, scenario)
        .workflows.map((row) => row.id)
        .sort(),
    ).toEqual(['wf-booking-confirmation', 'wf-no-show-recovery']);
  });
});

describe('the authored BUILD IT, graded from a real run (EXR-004, EXR-023)', () => {
  async function build(): Promise<StoredRun> {
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, recovery(), direct())).run;
    // Maria's authored consultation is on the 4th at 15:00; the front desk marks it a no-show.
    run = ok(await advanceTime(run, scenario, 'day', direct())).run;
    run = ok(await changeAppointmentStatus(run, scenario, 'appt-maria', 'no_show', direct())).run;
    return run;
  }

  it('enrols on the no-show, texts, notifies, and after three days marks the deal Lost', async () => {
    let run = await build();
    const recoveryRun = Object.values(run.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-no-show-recovery',
    );
    expect(recoveryRun).toMatchObject({ contact_id: 'maria', status: 'waiting' });
    expect(run.state.account.conversations.maria?.messages.at(-1)?.body).toContain(
      'Rebook: https://glowhausaustin.com/book',
    );
    for (let day = 0; day < 3; day += 1)
      run = ok(await advanceTime(run, scenario, 'day', direct())).run;
    expect(run.state.account.opportunities['opp-maria']?.stage).toBe('Lost');

    const context = gradingContextFrom(run.state, {
      subjectContactId: 'maria',
      architecture: learnerArchitecture(run.state.account, scenario),
    });
    expect(context.references['appointment.no_show']).toBe('2026-09-04T09:00:00-05:00');
    const report = gradeExercise({ exercise: buildIt, context });
    const byId = Object.fromEntries(
      Object.values(report.tiers)
        .flat()
        .map((result) => [result.id, result]),
    );
    expect(byId.a1?.passed).toBe(true); // trigger exists
    expect(byId.a2?.passed).toBe(true); // exactly one rebooking text to Maria
    expect(byId.a3?.passed).toBe(true); // within fifteen minutes of the no-show
    expect(byId.a4?.passed).toBe(true); // the front desk was notified
    expect(byId.a5?.passed).toBe(true); // Lost after three days
    expect(byId.a6?.passed).toBe(true); // a branch exists
    expect(byId.c1?.passed).toBe(true); // Lena never texted
    expect(byId.c2?.passed).toBe(true); // no cancelled enrolment
    expect(report.outcome).toBe('passed');
    expect(report.score).toBe(100);
    expect(report.dimensions?.architecture).toMatchObject({ weight: 15, total: 2, passed: 2 });
    expect(report.dimensions?.correctness).toMatchObject({ weight: 45, total: 4, passed: 4 });
  });

  it('a cancelled appointment must not enter the recovery workflow, and the grade says so when it does', async () => {
    // A recovery built on Appointment Status with no filter enrols on every status change.
    const careless: Workflow = {
      ...recovery(),
      trigger: { ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS', filters: [] },
    };
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, careless, direct())).run;
    run = ok(await changeAppointmentStatus(run, scenario, 'appt-maria', 'cancelled', direct())).run;
    const context = gradingContextFrom(run.state, {
      subjectContactId: 'maria',
      architecture: learnerArchitecture(run.state.account, scenario),
    });
    const enrolled = context.events.find((event) => event.type === 'workflow.enrolled');
    expect(enrolled?.fields).toMatchObject({
      contact_id: 'maria',
      trigger_appointment_status: 'cancelled',
    });
    const report = gradeExercise({ exercise: buildIt, context });
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
    expect(report.failed_critical).toEqual(['c2']);
  });

  it('a text to a contact with no phone is an action.skipped for Send SMS, not an sms.sent', async () => {
    let run = await startRun(scenario, database);
    // A recovery with no phone branch: Jordan (no phone) is texted blindly.
    const blind: Workflow = {
      ...recovery(),
      nodes: recovery().nodes.filter((node) => node.id !== 'n1' && node.id !== 'n3'),
      edges: [
        { from: 'n2', to: 'n4', branch: null },
        { from: 'n4', to: 'n5', branch: null },
        { from: 'n5', to: 'n6', branch: null },
        { from: 'n6', to: 'n8', branch: 'Rebooked' },
        { from: 'n6', to: 'n7', branch: 'None' },
      ],
    };
    run = ok(await saveWorkflow(run, scenario, blind, direct())).run;
    run = ok(
      await enrolTestContact(run, scenario, 'wf-no-show-recovery', 'jordan', {}, direct()),
    ).run;
    const context = gradingContextFrom(run.state, { subjectContactId: 'jordan' });
    const skipped = context.events.filter((event) => event.type === 'action.skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.fields).toMatchObject({
      contact_id: 'jordan',
      action: 'GHL-WF-SEND-SMS',
      reason: 'missing_phone',
      attempted: 'sms.sent',
    });
    expect(context.events.filter((event) => event.type === 'sms.sent')).toHaveLength(0);
    const report = gradeExercise({
      exercise: missingPhone,
      context: {
        ...context,
        architecture: learnerArchitecture(run.state.account, scenario),
        provides: [...context.provides, 'architecture'],
      },
    });
    expect(report.failed_critical).toEqual(['c1']);
  });
});

describe('FIX IT, graded from the broken account (EXR-005)', () => {
  const broken = (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === 'SC-glowhaus-double-reminder',
  ) as SimulatorScenario;
  const fixIt = content.exercises.find((row) => row.id === 'EX-FIX_IT-double-reminder') as Exercise;

  /** Maria books; both published workflows enrol; the day passes to the 24h-before wake. */
  async function reproduce(run: StoredRun): Promise<StoredRun> {
    run = ok(
      await bookAppointment(
        run,
        broken,
        'maria',
        'consultation',
        '2026-09-06T14:00:00-05:00',
        direct(),
      ),
    ).run;
    return ok(await advanceTimeTo(run, broken, '2026-09-05T14:30:00-05:00', direct())).run;
  }

  const grade = (run: StoredRun) =>
    gradeExercise({
      exercise: fixIt,
      context: gradingContextFrom(run.state, {
        subjectContactId: 'maria',
        architecture: learnerArchitecture(run.state.account, broken),
      }),
    });

  it('the symptom reproduces from the account as authored: two reminders from two workflows', async () => {
    const run = await reproduce(await startRun(broken, database));
    const texts = run.state.account.conversations.maria?.messages.filter(
      (message) => message.direction === 'outbound' && message.channel === 'sms',
    );
    expect(texts).toHaveLength(2);
    const senders = Object.values(run.state.account.workflow_runs).map((row) => row.workflow_id);
    expect(senders.sort()).toEqual(['wf-booking-tags', 'wf-reminders']);
    const report = grade(run);
    expect(report.outcome).toBe('failed');
    expect(report.failed_critical).toEqual(['c1']);
  });

  it('removing the copied reminder from Booking Tags fixes the cause and the grade agrees', async () => {
    let run = await startRun(broken, database);
    const tags = run.state.account.workflows['wf-booking-tags'] as Workflow;
    const fixed: Workflow = {
      ...tags,
      nodes: tags.nodes.filter((node) => node.id === 'n1' || node.id === 'n4'),
      edges: [{ from: 'n1', to: 'n4', branch: null }],
    };
    run = ok(await saveWorkflow(run, broken, fixed, direct())).run;
    run = await reproduce(run);
    const texts = run.state.account.conversations.maria?.messages.filter(
      (message) => message.direction === 'outbound' && message.channel === 'sms',
    );
    expect(texts).toHaveLength(1);
    expect(run.state.account.contacts.maria?.tags).toContain('booked');
    // The changed workflow is the learner's architecture; the untouched reminder is not.
    expect(learnerArchitecture(run.state.account, broken).workflows.map((w) => w.id)).toEqual([
      'wf-booking-tags',
    ]);
    const report = grade(run);
    expect(report.failed_critical).toEqual([]);
    expect(report.outcome).toBe('passed');
    expect(report.score).toBe(100);
  });
});

describe('REBUILD BLIND, graded from the learner’s own reminder system (EXR-019)', () => {
  const rebuild = content.exercises.find(
    (row) => row.id === 'EX-REBUILD_BLIND-appointment-reminders',
  ) as Exercise;

  const reminders = (): Workflow => ({
    ...blankWorkflow('wf-reminders', 'Appointment Reminders'),
    trigger: {
      ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
      filters: [{ field: 'appointment_status', operator: 'is', value: 'new' }],
    },
    nodes: [
      {
        id: 'n1',
        type: 'wait',
        ghl_feature_id: 'GHL-WF-WAIT',
        label: null,
        position: { x: 0, y: 0 },
        config: { wait_type: 'appointment', relative: 'before', hours: 24 },
      },
      {
        id: 'n2',
        type: 'action',
        ghl_feature_id: 'GHL-WF-SEND-SMS',
        label: null,
        position: { x: 0, y: 1 },
        config: {
          template: 'See you tomorrow at {{appointment.start_time}}.',
          purpose: 'reminder',
        },
      },
      {
        id: 'n3',
        type: 'wait',
        ghl_feature_id: 'GHL-WF-WAIT',
        label: null,
        position: { x: 0, y: 2 },
        config: { wait_type: 'appointment', relative: 'before', hours: 2 },
      },
      {
        id: 'n4',
        type: 'action',
        ghl_feature_id: 'GHL-WF-SEND-SMS',
        label: null,
        position: { x: 0, y: 3 },
        config: { template: 'See you in two hours, {{contact.first_name}}.', purpose: 'reminder' },
      },
      {
        id: 'n5',
        type: 'end',
        ghl_feature_id: null,
        label: null,
        config: {},
        position: { x: 0, y: 4 },
      },
    ],
    edges: [
      { from: 'n1', to: 'n2', branch: null },
      { from: 'n2', to: 'n3', branch: null },
      { from: 'n3', to: 'n4', branch: null },
      { from: 'n4', to: 'n5', branch: null },
    ],
  });

  it('two reminders land 24h and 2h before Maria’s consultation, and the grade is read from them', async () => {
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, reminders(), direct())).run;
    run = ok(
      await enrolTestContact(
        run,
        scenario,
        'wf-reminders',
        'maria',
        { appointment_id: 'appt-maria' },
        direct(),
      ),
    ).run;
    // Maria's consultation is on the 4th at 15:00; move past the second reminder, not the no-show.
    run = ok(await advanceTimeTo(run, scenario, '2026-09-04T13:30:00-05:00', direct())).run;
    const texts = (run.state.account.conversations.maria?.messages ?? []).filter(
      (message) => message.direction === 'outbound' && message.channel === 'sms',
    );
    expect(texts.map((message) => message.at)).toEqual([
      '2026-09-03T15:00:00-05:00',
      '2026-09-04T13:00:00-05:00',
    ]);
    const context = gradingContextFrom(run.state, {
      subjectContactId: 'maria',
      architecture: learnerArchitecture(run.state.account, scenario),
    });
    expect(context.references['appointment.start']).toBe('2026-09-04T15:00:00-05:00');
    const report = gradeExercise({ exercise: rebuild, context });
    const byId = Object.fromEntries(
      Object.values(report.tiers)
        .flat()
        .map((result) => [result.id, result]),
    );
    expect(byId.a1?.passed).toBe(true);
    expect(byId.a2?.passed).toBe(true);
    expect(byId.a3?.passed).toBe(true);
    expect(byId.c1?.passed).toBe(true);
    expect(report.outcome).toBe('passed');
  });
});
