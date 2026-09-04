import { stringify } from 'yaml';

import type { ContentSources } from '../src/node.ts';

/**
 * The smallest content set that compiles: one of everything, every relationship exercised.
 * Tests mutate copies of it to prove each validation rule fails the build (CNT-005).
 */

export const yaml = (value: unknown) => stringify(value);

const feature = (id: string, extra: Record<string, unknown>) => ({
  id,
  official_name: id.replace('GHL-WF-', '').replace(/-/g, ' '),
  area: 'Workflows',
  feature_type: 'action',
  implementation_type: 'native_ghl',
  status: 'current',
  simulation_fidelity: 'A',
  last_verified: '2026-09-01',
  source_url: 'https://help.gohighlevel.com/support/solutions/articles/1',
  known_limitations: [],
  skills: [],
  supported_configs: {},
  ...extra,
});

export const skillA = {
  id: 'SK-AUTOMATE-alpha',
  title: 'Alpha skill',
  territory: 'AUTOMATE',
  tier: 'field_ready',
  summary: 'The first skill in the fixture graph, with no prerequisites at all.',
  prerequisites: [],
  ghl_features: ['GHL-WF-CONTACT-CREATED'],
  mastery_requirements: {
    independent_evidence: 1,
    pressure_test: false,
    fieldwork_required: false,
  },
};

export const skillB = {
  id: 'SK-DIAGNOSE-beta',
  title: 'Beta skill',
  territory: 'DIAGNOSE',
  tier: 'field_ready',
  summary: 'The second skill in the fixture graph; it requires alpha first.',
  prerequisites: ['SK-AUTOMATE-alpha'],
  ghl_features: [],
  mastery_requirements: {
    independent_evidence: 1,
    pressure_test: false,
    fieldwork_required: false,
  },
};

export const client = {
  id: 'CL-acme',
  business_name: 'Acme Studio',
  industry: 'photographer',
  locations: [{ name: 'Studio', city: 'Austin', timezone: 'America/Chicago' }],
  team: [{ name: 'Sam', role: 'Owner' }],
  offers: [{ name: 'Session', price: 300, billing: 'one_time' }],
  lead_sources: ['Instagram'],
  current_systems: ['Gmail'],
  metrics: { monthly_leads: 20 },
  problems: ['Slow replies'],
  relationship_state: { stage: 'prospect', since: '2026-08-01' },
  assets: [],
  hidden_facts: { budget_note: 'flexible' },
  voice: {
    character: 'VC-calm',
    tone: 'Calm',
    speaking_style: 'Direct',
    sample_phrases: ['Sure.'],
  },
  history: [],
  hidden_state: {
    trust: 50,
    urgency: 50,
    price_sensitivity: 50,
    frustration: 10,
    technical_sophistication: 40,
    fear: 10,
    previous_bad_experience: 0,
    alternative_provider_strength: 20,
    actual_budget: 2000,
    stated_budget: 1500,
    decision_authority: 'sole',
  },
};

export const workflow = {
  id: 'wf-welcome',
  name: 'Welcome',
  trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED', filters: [] },
  nodes: [
    {
      id: 'n1',
      type: 'action',
      ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
      config: { tag: 'welcome' },
      position: { x: 0, y: 0 },
    },
    { id: 'n2', type: 'end', position: { x: 0, y: 100 } },
  ],
  edges: [{ from: 'n1', to: 'n2' }],
};

export const scenario = {
  id: 'SC-acme-welcome',
  title: 'Acme welcome',
  client: 'CL-acme',
  summary: 'A single contact and a single welcome workflow to run them through.',
  initial_account_state: {
    contacts: [{ id: 'c1', first_name: 'Ada', phone: '+15550000001' }],
    workflows: [workflow],
  },
  simulation_time: '2026-09-01T09:00:00-05:00',
  timezone: 'America/Chicago',
  seed: 1,
};

export const exercise = {
  id: 'EX-BUILD_IT-welcome',
  type: 'BUILD_IT',
  title: 'Build the welcome',
  mode: 'guided',
  difficulty: 1,
  estimated_minutes: 10,
  skills: ['SK-AUTOMATE-alpha'],
  scenario: 'SC-acme-welcome',
  instructions: 'Build a welcome workflow.',
  allowed_features: ['GHL-WF-CONTACT-CREATED', 'GHL-WF-ADD-CONTACT-TAG'],
  expected_outcomes: [
    {
      id: 'a1',
      type: 'event',
      event: 'sms.sent',
      count: { exactly: 1 },
      description: 'One message is sent.',
    },
  ],
  grading: { mode: 'deterministic' },
  portfolio: 'PF-welcome',
};

export const campaign = {
  id: 'CAMP-TEST',
  title: 'Test campaign',
  pace_hint: 'Suggested pace: a day',
  summary: 'Two gates that walk the fixture graph in prerequisite order.',
  gates: [
    {
      id: 'GATE-1',
      number: 1,
      name: 'First gate',
      summary: 'Alpha first.',
      skills: ['SK-AUTOMATE-alpha'],
      pass_criteria: {},
    },
    {
      id: 'GATE-2',
      number: 2,
      name: 'Second gate',
      summary: 'Beta second.',
      skills: ['SK-DIAGNOSE-beta'],
      pass_criteria: {},
      projects: ['PRJ-welcome'],
    },
  ],
};

export const rubric = {
  id: 'TEST_RUBRIC_V1',
  version: 1,
  title: 'Test rubric',
  applies_to: ['EXPLAIN_IT'],
  model_class: 'cheap',
  output_schema: 'ai_grading_v1',
  items: [{ id: 'r1', tier: 'required', criterion: 'Says something true about the system.' }],
};

export const project = {
  id: 'PRJ-welcome',
  title: 'Welcome project',
  tier: 'field_ready',
  brief: 'Build and explain the welcome.',
  client: 'CL-acme',
  skills: ['SK-AUTOMATE-alpha'],
  stages: [
    { id: 's1', name: 'Build', exercises: ['EX-BUILD_IT-welcome'], deliverable: 'A workflow.' },
  ],
  fieldwork_required: false,
  portfolio: 'PF-welcome',
};

export const portfolio = {
  id: 'PF-welcome',
  project: 'PRJ-welcome',
  label: 'Simulation Project',
  title: 'Welcome build',
  progression_number: 1,
  artifacts: [
    { kind: 'brief', required: true, description: 'The brief.' },
    { kind: 'business_problem', required: true, description: 'The problem.' },
    { kind: 'architecture', required: true, description: 'The design.' },
    { kind: 'learner_reasoning', required: true, description: 'Why it was built this way.' },
  ],
};

export const unitMdx = `---
id: LU-welcome
title: The welcome unit
territory: AUTOMATE
tier: field_ready
skills:
  - SK-AUTOMATE-alpha
estimated_minutes: 5
summary: A short unit that embeds the welcome exercise and one feature card.
---

## Why welcome messages

Because speed matters.

<Feature id="GHL-WF-ADD-CONTACT-TAG" />

<Depth title="More">
  Extra depth.
</Depth>

<Exercise id="EX-BUILD_IT-welcome" />
`;

export function baseSources(): ContentSources {
  return {
    files: {
      'content.yaml': yaml({ content_version: '2026.09.01', schema_version: 1 }),
      'skills/SK-AUTOMATE-alpha.yaml': yaml(skillA),
      'skills/SK-DIAGNOSE-beta.yaml': yaml(skillB),
      'ghl-features/GHL-WF-CONTACT-CREATED.yaml': yaml(
        feature('GHL-WF-CONTACT-CREATED', {
          feature_type: 'trigger',
          skills: ['SK-AUTOMATE-alpha'],
        }),
      ),
      'ghl-features/GHL-WF-ADD-CONTACT-TAG.yaml': yaml(feature('GHL-WF-ADD-CONTACT-TAG', {})),
      'ghl-features/GHL-SNAP-REAL.yaml': yaml(
        feature('GHL-SNAP-REAL', {
          area: 'Snapshots',
          feature_type: 'product',
          simulation_fidelity: 'REAL_GHL',
          known_limitations: ['Not simulated.'],
        }),
      ),
      'clients/CL-acme.yaml': yaml(client),
      'scenarios/SC-acme-welcome.yaml': yaml(scenario),
      'exercises/EX-BUILD_IT-welcome.yaml': yaml(exercise),
      'campaigns/CAMP-TEST.yaml': yaml(campaign),
      'learning-units/LU-welcome.mdx': unitMdx,
      'rubrics/TEST_RUBRIC_V1.yaml': yaml(rubric),
      'projects/PRJ-welcome.yaml': yaml(project),
      'portfolio/PF-welcome.yaml': yaml(portfolio),
      'glossary/GL-welcome.yaml': yaml({
        id: 'GL-welcome',
        term: 'Welcome message',
        definition: 'The first message a new lead receives.',
        related_skills: ['SK-AUTOMATE-alpha'],
      }),
    },
  };
}

/** A copy of the base sources with one file replaced or removed (`null`). */
export function withFile(
  path: string,
  content: string | null,
  sources = baseSources(),
): ContentSources {
  const files = { ...sources.files };
  if (content === null) delete files[path];
  else files[path] = content;
  return { files };
}
