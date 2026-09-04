import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_ENROLMENTS_AT_ONE_INSTANT,
  bookableSlots,
  contentEventName,
  validateCalendar,
  validateScenario,
  type Calendar,
  type ExecutionRecord,
  type SimulatorScenario,
  type SimulatorState,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { BloomlabDatabase } from '../data/db';
import { startRun, type StoredRun } from '../simulator/store';
import { incidentCase, incidentCases, reproduce } from './incidents';

/**
 * SIM-011 regression fixtures: all nine failures, reproduced through the engine.
 *
 * Every one of these is real simulator behaviour rather than a card with a label on it. Each
 * fixture runs the incident's own scenario, then asserts on the evidence a learner would read —
 * the skipped action and its reason, the response status, the branch comparison, the run that
 * ended failed. A fixture fails if that evidence stops being visible, which is exactly what
 * "observable symptoms shown before fixes" has to mean if it is to mean anything.
 *
 * Ids follow the simulator's own regression convention — one topic, three digits — so a failure
 * here reads the same way as a failure in `packages/simulator-core/test/regression.test.ts`.
 * `INCIDENT_FIXTURES` below is the register, and a test keeps it in step with the content: an
 * incident scenario with no fixture, or a fixture with no scenario, fails.
 */

/** One pinned failure: its id, the scenario that stages it, and what the fixture proves. */
export const INCIDENT_FIXTURES: readonly {
  id: string;
  scenario: string;
  failure_mode: string;
  pins: string;
}[] = [
  {
    id: 'PHONE-001',
    scenario: 'SC-glowhaus-incident-missing-phone',
    failure_mode: 'missing_phone',
    pins: 'The send is skipped for a missing number, and the reason is on the step.',
  },
  {
    id: 'DND-001',
    scenario: 'SC-glowhaus-incident-dnd',
    failure_mode: 'dnd',
    pins: 'The send is skipped for do-not-disturb, on a contact who does have a number.',
  },
  {
    id: 'WEBAUTH-001',
    scenario: 'SC-glowhaus-incident-webhook-auth',
    failure_mode: 'invalid_webhook_auth',
    pins: 'The endpoint refuses the credential the workflow sent, and the status says so.',
  },
  {
    id: 'FIELD-001',
    scenario: 'SC-glowhaus-incident-missing-field',
    failure_mode: 'missing_field',
    pins: 'A correct branch on a field nobody filled in takes its fallback path.',
  },
  {
    id: 'SLOTS-001',
    scenario: 'SC-glowhaus-incident-no-slots',
    failure_mode: 'unavailable_appointment',
    pins: 'The shared availability engine offers nothing at all.',
  },
  {
    id: 'REENTRY-001',
    scenario: 'SC-glowhaus-incident-duplicate-enrolment',
    failure_mode: 'duplicate_enrollment',
    pins: 'The second enrolment is refused, and the second enquiry gets nothing.',
  },
  {
    id: 'CONDITION-001',
    scenario: 'SC-glowhaus-incident-bad-condition',
    failure_mode: 'bad_condition',
    pins: 'A valid condition compares against a value the account no longer uses.',
  },
  {
    id: 'LOOP-001',
    scenario: 'SC-glowhaus-incident-workflow-loop',
    failure_mode: 'workflow_loop',
    pins: 'Two workflows re-trigger each other and the engine stops one, bounded and visible.',
  },
  {
    id: 'INTEGRATION-001',
    scenario: 'SC-glowhaus-incident-integration',
    failure_mode: 'integration_failure',
    pins: 'The endpoint accepts the credential and is failing anyway.',
  },
];

let database: BloomlabDatabase;

const options = () => ({ database, createWorker: null });

const scenarioOf = (id: string): SimulatorScenario => {
  const found = (content.scenarios as unknown as SimulatorScenario[]).find((row) => row.id === id);
  if (!found) throw new Error(`${id} is not in the content bundle`);
  return found;
};

/** Opens the incident's run and reproduces it, the way the surface does. */
async function staged(scenarioId: string): Promise<StoredRun> {
  const scenario = scenarioOf(scenarioId);
  const run = await startRun(scenario, database);
  const result = await reproduce(run, scenario, options());
  if (!result) return run;
  if (!result.ok) throw new Error(`${scenarioId} was refused: ${result.refusal.message}`);
  return result.run;
}

const records = (state: SimulatorState, kind: ExecutionRecord['kind']): ExecutionRecord[] =>
  state.execution.filter((row) => row.kind === kind);

const logged = (state: SimulatorState, type: string) =>
  state.log.filter((event) => contentEventName(event.type) === type);

beforeEach(() => {
  database = new BloomlabDatabase(`incident-${Math.random().toString(36).slice(2)}`);
});

describe('every incident scenario is authored well enough to run', () => {
  it('registers one fixture per incident, by a stable id', () => {
    const ids = INCIDENT_FIXTURES.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z]+-\d{3}$/);
    // The register and the content cannot drift: every scenario has a fixture, every fixture a
    // scenario, and each pair agrees about which failure is being staged.
    const cases = new Map(incidentCases().map((row) => [row.scenario_id, row]));
    expect(INCIDENT_FIXTURES.map((row) => row.scenario).sort()).toEqual([...cases.keys()].sort());
    for (const fixture of INCIDENT_FIXTURES) {
      expect({ id: fixture.id, mode: cases.get(fixture.scenario)?.incident.failure_mode }).toEqual({
        id: fixture.id,
        mode: fixture.failure_mode,
      });
      expect(fixture.pins.length).toBeGreaterThan(20);
    }
  });

  it('stages all nine of the failures SIM-011 names', () => {
    const modes = incidentCases().map((row) => row.incident.failure_mode);
    expect(new Set(modes).size).toBe(modes.length);
    expect(modes.sort()).toEqual(
      [
        'bad_condition',
        'dnd',
        'duplicate_enrollment',
        'integration_failure',
        'invalid_webhook_auth',
        'missing_field',
        'missing_phone',
        'unavailable_appointment',
        'workflow_loop',
      ].sort(),
    );
  });

  it('compiles every one of them', () => {
    for (const row of incidentCases()) {
      expect({ id: row.scenario_id, issues: validateScenario(row.scenario) }).toEqual({
        id: row.scenario_id,
        issues: [],
      });
    }
  });

  it('gives every one a symptom, a complaint and somewhere to look', () => {
    for (const row of incidentCases()) {
      expect(row.incident.symptom.length).toBeGreaterThan(40);
      expect(row.incident.client_complaint.length).toBeGreaterThan(40);
      expect(row.incident.inspect.length).toBeGreaterThan(0);
    }
  });

  /**
   * The answer-leak check (§71). An incident is allowed to say what is observably wrong and what
   * the client said. It is not allowed to say what the fault is or how to fix it, because the
   * whole surface renders this block verbatim.
   */
  it('never names the fault in the case facts', () => {
    const giveaways = [
      'the problem is',
      'the cause is',
      'is caused by',
      'the reason is',
      'the fix is',
      'to fix this',
      'you need to',
      'the answer is',
      'should be set to',
    ];
    for (const row of incidentCases()) {
      const text = [
        row.incident.title,
        row.incident.symptom,
        row.incident.client_complaint,
        ...row.incident.inspect,
        ...row.incident.reproduce,
      ]
        .join(' ')
        .toLowerCase();
      for (const phrase of giveaways) {
        expect({ scenario: row.scenario_id, phrase, found: text.includes(phrase) }).toEqual({
          scenario: row.scenario_id,
          phrase,
          found: false,
        });
      }
    }
  });
});

describe('PHONE-001 · the welcome text nobody got', () => {
  it('reaches Send SMS and records the skip with its reason', async () => {
    const run = await staged('SC-glowhaus-incident-missing-phone');
    const state = run.state;
    // The lead exists and the workflow ran: this is not a trigger that failed to fire.
    expect(state.account.contacts.rosa).toBeDefined();
    expect(state.account.contacts.rosa?.phone).toBeNull();
    expect(Object.values(state.account.workflow_runs)).toHaveLength(1);
    expect(logged(state, 'sms.sent')).toHaveLength(1);
    // And no message reached anybody.
    expect(state.account.conversations.rosa).toBeUndefined();
    expect(state.account.analytics.messages_sent).toBe(0);
    const skipped = records(state, 'action_skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toBe('missing_phone');
    expect(skipped[0]?.node_id).toBe('n2');
    // The symptom is visible without anything being revealed.
    expect(incidentCase('SC-glowhaus-incident-missing-phone')?.incident.failure_mode).toBe(
      'missing_phone',
    );
  });

  it('sends the text once the lead has a number', async () => {
    const run = await staged('SC-glowhaus-incident-missing-phone');
    const scenario = scenarioOf('SC-glowhaus-incident-missing-phone');
    const { execute } = await import('../workflow/execution');
    const after = await execute(
      run,
      scenario,
      { kind: 'inject_action', action_id: 'second-lead' },
      options(),
    );
    if (!after.ok) throw new Error(after.refusal.message);
    expect(after.run.state.account.conversations['test-lead']?.messages).toHaveLength(1);
  });
});

describe('DND-001 · a number that works and a text that does not', () => {
  it('skips for do-not-disturb, on a contact who has a number', async () => {
    const run = await staged('SC-glowhaus-incident-dnd');
    const state = run.state;
    expect(state.account.contacts.marisol?.phone).toBe('+15125550144');
    expect(state.account.contacts.marisol?.dnd).toBe(true);
    expect(logged(state, 'sms.sent')).toHaveLength(1);
    expect(state.account.conversations.marisol).toBeUndefined();
    const skipped = records(state, 'action_skipped');
    expect(skipped).toHaveLength(1);
    // The two incidents look identical from outside and differ exactly here.
    expect(skipped[0]?.reason).toBe('dnd');
    expect(skipped[0]?.reason).not.toBe('missing_phone');
  });
});

describe('WEBAUTH-001 · the booking sync that stopped syncing', () => {
  it('records the refused credential as a failure with its status', async () => {
    const run = await staged('SC-glowhaus-incident-webhook-auth');
    const state = run.state;
    const responses = logged(state, 'webhook.response');
    expect(responses).toHaveLength(1);
    expect(responses[0]?.payload.status).toBe(401);
    expect(responses[0]?.payload.failure_kind).toBe('auth');
    const failures = records(state, 'failure');
    expect(failures.map((row) => row.reason)).toContain('webhook_auth');
    const failure = failures.find((row) => row.reason === 'webhook_auth');
    expect(failure?.data.status).toBe(401);
    expect(failure?.data.endpoint).toBe('https://rota.glowhaus.example/hooks/bookings');
    // No token value is ever written into the log; only which headers were sent.
    const step = state.execution.find((row) => Array.isArray(row.data.header_names));
    expect(step?.data.header_names).toEqual(['authorization']);
    expect(JSON.stringify(state.execution)).not.toContain('rota_live_4a71');
  });

  it('succeeds once the workflow sends the token the endpoint expects', async () => {
    const run = await staged('SC-glowhaus-incident-webhook-auth');
    const scenario = scenarioOf('SC-glowhaus-incident-webhook-auth');
    const workflow = run.state.account.workflows['wf-rota-sync'];
    if (!workflow) throw new Error('The workflow is missing');
    const { execute } = await import('../workflow/execution');
    const fixed = {
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node.id === 'n1'
          ? {
              ...node,
              config: { ...node.config, headers: { Authorization: 'Bearer rota_live_9f2c' } },
            }
          : node,
      ),
    };
    const { version: _version, ...definition } = fixed;
    const saved = await execute(
      run,
      scenario,
      {
        kind: 'process',
        event: {
          type: 'WORKFLOW_UPDATED',
          at: run.state.clock.now,
          origin: 'injected',
          payload: { workflow_id: workflow.id, workflow: definition },
        },
      },
      options(),
    );
    if (!saved.ok) throw new Error(saved.refusal.message);
    const again = await execute(
      saved.run,
      scenario,
      { kind: 'inject_action', action_id: 'another-booking' },
      options(),
    );
    if (!again.ok) throw new Error(again.refusal.message);
    const responses = again.run.state.log.filter(
      (event) => contentEventName(event.type) === 'webhook.response',
    );
    expect(responses.at(-1)?.payload.status).toBe(200);
    expect(responses.at(-1)?.payload.failure_kind).toBeUndefined();
  });
});

describe('INTEGRATION-001 · nothing wrong with the workflow', () => {
  it('is a failing service rather than a refused credential', async () => {
    const run = await staged('SC-glowhaus-incident-integration');
    const state = run.state;
    const responses = logged(state, 'webhook.response');
    expect(responses).toHaveLength(1);
    expect(responses[0]?.payload.status).toBe(503);
    expect(responses[0]?.payload.failure_kind).toBe('unavailable');
    const failure = records(state, 'failure').find((row) => row.data.endpoint);
    expect(failure?.reason).toBe('webhook_unavailable');
    // The two webhook incidents are told apart by the reason, not by the fact of failing.
    expect(failure?.reason).not.toBe('webhook_auth');
  });

  it('keeps failing however many times the booking is retried', async () => {
    const run = await staged('SC-glowhaus-incident-integration');
    const scenario = scenarioOf('SC-glowhaus-incident-integration');
    const { execute } = await import('../workflow/execution');
    const again = await execute(
      run,
      scenario,
      { kind: 'inject_action', action_id: 'retry-booking' },
      options(),
    );
    if (!again.ok) throw new Error(again.refusal.message);
    const responses = again.run.state.log.filter(
      (event) => contentEventName(event.type) === 'webhook.response',
    );
    expect(responses).toHaveLength(2);
    expect(responses.every((event) => event.payload.status === 503)).toBe(true);
  });
});

describe('FIELD-001 · everyone gets the same email', () => {
  it('takes the fallback for the lead whose field was never filled in', async () => {
    const run = await staged('SC-glowhaus-incident-missing-field');
    const state = run.state;
    expect(state.account.contacts.yusuf?.custom_fields.treatment_interest).toBeUndefined();
    expect(state.account.contacts.petra?.custom_fields.treatment_interest).toBe('Laser');
    const branches = records(state, 'branch_result');
    expect(branches).toHaveLength(2);
    const forYusuf = branches.find((row) => row.contact_id === 'yusuf');
    const forPetra = branches.find((row) => row.contact_id === 'petra');
    expect(forYusuf?.data.chosen).toBe('None');
    expect(forYusuf?.data.fallback).toBe(true);
    expect(forPetra?.data.chosen).toBe('laser');
    // The comparison is in the record: what it wanted, and what the contact had.
    const groups = (forYusuf?.data.branches as { name: string; groups: unknown[] }[])[0];
    expect(JSON.stringify(groups)).toContain('Laser');
    // Two leads about laser, two different emails.
    const emails = logged(state, 'email.sent');
    expect(emails).toHaveLength(2);
    expect(emails.map((event) => event.payload.subject).sort()).toEqual([
      'Thanks for getting in touch',
      'Your laser consultation',
    ]);
  });
});

describe('CONDITION-001 · members keep being asked to join', () => {
  it('runs a valid condition against a value the account never uses', async () => {
    const run = await staged('SC-glowhaus-incident-bad-condition');
    const state = run.state;
    expect(state.account.contacts.soraya?.tags).toContain('membership');
    const branches = records(state, 'branch_result');
    expect(branches).toHaveLength(2);
    const forSoraya = branches.find((row) => row.contact_id === 'soraya');
    // The parser did not fall over: it evaluated, and it evaluated to false.
    expect(forSoraya?.data.chosen).toBe('None');
    const evaluated = JSON.stringify(forSoraya?.data.branches);
    expect(evaluated).toContain('"expected":"subscriber"');
    expect(evaluated).toContain('membership');
    // A member and a non-member both got the join-us email.
    const emails = logged(state, 'email.sent');
    expect(emails).toHaveLength(2);
    expect(
      emails.every(
        (event) => event.payload.subject === 'Have you thought about the Glow Membership?',
      ),
    ).toBe(true);
  });
});

describe('SLOTS-001 · a booking page with no times on it', () => {
  it('offers a visitor nothing, from the one availability engine', async () => {
    const run = await staged('SC-glowhaus-incident-no-slots');
    const state = run.state;
    const slots = bookableSlots(state.account, 'consultation', state.clock.now);
    expect(slots).toEqual([]);
    // Everything a learner checks first is right. The team is not.
    const calendar = state.account.calendars.consultation;
    expect(calendar?.availability).toHaveLength(5);
    expect(calendar?.duration_minutes).toBe(30);
    expect(calendar?.slot_interval_minutes).toBe(30);
    expect(calendar?.minimum_notice_minutes).toBe(60);
    expect(calendar?.type).toBe('round_robin');
    expect(calendar?.staff_ids).toEqual([]);
    // The definition itself reports the problem, in the same words the Calendar Lab shows.
    expect(validateCalendar(calendar as Calendar, state.account).length).toBeGreaterThan(0);
  });

  it('offers times again once somebody is back on the calendar', async () => {
    const run = await staged('SC-glowhaus-incident-no-slots');
    const calendar = run.state.account.calendars.consultation;
    if (!calendar) throw new Error('The calendar is missing');
    const repaired = {
      ...run.state.account,
      calendars: {
        ...run.state.account.calendars,
        consultation: { ...calendar, staff_ids: ['priya'] },
      },
    };
    expect(bookableSlots(repaired, 'consultation', run.state.clock.now).length).toBeGreaterThan(0);
  });
});

describe('REENTRY-001 · asked twice, answered once', () => {
  it('refuses the second enrolment and says why', async () => {
    const run = await staged('SC-glowhaus-incident-duplicate-enrolment');
    const state = run.state;
    expect(logged(state, 'form.submitted')).toHaveLength(2);
    // One run, from the first submission; the second produced none.
    const runs = Object.values(state.account.workflow_runs);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('waiting');
    const refusal = records(state, 'exit').find((row) => row.reason === 'duplicate_enrolment');
    expect(refusal).toBeDefined();
    expect(refusal?.data.allow_reentry).toBe(false);
    expect(refusal?.data.existing_run_id).toBe(runs[0]?.id);
    // She asked twice and was texted once.
    expect(state.account.conversations.iona?.messages).toHaveLength(1);
  });
});

describe('LOOP-001 · two workflows passing the same lead back and forth', () => {
  it('stops the loop at an enrolment and leaves the account standing', async () => {
    const run = await staged('SC-glowhaus-incident-workflow-loop');
    const state = run.state;
    // The engine's last-resort cascade limit was not what caught this: no diagnostic was
    // recorded, so the operation completed rather than being abandoned.
    expect(state.diagnostics).toEqual([]);
    const failures = records(state, 'failure').filter((row) => row.reason === 'workflow_loop');
    expect(failures.length).toBeGreaterThan(0);
    const failure = failures[0] as ExecutionRecord;
    expect(failure.data.limit).toBe(MAX_ENROLMENTS_AT_ONE_INSTANT);
    expect(failure.data.enrolments_at_this_instant).toBe(MAX_ENROLMENTS_AT_ONE_INSTANT);
    expect(failure.contact_id).toBe('linus');
    expect(typeof failure.workflow_id).toBe('string');

    // Bounded: the runs it did create all sit at one instant, and there are not hundreds.
    const runs = Object.values(state.account.workflow_runs);
    expect(runs.length).toBeLessThanOrEqual(MAX_ENROLMENTS_AT_ONE_INSTANT * 2 + 1);
    expect(new Set(runs.map((row) => row.enrolled_at)).size).toBeLessThanOrEqual(2);

    // Unrelated account state survives: the contact is there, with a tag, and the run that
    // brought them in completed normally.
    expect(state.account.contacts.linus?.first_name).toBe('Linus');
    const intake = runs.filter((row) => row.workflow_id === 'wf-intake');
    expect(intake).toHaveLength(1);
    expect(intake[0]?.status).toBe('completed');
  });

  it('replays to the same failure', async () => {
    const first = await staged('SC-glowhaus-incident-workflow-loop');
    const second = await staged('SC-glowhaus-incident-workflow-loop');
    const reasons = (state: SimulatorState) =>
      records(state, 'failure').map((row) => `${row.workflow_id}:${row.reason}`);
    expect(reasons(second.state)).toEqual(reasons(first.state));
    expect(Object.keys(second.state.account.workflow_runs).sort()).toEqual(
      Object.keys(first.state.account.workflow_runs).sort(),
    );
  });
});
