import { describe, expect, it } from 'vitest';

import {
  ClientSchema,
  ExerciseSchema,
  GhlFeatureSchema,
  RubricSchema,
  SkillSchema,
  WorkflowDefinitionSchema,
} from '../src/index.ts';
import { client, exercise, rubric, skillA, workflow } from './fixtures.ts';

const feature = {
  id: 'GHL-WF-SEND-SMS',
  official_name: 'Send SMS',
  area: 'Workflows',
  feature_type: 'action',
  implementation_type: 'native_ghl',
  status: 'current',
  simulation_fidelity: 'A',
  last_verified: '2026-09-02',
  source_url:
    'https://help.gohighlevel.com/support/solutions/articles/155000002474-workflow-action-send-sms',
  known_limitations: [],
  skills: [],
  supported_configs: {},
};

describe('GhlFeatureSchema (GHL-001 … GHL-004)', () => {
  it('accepts a complete record', () => {
    expect(GhlFeatureSchema.safeParse(feature).success).toBe(true);
  });

  it.each([
    'id',
    'official_name',
    'area',
    'feature_type',
    'implementation_type',
    'status',
    'simulation_fidelity',
    'last_verified',
    'source_url',
    'known_limitations',
    'skills',
    'supported_configs',
  ])('requires %s', (field) => {
    const { [field]: _omitted, ...rest } = feature as Record<string, unknown>;
    expect(GhlFeatureSchema.safeParse(rest).success).toBe(false);
  });

  it.each([
    ['implementation_type', 'zapier'],
    ['status', 'active'],
    ['simulation_fidelity', 'D'],
  ])('rejects %s outside its enum (%s)', (field, value) => {
    expect(GhlFeatureSchema.safeParse({ ...feature, [field]: value }).success).toBe(false);
  });

  it('rejects a source_url that is not official GHL documentation', () => {
    expect(
      GhlFeatureSchema.safeParse({ ...feature, source_url: 'https://www.youtube.com/watch?v=1' })
        .success,
    ).toBe(false);
    expect(
      GhlFeatureSchema.safeParse({ ...feature, source_url: 'http://help.gohighlevel.com/x' })
        .success,
    ).toBe(false);
  });

  it('requires an approximation label for fidelity B and C', () => {
    expect(GhlFeatureSchema.safeParse({ ...feature, simulation_fidelity: 'B' }).success).toBe(
      false,
    );
    expect(
      GhlFeatureSchema.safeParse({
        ...feature,
        simulation_fidelity: 'B',
        approximation_note: 'Training approximation — simplified.',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown key (strict)', () => {
    expect(GhlFeatureSchema.safeParse({ ...feature, fidelity: 'A' }).success).toBe(false);
  });
});

describe('ClientSchema (CNT-008)', () => {
  it('requires all fifteen §38 fields plus hidden_state', () => {
    expect(ClientSchema.safeParse(client).success).toBe(true);
    const fields = [
      'id',
      'business_name',
      'industry',
      'locations',
      'team',
      'offers',
      'lead_sources',
      'current_systems',
      'metrics',
      'problems',
      'relationship_state',
      'assets',
      'hidden_facts',
      'voice',
      'history',
      'hidden_state',
    ];
    for (const field of fields) {
      const { [field]: _omitted, ...rest } = client as Record<string, unknown>;
      expect(ClientSchema.safeParse(rest).success, `${field} should be required`).toBe(false);
    }
  });

  it('keeps the §39 hidden values numeric and bounded', () => {
    const bad = { ...client, hidden_state: { ...client.hidden_state, trust: 140 } };
    expect(ClientSchema.safeParse(bad).success).toBe(false);
  });
});

describe('SkillSchema and campaign rules (CUR-001, CUR-016)', () => {
  it('rejects a territory outside the ten', () => {
    expect(SkillSchema.safeParse({ ...skillA, territory: 'MARKETING' }).success).toBe(false);
  });

  it('rejects a self-prerequisite', () => {
    expect(SkillSchema.safeParse({ ...skillA, prerequisites: [skillA.id] }).success).toBe(false);
  });
});

describe('ExerciseSchema (EXR-001 … EXR-003)', () => {
  it('accepts the fixture and rejects weights that do not sum to 100', () => {
    expect(ExerciseSchema.safeParse(exercise).success).toBe(true);
    const bad = {
      ...exercise,
      grading: {
        mode: 'deterministic',
        weights: {
          correctness: 50,
          edge_cases: 20,
          architecture: 20,
          maintainability: 5,
          explanation: 10,
        },
      },
    };
    expect(ExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('requires a scenario and deterministic outcomes for simulator families', () => {
    const { scenario: _s, ...noScenario } = exercise;
    expect(ExerciseSchema.safeParse(noScenario).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...exercise, expected_outcomes: [] }).success).toBe(false);
    expect(
      ExerciseSchema.safeParse({ ...exercise, grading: { mode: 'rubric', rubric: 'X_RUBRIC_V1' } })
        .success,
    ).toBe(false);
  });

  it('accepts all six assertion types', () => {
    const outcomes = [
      {
        id: 's',
        type: 'state',
        path: 'contacts.c1.tags',
        operator: 'contains',
        value: 'x',
        description: 'state check',
      },
      {
        id: 'e',
        type: 'event',
        event: 'sms.sent',
        count: { exactly: 1 },
        description: 'event check',
      },
      {
        id: 't',
        type: 'timing',
        event: 'sms.sent',
        relative_to: 'appointment.start',
        offset_minutes: -1440,
        description: 'timing check',
      },
      {
        id: 'a',
        type: 'architecture',
        requirement: 'trigger_exists',
        ghl_feature: 'GHL-WF-CONTACT-CREATED',
        description: 'architecture check',
      },
      {
        id: 'n',
        type: 'negative',
        event: 'sms.sent',
        where: { contact_id: 'c2' },
        description: 'negative check',
      },
      {
        id: 'q',
        type: 'sequence',
        before: 'opportunity.created',
        after: 'notification.sent',
        description: 'sequence check',
      },
    ];
    expect(ExerciseSchema.safeParse({ ...exercise, expected_outcomes: outcomes }).success).toBe(
      true,
    );
  });

  it('refuses hints on pressure tests and worked examples on REBUILD BLIND', () => {
    expect(
      ExerciseSchema.safeParse({
        ...exercise,
        mode: 'pressure',
        hints: [{ level: 'nudge', text: 'hint' }],
      }).success,
    ).toBe(false);
    const blind = {
      ...exercise,
      id: 'EX-REBUILD_BLIND-welcome',
      type: 'REBUILD_BLIND',
      hints: [{ level: 'worked_example', text: 'all of it' }],
    };
    expect(ExerciseSchema.safeParse(blind).success).toBe(false);
  });
});

describe('RubricSchema (AI-011)', () => {
  it('ties the version to the id', () => {
    expect(RubricSchema.safeParse(rubric).success).toBe(true);
    expect(RubricSchema.safeParse({ ...rubric, version: 2 }).success).toBe(false);
    expect(RubricSchema.safeParse({ ...rubric, id: 'TEST_RUBRIC', version: 1 }).success).toBe(
      false,
    );
  });
});

describe('WorkflowDefinitionSchema (SIM-016)', () => {
  it('keeps layout separate from behaviour: a moved node is the same workflow', () => {
    const moved = {
      ...workflow,
      nodes: workflow.nodes.map((n) => ({
        ...n,
        position: { x: n.position.x + 300, y: n.position.y },
      })),
    };
    const a = WorkflowDefinitionSchema.parse(workflow);
    const b = WorkflowDefinitionSchema.parse(moved);
    const behaviour = (w: typeof a) => ({
      trigger: w.trigger,
      nodes: w.nodes.map(({ position: _p, ...rest }) => rest),
      edges: w.edges,
    });
    expect(behaviour(a)).toEqual(behaviour(b));
  });

  it('rejects edges to unknown nodes and action nodes without a feature', () => {
    expect(
      WorkflowDefinitionSchema.safeParse({ ...workflow, edges: [{ from: 'n1', to: 'n9' }] })
        .success,
    ).toBe(false);
    expect(
      WorkflowDefinitionSchema.safeParse({
        ...workflow,
        nodes: [{ id: 'n1', type: 'action', position: { x: 0, y: 0 } }],
      }).success,
    ).toBe(false);
  });
});

describe('structured workflow configs (WFL-008, WFL-009)', () => {
  const at = { x: 0, y: 0 };
  const withNodes = (nodes: unknown[], settings: Record<string, unknown> = {}) => ({
    id: 'wf-shaped',
    name: 'Shaped',
    trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED', filters: [] },
    nodes,
    edges: [],
    settings: { allow_reentry: false, ...settings },
  });
  const waitNode = (config: Record<string, unknown>) => ({
    id: 'w1',
    type: 'wait',
    ghl_feature_id: 'GHL-WF-WAIT',
    config,
    position: at,
  });
  const branchNode = (config: Record<string, unknown>) => ({
    id: 'b1',
    type: 'branch',
    ghl_feature_id: 'GHL-WF-IF-ELSE',
    config,
    position: at,
  });
  const messages = (candidate: unknown) => {
    const result = WorkflowDefinitionSchema.safeParse(candidate);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it('accepts every wait type with the fields it needs', () => {
    for (const config of [
      { wait_type: 'period', days: 1 },
      { wait_type: 'period', minutes: 30 },
      { wait_type: 'date', at: '2026-09-10T09:00:00-05:00' },
      { wait_type: 'appointment', relative: 'before', hours: 24 },
      { wait_type: 'appointment' },
      { wait_type: 'reply', channel: 'sms', timeout_hours: 24 },
      {
        wait_type: 'condition',
        groups: [{ conditions: [{ field: 'contact.tags', operator: 'contains', value: 'paid' }] }],
      },
    ]) {
      expect(messages(withNodes([waitNode(config)]))).toEqual([]);
    }
  });

  it('refuses a wait with no duration, a bare local date, and an unknown wait type', () => {
    expect(messages(withNodes([waitNode({ wait_type: 'period' })]))).toEqual([
      'Node w1: A period wait needs days, hours or minutes',
    ]);
    expect(
      messages(withNodes([waitNode({ wait_type: 'date', at: '2026-09-10T09:00:00' })]))[0],
    ).toMatch(/offset/);
    expect(messages(withNodes([waitNode({ wait_type: 'business_hours' })])).length).toBeGreaterThan(
      0,
    );
  });

  it('refuses a branch called None, an operator without a value, and duplicate branch names', () => {
    const branches = (list: unknown[]) => messages(withNodes([branchNode({ branches: list })]));
    expect(
      branches([
        {
          name: 'None',
          groups: [{ conditions: [{ field: 'contact.email', operator: 'exists' }] }],
        },
      ]),
    ).toEqual(['Node b1: None is the automatic fallback branch']);
    expect(
      branches([
        {
          name: 'Hot',
          groups: [{ conditions: [{ field: 'contact.tags', operator: 'contains' }] }],
        },
      ]),
    ).toEqual(['Node b1: contains compares against a value; give one']);
    expect(
      branches([
        { name: 'Hot', groups: [{ conditions: [{ field: 'contact.email', operator: 'exists' }] }] },
        { name: 'hot', groups: [{ conditions: [{ field: 'contact.phone', operator: 'exists' }] }] },
      ]).length,
    ).toBeGreaterThan(0);
  });

  it('accepts a time window and refuses one that ends before it starts', () => {
    const tag = {
      id: 't1',
      type: 'action',
      ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
      config: { tag: 'x' },
      position: at,
    };
    expect(
      messages(
        withNodes([tag], { time_window: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } }),
      ),
    ).toEqual([]);
    expect(
      messages(withNodes([tag], { time_window: { days: [1], start: '17:00', end: '09:00' } })),
    ).toEqual(['A time window must end after it starts']);
    expect(
      messages(withNodes([tag], { time_window: { days: [8], start: '09:00', end: '17:00' } }))
        .length,
    ).toBeGreaterThan(0);
  });
});
