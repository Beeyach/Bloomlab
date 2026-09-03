import { describe, expect, it } from 'vitest';

import type { IssueCode } from '../src/bundle.ts';
import { ContentBuildError, compileSources } from '../src/node.ts';
import { type baseSources, exercise, withFile, yaml } from './fixtures.ts';

async function errorsOf(sources: ReturnType<typeof baseSources>): Promise<IssueCode[]> {
  try {
    await compileSources(sources);
  } catch (error) {
    if (error instanceof ContentBuildError) {
      return error.issues.filter((issue) => issue.level === 'error').map((issue) => issue.code);
    }
    throw error;
  }
  return [];
}

/** A second BUILD IT exercise, added the way an author would add one: one file. */
const secondBuildIt = {
  ...exercise,
  id: 'EX-BUILD_IT-second-workflow',
  title: 'Build the second workflow',
  mode: 'practice',
  expected_outcomes: [
    {
      id: 'a1',
      type: 'architecture',
      requirement: 'trigger_exists',
      ghl_feature: 'GHL-WF-TRIGGER',
      description: 'The workflow starts from the authored trigger.',
    },
    {
      id: 'a2',
      type: 'event',
      event: 'sms.sent',
      count: { exactly: 1 },
      tier: 'quality',
      description: 'Exactly one message is sent.',
    },
  ],
  critical_failures: [
    {
      id: 'c1',
      type: 'negative',
      event: 'sms.sent',
      where: { contact_id: 'dnd' },
      description: 'A contact on DND is never texted.',
    },
  ],
};

describe('a new exercise is content, not code (EXR-001)', () => {
  it('compiles into the bundle with its assertions, tiers and grading intact', async () => {
    const bundle = await compileSources(
      withFile('exercises/EX-BUILD_IT-second-workflow.yaml', yaml(secondBuildIt)),
    );
    const added = bundle.exercises.find(
      (candidate) => candidate.id === 'EX-BUILD_IT-second-workflow',
    );
    expect(added).toBeDefined();
    // Everything the generic runner and the grader read comes straight from the file.
    expect(added?.type).toBe('BUILD_IT');
    expect(added?.mode).toBe('practice');
    expect(added?.expected_outcomes.map((assertion) => assertion.id)).toEqual(['a1', 'a2']);
    expect(added?.expected_outcomes[1]?.tier).toBe('quality');
    expect(added?.critical_failures[0]?.id).toBe('c1');
    expect(added?.grading.pass_threshold).toBe(70);
    // And it joins the indexes the runner and the session builder resolve through.
    expect(bundle.indexes.exercises_by_skill['SK-AUTOMATE-alpha']).toContain(
      'EX-BUILD_IT-second-workflow',
    );
  });
});

describe('the compiler refuses grading rules the runtime could not judge', () => {
  const broken = (changes: Record<string, unknown>) =>
    errorsOf(
      withFile(
        'exercises/EX-BUILD_IT-second-workflow.yaml',
        yaml({ ...secondBuildIt, ...changes }),
      ),
    );

  it('an event assertion with no bound', async () => {
    expect(
      await broken({
        expected_outcomes: [
          {
            id: 'a1',
            type: 'event',
            event: 'sms.sent',
            count: {},
            description: 'Something happens.',
          },
        ],
      }),
    ).toContain('SCHEMA');
  });

  it('an architecture requirement that names no feature', async () => {
    expect(
      await broken({
        expected_outcomes: [
          {
            id: 'a1',
            type: 'architecture',
            requirement: 'action_exists',
            description: 'An action exists.',
          },
        ],
      }),
    ).toContain('SCHEMA');
  });

  it('a node limit that is not a number', async () => {
    expect(
      await broken({
        expected_outcomes: [
          {
            id: 'a1',
            type: 'architecture',
            requirement: 'node_count_max',
            value: 'ten',
            description: 'At most ten nodes.',
          },
        ],
      }),
    ).toContain('SCHEMA');
  });

  it('a state comparison with nothing to compare against', async () => {
    expect(
      await broken({
        expected_outcomes: [
          {
            id: 'a1',
            type: 'state',
            path: 'contacts.a.tags',
            operator: 'equals',
            description: 'A tag is set.',
          },
        ],
      }),
    ).toContain('SCHEMA');
  });

  it('a check on written work with no marker vocabulary to decide it', async () => {
    expect(
      await broken({
        expected_outcomes: [
          {
            id: 'a1',
            type: 'state',
            path: 'answer.mentions_budget',
            operator: 'equals',
            value: true,
            description: 'The answer names the budget.',
          },
        ],
      }),
    ).toContain('SCHEMA');
  });

  it('a decision the exercise never offered', async () => {
    expect(
      await broken({
        decision_options: [{ value: 'tag', label: 'Tag' }],
        expected_outcomes: [
          {
            id: 'a1',
            type: 'state',
            path: 'decision.choice',
            operator: 'equals',
            value: 'custom_value',
            description: 'A custom value is the right home.',
          },
        ],
      }),
    ).toContain('SCHEMA');
  });

  it('a tier on a critical failure, which is always critical', async () => {
    expect(
      await broken({
        critical_failures: [{ ...secondBuildIt.critical_failures[0], tier: 'quality' }],
      }),
    ).toContain('SCHEMA');
  });

  it('but accepts the marker vocabulary when it is authored', async () => {
    expect(
      await broken({
        response_markers: { mentions_budget: ['budget', 'what they can spend'] },
        expected_outcomes: [
          {
            id: 'a1',
            type: 'state',
            path: 'answer.mentions_budget',
            operator: 'equals',
            value: true,
            description: 'The answer names the budget.',
          },
        ],
      }),
    ).toEqual([]);
  });
});
