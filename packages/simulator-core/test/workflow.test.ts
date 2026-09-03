import { describe, expect, it } from 'vitest';

import {
  assertRunnableScenario,
  behaviouralWorkflow,
  createRun,
  initialAccount,
  processEvent,
  validateScenario,
  workflowsAreBehaviourallyEqual,
  type SimulatorError,
  type SimulatorScenario,
} from '../src/index.ts';
import { FEATURES, NOW, event, scenario } from './fixtures.ts';

/** The workflow data contract and scenario validation (SIM-016, spec §100). */

const moveNode = (base: SimulatorScenario, x: number): SimulatorScenario => {
  const workflows = (base.initial_account_state.workflows ?? []).map((workflow) => ({
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === 'n1' ? { ...node, position: { x, y: node.position.y } } : node,
    ),
  }));
  return {
    ...base,
    initial_account_state: { ...base.initial_account_state, workflows },
  };
};

describe('layout is not behaviour (SIM-016)', () => {
  it('carries the position through, because a canvas needs it', () => {
    const account = initialAccount(scenario());
    expect(account.workflows['wf-booking-confirmation']?.nodes[0]?.position).toEqual({
      x: 0,
      y: 120,
    });
  });

  it('drops every coordinate from the behavioural view', () => {
    const workflow = initialAccount(scenario()).workflows['wf-booking-confirmation'];
    const behaviour = behaviouralWorkflow(workflow as never);
    expect(JSON.stringify(behaviour)).not.toContain('position');
    expect(behaviour.nodes.map((node) => node.id)).toEqual(['n1', 'n2', 'n3']);
  });

  it('moving a node from x=100 to x=900 changes nothing about how it evaluates', () => {
    const left = initialAccount(moveNode(scenario(), 100)).workflows['wf-booking-confirmation'];
    const right = initialAccount(moveNode(scenario(), 900)).workflows['wf-booking-confirmation'];
    expect(left?.nodes[0]?.position.x).toBe(100);
    expect(right?.nodes[0]?.position.x).toBe(900);
    expect(workflowsAreBehaviourallyEqual(left as never, right as never)).toBe(true);
  });

  it('a moved node still runs the same enrolment and the same steps', () => {
    const enrol = (base: SimulatorScenario) => {
      let state = createRun(base);
      state = processEvent(
        state,
        event('WORKFLOW_ENROLLED', NOW, {
          workflow_id: 'wf-booking-confirmation',
          contact_id: 'maria',
        }),
      );
      const [id] = Object.keys(state.account.workflow_runs);
      return processEvent(
        state,
        event('WORKFLOW_STEP_COMPLETED', NOW, { workflow_run_id: id, node_id: 'n1' }),
      );
    };
    const left = enrol(moveNode(scenario(), 100));
    const right = enrol(moveNode(scenario(), 900));
    expect(left.log.map((row) => ({ type: row.type, at: row.at }))).toEqual(
      right.log.map((row) => ({ type: row.type, at: row.at })),
    );
    expect(left.execution.map((row) => row.kind)).toEqual(right.execution.map((row) => row.kind));
  });

  it('sees two workflows as different when their behaviour differs', () => {
    const changed = {
      ...scenario(),
      initial_account_state: {
        ...scenario().initial_account_state,
        workflows: (scenario().initial_account_state.workflows ?? []).map((workflow) => ({
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === 'n2' ? { ...node, config: { tag: 'different' } } : node,
          ),
        })),
      },
    };
    const before = initialAccount(scenario()).workflows['wf-booking-confirmation'];
    const after = initialAccount(changed).workflows['wf-booking-confirmation'];
    expect(workflowsAreBehaviourallyEqual(before as never, after as never)).toBe(false);
  });
});

describe('scenario validation (spec §100)', () => {
  const withState = (patch: Record<string, unknown>): SimulatorScenario => ({
    ...scenario(),
    initial_account_state: { ...scenario().initial_account_state, ...patch },
  });

  const codes = (candidate: SimulatorScenario) =>
    validateScenario(candidate, FEATURES).map((problem) => problem.code);

  it('passes the authored scenario', () => {
    expect(validateScenario(scenario(), FEATURES)).toEqual([]);
    expect(() => assertRunnableScenario(scenario(), FEATURES)).not.toThrow();
  });

  it('rejects duplicate entity ids', () => {
    const contacts = [...(scenario().initial_account_state.contacts ?? [])];
    expect(codes(withState({ contacts: [...contacts, contacts[0]] }))).toContain('DUPLICATE_ID');
  });

  it('rejects a dangling contact reference', () => {
    expect(
      codes(
        withState({
          appointments: [
            {
              id: 'a1',
              contact_id: 'ghost',
              calendar_id: 'consultation',
              starts_at: '2026-09-04T15:00:00-05:00',
            },
          ],
        }),
      ),
    ).toContain('DANGLING_REF');
  });

  it('rejects an impossible timestamp', () => {
    expect(codes({ ...scenario(), simulation_time: 'not-a-time' })).toContain('INVALID_TIME');
  });

  it('rejects an invalid timezone', () => {
    expect(codes({ ...scenario(), timezone: 'Mars/Olympus' })).toContain('INVALID_TIMEZONE');
  });

  it('rejects a scheduled event naming an entity that does not exist', () => {
    expect(
      codes({
        ...scenario(),
        scheduled_events: [
          {
            at: '2026-09-04T15:00:00-05:00',
            type: 'appointment.status_changed',
            payload: { appointment_id: 'nope', status: 'no_show' },
          },
        ],
      }),
    ).toContain('DANGLING_REF');
  });

  it('rejects an event type outside the catalogue', () => {
    expect(
      codes({
        ...scenario(),
        scheduled_events: [{ at: '2026-09-04T15:00:00-05:00', type: 'contact.deleted' }],
      }),
    ).toContain('UNKNOWN_EVENT_TYPE');
  });

  it('rejects a stage the pipeline does not have', () => {
    expect(
      codes(
        withState({
          opportunities: [
            {
              id: 'o1',
              contact_id: 'maria',
              pipeline_id: 'consultations',
              stage: 'Invented',
            },
          ],
        }),
      ),
    ).toContain('UNKNOWN_STAGE');
  });

  it('rejects duplicate node ids', () => {
    const workflows = (scenario().initial_account_state.workflows ?? []).map((workflow) => ({
      ...workflow,
      nodes: [...workflow.nodes, workflow.nodes[0] as never],
    }));
    expect(codes(withState({ workflows }))).toContain('DUPLICATE_NODE');
  });

  it('rejects a dangling workflow edge', () => {
    const workflows = (scenario().initial_account_state.workflows ?? []).map((workflow) => ({
      ...workflow,
      edges: [...(workflow.edges ?? []), { from: 'n1', to: 'n404' }],
    }));
    expect(codes(withState({ workflows }))).toContain('DANGLING_EDGE');
  });

  it('rejects a GHL feature the registry does not contain', () => {
    const workflows = (scenario().initial_account_state.workflows ?? []).map((workflow) => ({
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node.id === 'n1' ? { ...node, ghl_feature_id: 'GHL-WF-INVENTED' } : node,
      ),
    }));
    expect(codes(withState({ workflows }))).toContain('UNKNOWN_FEATURE');
  });

  it('refuses to simulate a REAL_GHL feature as if it were native', () => {
    const workflows = (scenario().initial_account_state.workflows ?? []).map((workflow) => ({
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node.id === 'n1' ? { ...node, ghl_feature_id: 'GHL-SNAP-SNAPSHOTS' } : node,
      ),
    }));
    expect(codes(withState({ workflows }))).toContain('REAL_GHL_FEATURE');
  });

  it('checks nothing about features when no registry is supplied', () => {
    const workflows = (scenario().initial_account_state.workflows ?? []).map((workflow) => ({
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node.id === 'n1' ? { ...node, ghl_feature_id: 'GHL-WF-INVENTED' } : node,
      ),
    }));
    expect(validateScenario(withState({ workflows }))).toEqual([]);
  });

  it('rejects duplicate injectable action ids', () => {
    const actions = scenario().injectable_events ?? [];
    expect(
      codes({ ...scenario(), injectable_events: [...actions, actions[0] as never] }),
    ).toContain('DUPLICATE_ID');
  });

  it('throws with every problem listed, rather than skipping the bad ones', () => {
    try {
      assertRunnableScenario({ ...scenario(), timezone: 'Mars/Olympus', seed: -1 }, FEATURES);
      throw new Error('Expected a refusal');
    } catch (caught) {
      const error = caught as SimulatorError;
      expect(error.code).toBe('INVALID_SCENARIO');
      expect((error.detail.issues as unknown[]).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('allows a form submission to name a contact that does not exist yet', () => {
    // That is what creates it; every other reference must already resolve.
    expect(
      codes({
        ...scenario(),
        injectable_events: [
          {
            id: 'new-lead',
            type: 'form.submitted',
            description: 'A new lead fills in the consultation form.',
            payload: { form_id: 'consult-request', contact_id: 'brand-new' },
          },
        ],
      }),
    ).toEqual([]);
  });
});
