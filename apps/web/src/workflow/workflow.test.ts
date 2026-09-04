import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  historyHash,
  stateHash,
  type SimulatorScenario,
  type Workflow,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import type { BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { freshDatabase } from '../data/testing';
import { currentCrmRunId, rememberCrmRun } from '../crm/currentRun';
import { currentRunId, rememberRun, savedRuns } from '../simulator/currentRun';
import { loadRun, startRun, type StoredRun } from '../simulator/store';
import {
  advanceTime,
  advanceTimeTo,
  blankWorkflow,
  createTestContact,
  enrolTestContact,
  fireTriggerEvent,
  injectReply,
  saveWorkflow,
} from './commands';
import { canRedo, canUndo, edit, isDirty, markSaved, redo, startHistory, undo } from './draft';
import { handleEngineRequest, runOp, type EngineOp, type EngineRequest } from './engineOps';
import { execute, resetEngineWorker } from './execution';
import {
  buildTriggerEvent,
  directStartOutcome,
  enrolledByEvent,
  triggerOutcomeFor,
  triggerTestOptions,
} from './triggerTest';
import { timelineRow } from './words';

/**
 * The Workflow Lab's command and execution layers (WFL-002, SIM-014, D-107, D-109, D-110).
 *
 * Nothing here renders. These tests pin the contract the screens rely on: definitions are
 * account events, the worker and the direct path compute the same thing, a crash leaves the saved
 * run untouched, undo never touches history, and the current-run rule is one rule for every Lab.
 */

const scenario = (content.scenarios as unknown as SimulatorScenario[]).find(
  (row) => row.id === 'SC-glowhaus-no-show',
) as SimulatorScenario;

let database: BloomlabDatabase;
const direct = () => ({ database, createWorker: null });

beforeEach(async () => {
  database = freshDatabase();
  await ensureDevice(database);
  resetEngineWorker();
});

afterEach(() => {
  database.close();
});

const noShowRecovery = (): Workflow => ({
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
      config: {
        branches: [
          {
            name: 'Has phone',
            groups: [{ conditions: [{ field: 'contact.phone', operator: 'exists' }] }],
          },
        ],
      },
      position: { x: 0, y: 120 },
    },
    {
      id: 'n2',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-SMS',
      label: null,
      config: {
        template:
          'Sorry we missed you, {{contact.first_name}}. Rebook: {{custom_values.booking_link}}',
        purpose: 'rebooking',
      },
      position: { x: 0, y: 240 },
    },
    {
      id: 'n3',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-EMAIL',
      label: null,
      config: { subject: 'We missed you', body: 'Rebook here: {{custom_values.booking_link}}' },
      position: { x: 240, y: 240 },
    },
    {
      id: 'n4',
      type: 'end',
      ghl_feature_id: null,
      label: null,
      config: {},
      position: { x: 0, y: 360 },
    },
  ],
  edges: [
    { from: 'n1', to: 'n2', branch: 'Has phone' },
    { from: 'n1', to: 'n3', branch: 'None' },
    { from: 'n2', to: 'n4', branch: null },
    { from: 'n3', to: 'n4', branch: null },
  ],
});

const ok = (result: Awaited<ReturnType<typeof execute>>): StoredRun => {
  if (!result.ok) throw new Error(`${result.refusal.code}: ${result.refusal.message}`);
  return result.run;
};

describe('definitions are account events (WFL-002, D-107)', () => {
  it('saves a new workflow as WORKFLOW_CREATED and a change as WORKFLOW_UPDATED, and persists both', async () => {
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, noShowRecovery(), direct()));
    expect(run.state.account.workflows['wf-no-show-recovery']?.version).toBe(1);
    expect(run.state.log.at(-1)?.type).toBe('WORKFLOW_CREATED');

    const renamed = { ...noShowRecovery(), name: 'No-show recovery v2' };
    run = ok(await saveWorkflow(run, scenario, renamed, direct()));
    expect(run.state.account.workflows['wf-no-show-recovery']).toMatchObject({
      name: 'No-show recovery v2',
      version: 2,
    });
    expect(run.state.log.at(-1)?.type).toBe('WORKFLOW_UPDATED');

    // A reload finds the definition where the engine put it: in the account, from the log.
    const reloaded = await loadRun(run.state.run_id, database);
    expect(reloaded?.state.account.workflows['wf-no-show-recovery']?.version).toBe(2);
    expect(reloaded?.state.log.filter((row) => row.type.startsWith('WORKFLOW_'))).toHaveLength(2);
  });

  it('refuses a malformed definition and leaves the saved run untouched', async () => {
    const run = await startRun(scenario, database);
    const before = stateHash(run.state);
    const broken = {
      ...noShowRecovery(),
      edges: [{ from: 'n1', to: 'ghost', branch: null }],
    };
    const result = await saveWorkflow(run, scenario, broken, direct());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe('UNKNOWN_ENTITY');
    expect(result.run).toBe(run);
    expect(stateHash((await loadRun(run.state.run_id, database))!.state)).toBe(before);
  });
});

describe('a test contact runs through the real engine (WFL-004)', () => {
  it('enrols, branches on the contact, sends, and records every step in the shared account', async () => {
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, noShowRecovery(), direct()));
    run = ok(await enrolTestContact(run, scenario, 'wf-no-show-recovery', 'maria', {}, direct()));
    const [recovery] = Object.values(run.state.account.workflow_runs).filter(
      (row) => row.workflow_id === 'wf-no-show-recovery',
    );
    expect(recovery?.status).toBe('completed');
    expect(recovery?.completed_node_ids).toEqual(['n1', 'n2', 'n4']);
    const message = run.state.account.conversations.maria?.messages.at(-1);
    expect(message?.body).toBe(
      'Sorry we missed you, Maria. Rebook: https://glowhausaustin.com/book',
    );
    expect(run.state.log.find((row) => row.type === 'SMS_SENT')?.payload.purpose).toBe('rebooking');
    expect(run.state.execution.some((row) => row.kind === 'branch_result')).toBe(true);
    // Jordan has no phone: the None branch emails instead.
    run = ok(await enrolTestContact(run, scenario, 'wf-no-show-recovery', 'jordan', {}, direct()));
    expect(run.state.account.conversations.jordan?.messages.at(-1)?.channel).toBe('email');
  });

  it('a generated test contact is a real contact from then on', async () => {
    let run = await startRun(scenario, database);
    run = ok(
      await createTestContact(
        run,
        scenario,
        { first_name: 'Test', phone: '+15125550999', tags: ['vip'] },
        direct(),
      ),
    );
    const created = Object.values(run.state.account.contacts).find(
      (row) => row.first_name === 'Test',
    );
    expect(created?.source).toBe('Workflow Lab test contact');
    expect(created?.tags).toEqual(['vip']);
  });

  it('an injected reply releases a reply wait and the Time Machine releases a period wait', async () => {
    const asker: Workflow = {
      ...blankWorkflow('wf-ask', 'Ask'),
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-TAG', filters: [] },
      nodes: [
        {
          id: 's1',
          type: 'action',
          ghl_feature_id: 'GHL-WF-SEND-SMS',
          label: null,
          config: { template: 'Reply YES' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'w1',
          type: 'wait',
          ghl_feature_id: 'GHL-WF-WAIT',
          label: null,
          config: { wait_type: 'reply', channel: 'sms' },
          position: { x: 0, y: 1 },
        },
        {
          id: 'w2',
          type: 'wait',
          ghl_feature_id: 'GHL-WF-WAIT',
          label: null,
          config: { wait_type: 'period', hours: 1 },
          position: { x: 0, y: 2 },
        },
        {
          id: 't1',
          type: 'action',
          ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
          label: null,
          config: { tag: 'replied' },
          position: { x: 0, y: 3 },
        },
      ],
      edges: [
        { from: 's1', to: 'w1', branch: null },
        { from: 'w1', to: 'w2', branch: null },
        { from: 'w2', to: 't1', branch: null },
      ],
    };
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, asker, direct()));
    run = ok(await enrolTestContact(run, scenario, 'wf-ask', 'maria', {}, direct()));
    const runOf = (state: StoredRun) =>
      Object.values(state.state.account.workflow_runs).find((row) => row.workflow_id === 'wf-ask')!;
    expect(runOf(run)).toMatchObject({ status: 'waiting', wait: { kind: 'reply' } });
    run = ok(await injectReply(run, scenario, 'maria', 'YES', 'sms', direct()));
    expect(runOf(run)).toMatchObject({ status: 'waiting', wait: { kind: 'period' } });
    run = ok(await advanceTime(run, scenario, 'hour', direct()));
    expect(runOf(run).status).toBe('completed');
    expect(run.state.account.contacts.maria?.tags).toContain('replied');
  });
});

describe('worker and direct execution agree (SIM-014)', () => {
  const ops: EngineOp[] = [
    {
      kind: 'process',
      event: {
        type: 'TAG_ADDED',
        at: '2026-09-03T09:00:00-05:00',
        payload: { contact_id: 'maria', tag: 'vip' },
        origin: 'injected',
      },
    },
    { kind: 'inject_action', action_id: 'jordan-books-late' },
    { kind: 'advance', step: 'day' },
    { kind: 'next_event' },
    { kind: 'advance_to', at: '2026-09-05T09:00:00-05:00' },
  ];

  it('produces the same state hash, event log, execution log, queue and random state', async () => {
    let viaDirect = await startRun(scenario, database);
    viaDirect = ok(await saveWorkflow(viaDirect, scenario, noShowRecovery(), direct()));
    let viaWorker = viaDirect;
    for (const op of ops) {
      const one = runOp(viaDirect.state, scenario, op);
      if (!one.ok) throw new Error(one.refusal.message);
      viaDirect = { ...viaDirect, state: one.state };
      // The worker path, without a thread: the request and the response cross a structured
      // clone, exactly as postMessage would carry them.
      const request: EngineRequest = structuredClone({
        id: 1,
        state: viaWorker.state,
        scenario,
        op,
      });
      const response = structuredClone(handleEngineRequest(request));
      if (!response.ok) throw new Error(response.refusal.message);
      viaWorker = { ...viaWorker, state: response.state };
    }
    expect(stateHash(viaWorker.state)).toBe(stateHash(viaDirect.state));
    expect(historyHash(viaWorker.state)).toBe(historyHash(viaDirect.state));
    expect(viaWorker.state.log).toEqual(viaDirect.state.log);
    expect(viaWorker.state.execution).toEqual(viaDirect.state.execution);
    expect(viaWorker.state.queue).toEqual(viaDirect.state.queue);
    expect(viaWorker.state.random).toEqual(viaDirect.state.random);
    expect(viaDirect.state.log.length).toBeGreaterThan(5);
  });

  it('a batch applies all of its operations or none', async () => {
    const run = await startRun(scenario, database);
    const failing = runOp(run.state, scenario, {
      kind: 'batch',
      ops: [
        ops[0] as EngineOp,
        {
          kind: 'process',
          event: {
            type: 'TAG_ADDED',
            at: '2026-09-03T09:00:00-05:00',
            payload: { contact_id: 'nobody', tag: 'x' },
            origin: 'injected',
          },
        },
      ],
    });
    expect(failing.ok).toBe(false);
    const result = await execute(
      run,
      scenario,
      { kind: 'batch', ops: [ops[0] as EngineOp, ops[2] as EngineOp] },
      direct(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.run.state.account.contacts.maria?.tags).toContain('vip');
  });

  it('a worker that crashes leaves the saved run exactly as it was, and the next call works', async () => {
    const run = await startRun(scenario, database);
    const before = stateHash(run.state);
    // A worker whose only behaviour is to fail.
    const crashing = () => {
      const fake = {
        onmessage: null,
        onerror: null as ((event: ErrorEvent) => void) | null,
        terminate() {},
        postMessage() {
          setTimeout(() => fake.onerror?.({ message: 'boom' } as ErrorEvent), 0);
        },
      };
      return fake as unknown as Worker;
    };
    const failed = await execute(run, scenario, ops[0] as EngineOp, {
      database,
      mode: 'worker',
      createWorker: crashing,
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.refusal.code).toBe('ENGINE_CRASHED');
    expect(failed.run).toBe(run);
    expect(stateHash((await loadRun(run.state.run_id, database))!.state)).toBe(before);

    // A worker that answers, built the way the real one is, on the same thread.
    resetEngineWorker();
    const answering = () => {
      const fake = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null,
        terminate() {},
        postMessage(request: EngineRequest) {
          setTimeout(
            () => fake.onmessage?.({ data: handleEngineRequest(request) } as MessageEvent),
            0,
          );
        },
      };
      return fake as unknown as Worker;
    };
    const worked = await execute(run, scenario, ops[0] as EngineOp, {
      database,
      mode: 'worker',
      createWorker: answering,
    });
    expect(worked.ok).toBe(true);
    if (worked.ok) {
      expect(worked.timing.ran_in).toBe('worker');
      expect(worked.run.state.account.contacts.maria?.tags).toContain('vip');
    }
  });

  it('a worker that never answers times out without touching the run', async () => {
    const run = await startRun(scenario, database);
    const silent = () =>
      ({ postMessage() {}, terminate() {}, onmessage: null, onerror: null }) as unknown as Worker;
    const result = await execute(run, scenario, ops[0] as EngineOp, {
      database,
      mode: 'worker',
      createWorker: silent,
      timeoutMs: 20,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe('ENGINE_TIMEOUT');
    expect(result.run).toBe(run);
  });

  it('a refusal from the engine is data, not a crash, and persists nothing', async () => {
    const run = await startRun(scenario, database);
    const result = await advanceTimeTo(run, scenario, '2020-01-01T00:00:00-05:00', direct());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe('INVALID_TIME');
    expect((await loadRun(run.state.run_id, database))!.state.log).toHaveLength(0);
  });
});

describe('undo and redo over drafts (WFL-002, D-110)', () => {
  it('walks edits back and forward, treats a no-op as nothing, and never touches the account', async () => {
    let run = await startRun(scenario, database);
    const logBefore = run.state.log.length;
    const first = noShowRecovery();
    let history = startHistory(first);
    expect(canUndo(history)).toBe(false);
    history = edit(history, { ...first, name: 'Second' });
    history = edit(history, { ...first, name: 'Second' }); // the same draft again: no entry
    history = edit(history, { ...first, name: 'Third' });
    expect(history.past).toHaveLength(2);
    expect(isDirty(history)).toBe(true);
    history = undo(history);
    expect(history.present.name).toBe('Second');
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present.name).toBe('Third');
    // A new edit after an undo drops the redo branch.
    history = undo(history);
    history = edit(history, { ...first, name: 'Fork' });
    expect(canRedo(history)).toBe(false);
    // Saving is the only thing that reaches the account, as one event.
    run = ok(await saveWorkflow(run, scenario, history.present, direct()));
    history = markSaved(history);
    expect(isDirty(history)).toBe(false);
    expect(run.state.log.length).toBe(logBefore + 1);
    // Undo after a save is an unsaved draft again — and still no event.
    history = undo(history);
    expect(isDirty(history)).toBe(true);
    expect(run.state.log.length).toBe(logBefore + 1);
  });

  it('moving a node is an undoable edit, because layout is part of the draft', () => {
    const first = noShowRecovery();
    const moved = {
      ...first,
      nodes: first.nodes.map((node) =>
        node.id === 'n1' ? { ...node, position: { x: 400, y: 120 } } : node,
      ),
    };
    const history = edit(startHistory(first), moved);
    expect(canUndo(history)).toBe(true);
    expect(undo(history).present.nodes[0]?.position.x).toBe(0);
  });
});

describe('one current-run rule for every Lab (D-099, D-108)', () => {
  it('the CRM Lab and the Workflow Lab resolve the same run for one scenario', async () => {
    const first = await startRun(scenario, database);
    const second = await startRun(scenario, database);
    expect((await savedRuns(scenario.id, database)).map((row) => row.run_id)).toContain(
      first.state.run_id,
    );
    await rememberRun(scenario.id, first.state.run_id, database);
    expect(await currentRunId(scenario.id, database)).toBe(first.state.run_id);
    expect(await currentCrmRunId(scenario.id, database)).toBe(first.state.run_id);
    await rememberRun(scenario.id, second.state.run_id, database);
    expect(await currentCrmRunId(scenario.id, database)).toBe(second.state.run_id);
  });

  it('the Phase 11 crm_run_id still counts for the CRM scenario', async () => {
    const crm = (content.scenarios as unknown as SimulatorScenario[]).find(
      (row) => row.id === 'SC-glowhaus-crm',
    ) as SimulatorScenario;
    const a = await startRun(crm, database);
    const b = await startRun(crm, database);
    await rememberCrmRun(a.state.run_id, database);
    expect(await currentRunId(crm.id, database)).toBe(a.state.run_id);
    const device = await database.device.toCollection().first();
    expect(device?.crm_run_id).toBe(a.state.run_id);
    expect(device?.lab_runs?.[crm.id]).toBe(a.state.run_id);
    await rememberRun(crm.id, b.state.run_id, database);
    expect(await currentCrmRunId(crm.id, database)).toBe(b.state.run_id);
  });
});

describe('the boundary holds (WFL-011, D-109)', () => {
  const dir = join(process.cwd(), 'apps', 'web', 'src', 'workflow');
  const files = (): { name: string; source: string }[] => {
    const found: { name: string; source: string }[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder)) {
        const path = join(folder, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          /\.(ts|tsx)$/.test(entry) &&
          !entry.endsWith('.test.ts') &&
          !entry.endsWith('.test.tsx')
        ) {
          found.push({ name: path.slice(dir.length + 1), source: readFileSync(path, 'utf8') });
        }
      }
    };
    walk(dir);
    return found;
  };

  it('no React file in the Workflow Lab runs the engine or writes storage itself', () => {
    const screens = files().filter((file) => file.name.endsWith('.tsx'));
    for (const file of screens) {
      for (const name of [
        'processEvent',
        'advanceTo',
        'nextEvent(',
        'injectAction',
        'commitRun',
        'saveRun',
        'resetStoredRun',
      ]) {
        expect(file.source.includes(name), `${file.name} reaches for ${name}`).toBe(false);
      }
    }
  });

  it('the Lab hardcodes no list of triggers or actions', () => {
    for (const file of files()) {
      expect(
        /const\s+(ACTIONS|TRIGGERS)\s*(:[^=]+)?=\s*\[/.test(file.source),
        `${file.name} hardcodes a palette`,
      ).toBe(false);
    }
  });

  it('only the execution layer and the worker touch the engine operations', () => {
    const importers = files().filter((file) => /from '\.\/engineOps'/.test(file.source));
    expect(importers.map((file) => file.name).sort()).toEqual(['engine.worker.ts', 'execution.ts']);
  });

  it('CRM and Workflow Lab share the current-run rule rather than each keeping one', () => {
    const crm = readFileSync(
      join(process.cwd(), 'apps', 'web', 'src', 'crm', 'currentRun.ts'),
      'utf8',
    );
    expect(crm).toContain("from '../simulator/currentRun'");
    expect(crm).not.toContain('database.device.put');
  });
});

describe('the default test fires the configured trigger, and the engine decides (WFL-004)', () => {
  const saved = async () => {
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, noShowRecovery(), direct()));
    return run;
  };
  const trace = (run: StoredRun, runId: string) =>
    run.state.execution
      .filter((row) => row.workflow_run_id === runId)
      .map((row) =>
        timelineRow(
          row,
          run.state.account.workflows['wf-no-show-recovery'] ?? null,
          run.state.account,
          run.state.clock.timezone,
        ),
      );

  const waitingReplyWorkflow = (): Workflow => ({
    ...blankWorkflow('wf-reply-wait', 'Reply wait'),
    trigger: {
      ghl_feature_id: 'GHL-WF-CUSTOMER-REPLIED',
      filters: [{ field: 'channel', operator: 'is', value: 'sms' }],
    },
    nodes: [
      {
        id: 'wait',
        type: 'wait',
        ghl_feature_id: 'GHL-WF-WAIT',
        label: null,
        config: { wait_type: 'period', days: 1 },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
  });

  it('a matching event enrols through the trigger matcher, and the record names what matched', async () => {
    const before = await saved();
    const option = triggerTestOptions(before.state.account.workflows['wf-no-show-recovery']!).find(
      (row) => row.event === 'APPOINTMENT_STATUS_CHANGED',
    )!;
    const built = buildTriggerEvent(
      option,
      { appointment_id: 'appt-maria', status: 'no_show' },
      before.state.account,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const after = ok(
      await fireTriggerEvent(before, scenario, built.event.type, built.event.payload, direct()),
    );
    const enrolled = enrolledByEvent(
      before.state.account.workflow_runs,
      after.state.account.workflow_runs,
      'wf-no-show-recovery',
    );
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]).toMatchObject({
      contact_id: 'maria',
      context: { appointment_id: 'appt-maria' },
    });
    const rows = trace(after, enrolled[0]!.id);
    expect(rows[0]?.name).toBe('Enrolled by Appointment Status');
    expect(rows[0]?.detail).toContain('appointment status: no_show');
    expect(after.state.execution.find((row) => row.kind === 'trigger')?.data).toMatchObject({
      enrolled_by: 'trigger',
      trigger_values: { appointment_status: 'no_show' },
    });
  });

  it('a cancellation does not enrol a workflow filtered to no-shows, and nothing is started by hand', async () => {
    const before = await saved();
    const option = triggerTestOptions(before.state.account.workflows['wf-no-show-recovery']!).find(
      (row) => row.event === 'APPOINTMENT_STATUS_CHANGED',
    )!;
    const built = buildTriggerEvent(
      option,
      { appointment_id: 'appt-maria', status: 'cancelled' },
      before.state.account,
    );
    if (!built.ok) throw new Error(built.missing);
    const after = ok(
      await fireTriggerEvent(before, scenario, built.event.type, built.event.payload, direct()),
    );
    // The event was real: the appointment is cancelled. The trigger simply did not match.
    expect(after.state.account.appointments['appt-maria']?.status).toBe('cancelled');
    expect(
      enrolledByEvent(
        before.state.account.workflow_runs,
        after.state.account.workflow_runs,
        'wf-no-show-recovery',
      ),
    ).toHaveLength(0);
    expect(
      Object.values(after.state.account.workflow_runs).filter(
        (row) => row.workflow_id === 'wf-no-show-recovery',
      ),
    ).toHaveLength(0);
  });

  it('starting at the first step is recorded as a direct test enrolment, never as the trigger firing', async () => {
    const before = await saved();
    const after = ok(
      await enrolTestContact(before, scenario, 'wf-no-show-recovery', 'maria', {}, direct()),
    );
    const run = Object.values(after.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-no-show-recovery',
    )!;
    expect(run.context.trigger_event_id).toBeNull();
    const rows = trace(after, run.id);
    expect(rows[0]?.name).toBe('Started at the first step (test)');
    expect(rows[0]?.detail).toContain('Appointment Status was not fired');
    expect(rows.some((row) => row.name.startsWith('Enrolled by'))).toBe(false);
    expect(after.state.execution.find((row) => row.kind === 'trigger')?.data).toMatchObject({
      enrolled_by: 'direct',
      test: true,
      trigger_values: null,
    });
  });

  it(
    'reports a trigger that matched but was blocked by re-entry separately from a filter miss',
    async () => {
      let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, waitingReplyWorkflow(), direct()));
    run = ok(
      await fireTriggerEvent(
        run,
        scenario,
        'SMS_RECEIVED',
        { contact_id: 'maria', body: 'first reply' },
        direct(),
      ),
    );
    const active = Object.values(run.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-reply-wait',
    )!;
    expect(active.status).toBe('waiting');

    const beforeLogLength = run.state.log.length;
    const after = ok(
      await fireTriggerEvent(
        run,
        scenario,
        'SMS_RECEIVED',
        { contact_id: 'maria', body: 'second reply' },
        direct(),
      ),
    );
    expect(triggerOutcomeFor(beforeLogLength, after.state, 'wf-reply-wait')).toMatchObject({
      kind: 'blocked_reentry',
      existing_run_id: active.id,
    });
      expect(
        after.state.execution.some(
          (row) => row.reason === 'duplicate_enrolment' && row.workflow_run_id === active.id,
        ),
      ).toBe(true);
    },
  );

  it('does not claim a second direct start when the re-entry rule refused it', async () => {
    let run = await startRun(scenario, database);
    run = ok(await saveWorkflow(run, scenario, waitingReplyWorkflow(), direct()));
    run = ok(await enrolTestContact(run, scenario, 'wf-reply-wait', 'maria', {}, direct()));
    const existing = Object.values(run.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-reply-wait',
    )!;
    const beforeRunIds = new Set(Object.keys(run.state.account.workflow_runs));
    const beforeLogLength = run.state.log.length;
    const after = ok(
      await enrolTestContact(run, scenario, 'wf-reply-wait', 'maria', {}, direct()),
    );
    expect(
      directStartOutcome(beforeRunIds, beforeLogLength, after.state, 'wf-reply-wait', 'maria'),
    ).toEqual({ kind: 'blocked_reentry', existing_run_id: existing.id });
    expect(
      Object.values(after.state.account.workflow_runs).filter(
        (row) => row.workflow_id === 'wf-reply-wait',
      ),
    ).toHaveLength(1);
  });

  it('a trigger the engine cannot run has no event to fire, and an event is refused until its context exists', async () => {
    const run = await saved();
    const practised: Workflow = {
      ...noShowRecovery(),
      trigger: { ghl_feature_id: 'GHL-WF-PAYMENT-RECEIVED', filters: [] },
    };
    expect(triggerTestOptions(practised)).toEqual([]);
    const options = triggerTestOptions(run.state.account.workflows['wf-no-show-recovery']!);
    // Appointment Status listens for three events; each is offered and each needs real context.
    expect(options.map((row) => row.event)).toEqual([
      'APPOINTMENT_BOOKED',
      'APPOINTMENT_RESCHEDULED',
      'APPOINTMENT_STATUS_CHANGED',
    ]);
    const change = options.find((row) => row.event === 'APPOINTMENT_STATUS_CHANGED')!;
    expect(buildTriggerEvent(change, {}, run.state.account)).toMatchObject({
      ok: false,
      missing: 'an appointment',
    });
    expect(buildTriggerEvent(options[0]!, {}, run.state.account)).toMatchObject({
      ok: false,
      missing: 'a contact',
    });
  });
});
