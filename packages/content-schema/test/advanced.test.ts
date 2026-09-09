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
  it('has nine distinct units and runnable objective practicals on the same graph', () => {
    const rows = advancedCoverage(content);
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
