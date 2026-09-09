import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileContentDir } from '../src/node.ts';
import { advancedCoverage, validateAdvanced } from '../src/compile/advanced.ts';
import { ADVANCED_TOPICS } from '../src/schemas/advanced.ts';
import { ExerciseSchema } from '../src/schemas/exercise.ts';
import { IssueList, type ParsedContent } from '../src/compile/validate.ts';

let content: ParsedContent;
beforeAll(async () => {
  content = {
    ...(await compileContentDir(fileURLToPath(new URL('../../../content', import.meta.url)))),
    paths: {},
  };
});
describe('CUR-023 content-derived coverage', () => {
  it('represents every supporting specialty with tiered graph, instruction, practical and current registry evidence', () => {
    const topics = [
      'reputation',
      'reviews',
      'social_planner',
      'courses',
      'memberships',
      'communities',
      'client_portal',
      'affiliates',
      'ecommerce',
      'blogs',
      'seo',
      'ivr_phone',
      'prospecting',
      'ad_reporting',
      'rentals',
      'services',
      'resources',
      'contracts',
      'estimates',
      'invoices',
      'payment_links',
      'subscriptions',
      'advanced_reporting',
    ];
    const rows = advancedCoverage(content).filter((row) => row.topic.startsWith('specialty.'));
    expect(rows.map((row) => row.topic).sort()).toEqual(
      topics.map((topic) => `specialty.${topic}`).sort(),
    );
    const fieldReady = new Set(
      content.campaigns
        .find((campaign) => campaign.id === 'CAMP-FIELD_READY')!
        .gates.flatMap((gate) => gate.skills),
    );
    for (const row of rows) {
      expect(row.units.length, row.topic).toBeGreaterThan(0);
      expect(row.exercises.length, row.topic).toBeGreaterThan(0);
      const unit = content.learning_units.find((unit) => unit.id === row.units[0])!;
      expect(unit.word_count).toBeGreaterThan(200);
      for (const id of unit.skills) {
        const skill = content.skills.find((skill) => skill.id === id)!;
        expect(skill.tier).not.toBe('field_ready');
        expect(fieldReady.has(id)).toBe(false);
        expect(skill.ghl_features.length).toBeGreaterThan(0);
      }
    }
  });
  it('requires deterministic-first prerequisites for every AI unit and rejects removing that boundary', () => {
    const rows = advancedCoverage(content).filter((row) => row.topic.startsWith('ai.'));
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(row.units.length, row.topic).toBeGreaterThan(0);
      expect(row.exercises.length, row.topic).toBeGreaterThan(0);
      expect(
        content.learning_units.find((unit) => unit.id === row.units[0])!.word_count,
      ).toBeGreaterThan(200);
    }
    const broken = structuredClone(content);
    broken.skills.find((skill) => skill.id === 'SK-JUDGMENT-ai-boundaries')!.prerequisites = [];
    const issues = new IssueList();
    validateAdvanced(broken, ADVANCED_TOPICS, issues);
    expect(issues.errors.some((issue) => issue.code === 'ADVANCED_AI_ORDER')).toBe(true);
    expect(
      content.ghl_features.find((feature) => feature.id === 'GHL-AI-MANAGED')!.official_name,
    ).toBe('Managed Agents');
    expect(
      content.ghl_features.find((feature) => feature.id === 'GHL-AI-MCP')!.simulation_fidelity,
    ).toBe('C');
  });
  it('covers SCALE and retention with four explicit vertical demonstrations and preserved fieldwork', () => {
    const rows = advancedCoverage(content).filter(
      (row) => row.topic.startsWith('scale.') || row.topic.startsWith('retention.'),
    );
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.units).toHaveLength(1);
      expect(row.exercises).toHaveLength(1);
      expect(
        content.learning_units.find((unit) => unit.id === row.units[0])!.word_count,
      ).toBeGreaterThan(200);
    }
    for (const title of [
      'Bloomwired Med Spa Core',
      'Coach Lead Path',
      'Home Services Follow-Up',
      'Photographer Inquiry System',
    ])
      expect(
        content.learning_units.some(
          (unit) =>
            unit.title === title &&
            unit.advanced_topics.some((topic) => topic.startsWith('scale.vertical_')),
        ),
      ).toBe(true);
    expect(
      content.skills.find((skill) => skill.id === 'SK-SCALE-snapshot-portability')!
        .mastery_requirements.fieldwork_required,
    ).toBe(true);
    expect(content.skills.find((skill) => skill.id === 'SK-SCALE-agency-specialist')!.tier).toBe(
      'specialist',
    );
    expect(
      content.campaigns
        .find((campaign) => campaign.id === 'CAMP-FIELD_READY')!
        .gates.flatMap((gate) => gate.skills),
    ).not.toContain('SK-SCALE-agency-specialist');
  });
  it('covers every enabled advanced Lab with instruction and an account-backed practical', () => {
    for (const row of advancedCoverage(content).filter((row) => row.topic.startsWith('labs.'))) {
      expect(row.units.length, row.topic).toBeGreaterThan(0);
      expect(row.exercises.length, row.topic).toBeGreaterThan(0);
      const unit = content.learning_units.find((unit) => unit.id === row.units[0])!;
      const exercise = content.exercises.find((exercise) => exercise.id === row.exercises[0])!;
      expect(unit.word_count).toBeGreaterThan(200);
      expect(exercise.scenario).toBeTruthy();
      expect(exercise.expected_outcomes.some((check) => check.type === 'event')).toBe(true);
      expect(exercise.expected_outcomes.some((check) => check.type === 'state')).toBe(true);
    }
  });
  it('has nine distinct units and runnable objective practicals on the same graph', () => {
    const rows = advancedCoverage(content).filter((row) => row.topic.startsWith('connect.'));
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.units).toHaveLength(1);
      expect(row.exercises).toHaveLength(1);
      const exercise = content.exercises.find((item) => item.id === row.exercises[0])!;
      expect(exercise.fixture_checks.length).toBeGreaterThanOrEqual(2);
      const unit = content.learning_units.find((item) => item.id === row.units[0])!;
      expect(unit.word_count).toBeGreaterThan(200);
      expect(unit.embeds.some((embed) => embed.attributes.id === exercise.id)).toBe(true);
    }
  });
  it('fails missing learn/practical citations, unmatched skills and stale registry references', () => {
    for (const kind of ['unit', 'exercise', 'skill', 'feature']) {
      const broken = structuredClone(content);
      if (kind === 'unit')
        broken.learning_units = broken.learning_units.filter(
          (unit) => !unit.advanced_topics.includes('connect.dns'),
        );
      if (kind === 'exercise')
        broken.exercises = broken.exercises.filter(
          (exercise) => !exercise.advanced_topics.includes('connect.json'),
        );
      if (kind === 'skill')
        broken.exercises.find((exercise) =>
          exercise.advanced_topics.includes('connect.dns'),
        )!.skills = ['SK-CONNECT-http'];
      if (kind === 'feature')
        broken.ghl_features.find((feature) => feature.id === 'GHL-API-VERSIONING')!.status =
          'needs_review';
      const issues = new IssueList();
      validateAdvanced(broken, ADVANCED_TOPICS, issues);
      expect(issues.errors.length, kind).toBeGreaterThan(0);
    }
  });
  it('refuses malformed, unbound or ungraded fixture contracts at authoring time', () => {
    const source = content.exercises.find((exercise) =>
      exercise.advanced_topics.includes('connect.json'),
    )!;
    for (const mutation of ['json', 'field', 'assertion', 'path']) {
      const exercise = structuredClone(source);
      if (mutation === 'json') exercise.fixture_checks[0]!.expected_json = '{';
      if (mutation === 'field') exercise.fixture_checks[0]!.field = 'missing';
      if (mutation === 'assertion') exercise.expected_outcomes = [];
      if (mutation === 'path')
        exercise.expected_outcomes[0] = {
          id: 'bad',
          description: 'Unknown fixture is rejected',
          type: 'state',
          path: 'fixture.unknown',
          operator: 'equals',
          value: true,
        };
      expect(ExerciseSchema.safeParse(exercise).success, mutation).toBe(false);
    }
  });
});
