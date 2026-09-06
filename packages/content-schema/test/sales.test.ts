import { describe, expect, it } from 'vitest';

import type { IssueCode } from '../src/bundle.ts';
import { ContentBuildError, compileSources } from '../src/node.ts';
import { ConversationSchema, ExerciseSchema, RubricSchema } from '../src/index.ts';
import { baseSources, client, exercise, withFile, yaml } from './fixtures.ts';

/**
 * The selling families' authored half (Phase 16). Every rule here exists so that a sales exercise
 * which could not honestly be done, or could not honestly be judged, fails the build instead of
 * reaching a learner (CNT-005, EXR-002, SAL-001).
 */

const evidence = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  source: 'website',
  observation: 'Something the learner can actually look at on their site.',
  direct: true,
  ...extra,
});

const prospectExercise = (overrides: Record<string, unknown> = {}) => ({
  ...exercise,
  id: 'EX-PROSPECT_IT-two',
  type: 'PROSPECT_IT',
  scenario: undefined,
  prospects: ['CL-acme', 'CL-beta'],
  expected_outcomes: [],
  critical_failures: [],
  grading: { mode: 'deterministic', pass_threshold: 70 },
  sales: {
    evidence: [
      evidence('ev-a-one', { client: 'CL-acme' }),
      evidence('ev-b-one', { client: 'CL-beta' }),
    ],
    prospect_briefs: [
      {
        client: 'CL-acme',
        acceptable_decisions: ['contact'],
        strongest_decision: 'contact',
        axes: [{ axis: 'economics', evidence: ['ev-a-one'] }],
      },
      {
        client: 'CL-beta',
        acceptable_decisions: ['skip'],
        strongest_decision: 'skip',
        axes: [{ axis: 'economics', evidence: ['ev-b-one'] }],
      },
    ],
  },
  ...overrides,
});

const auditExercise = (overrides: Record<string, unknown> = {}) => ({
  ...exercise,
  id: 'EX-AUDIT_IT-outside',
  type: 'AUDIT_IT',
  expected_outcomes: [],
  critical_failures: [],
  grading: { mode: 'deterministic', pass_threshold: 70 },
  sales: { evidence: [evidence('ev-reply-22h')] },
  ...overrides,
});

const conversation = (overrides: Record<string, unknown> = {}) => ({
  subject: 'Re: the proposal',
  opening: 'n1',
  composer_help: 'Write what you would send.',
  nodes: [
    {
      id: 'n1',
      client_message: 'What do you want to know?',
      moves: [{ id: 'ask', label: 'Ask how it works today', kind: 'ask', next: 'n2' }],
      fallback: 'n2',
    },
    { id: 'n2', client_message: 'Thursday at ten works.', end: true },
  ],
  ...overrides,
});

const parse = (value: unknown) => ExerciseSchema.safeParse(value);
const messages = (value: unknown): string[] => {
  const result = parse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('the evidence pack (SAL-001)', () => {
  it('accepts an audit that shows the learner something they observed', () => {
    expect(parse(auditExercise()).success).toBe(true);
  });

  it('refuses an AUDIT IT with no evidence at all', () => {
    expect(messages(auditExercise({ sales: { evidence: [] } }))).toContain(
      'AUDIT IT needs the evidence the learner is auditing',
    );
  });

  it('refuses an audit where nothing was observed first-hand, so nothing could be Verified', () => {
    const indirect = auditExercise({
      sales: { evidence: [evidence('ev-hearsay', { direct: false })] },
    });
    expect(messages(indirect)).toContain(
      'AUDIT IT needs at least one directly observed item, or nothing can be Verified',
    );
  });

  it('refuses duplicate evidence ids', () => {
    const twice = auditExercise({
      sales: { evidence: [evidence('ev-one'), evidence('ev-one')] },
    });
    expect(messages(twice)).toContain('Duplicate evidence id: ev-one');
  });
});

describe('prospect briefs (SAL-002)', () => {
  it('accepts a list where one business is right to skip', () => {
    expect(parse(prospectExercise()).success).toBe(true);
  });

  it('refuses a list where every prospect should be contacted', () => {
    const allContact = prospectExercise({
      sales: {
        ...prospectExercise().sales,
        prospect_briefs: prospectExercise().sales.prospect_briefs.map((brief) => ({
          ...brief,
          acceptable_decisions: ['contact'],
          strongest_decision: 'contact',
        })),
      },
    });
    expect(messages(allContact)).toContain('At least one prospect must be one it is right to skip');
  });

  it('refuses a prospect with no brief behind it', () => {
    const missing = prospectExercise({
      sales: {
        ...prospectExercise().sales,
        prospect_briefs: [prospectExercise().sales.prospect_briefs[0]],
      },
    });
    expect(messages(missing)).toContain('CL-beta has no prospect brief');
  });

  it('refuses a strongest decision that is not one of the acceptable ones', () => {
    const brief = prospectExercise().sales.prospect_briefs[0];
    const wrong = prospectExercise({
      sales: {
        ...prospectExercise().sales,
        prospect_briefs: [
          { ...brief, strongest_decision: 'skip' },
          prospectExercise().sales.prospect_briefs[1],
        ],
      },
    });
    expect(messages(wrong)).toContain('skip is not one of the acceptable decisions');
  });

  it('refuses a defensible Maybe that does not say what it is waiting on', () => {
    const brief = prospectExercise().sales.prospect_briefs[0];
    const vague = prospectExercise({
      sales: {
        ...prospectExercise().sales,
        prospect_briefs: [
          { ...brief, acceptable_decisions: ['contact', 'maybe'] },
          prospectExercise().sales.prospect_briefs[1],
        ],
      },
    });
    expect(messages(vague)).toContain('A defensible Maybe names the condition it is waiting on');
  });

  it('refuses a dimension backed by evidence about a different business', () => {
    const brief = prospectExercise().sales.prospect_briefs[0];
    const crossed = prospectExercise({
      sales: {
        ...prospectExercise().sales,
        prospect_briefs: [
          { ...brief, axes: [{ axis: 'economics', evidence: ['ev-b-one'] }] },
          prospectExercise().sales.prospect_briefs[1],
        ],
      },
    });
    expect(messages(crossed)).toContain('ev-b-one is evidence about CL-beta, not CL-acme');
  });

  it('refuses a dimension backed by evidence the exercise never shows', () => {
    const brief = prospectExercise().sales.prospect_briefs[0];
    const ghost = prospectExercise({
      sales: {
        ...prospectExercise().sales,
        prospect_briefs: [
          { ...brief, axes: [{ axis: 'economics', evidence: ['ev-nowhere'] }] },
          prospectExercise().sales.prospect_briefs[1],
        ],
      },
    });
    expect(messages(ghost)).toContain("ev-nowhere is not one of this exercise's evidence items");
  });
});

describe('EXPLAIN IT needs two audiences (EXR-018)', () => {
  const explain = (fields: unknown[]) => ({
    ...exercise,
    id: 'EX-EXPLAIN_IT-twice',
    type: 'EXPLAIN_IT',
    expected_outcomes: [],
    critical_failures: [],
    grading: { mode: 'deterministic', pass_threshold: 70 },
    written_fields: fields,
  });
  const field = (key: string, audience: string) => ({
    key,
    label: key,
    help: 'Say what it does.',
    audience,
  });

  it('accepts an owner version and a builder version', () => {
    expect(parse(explain([field('owner', 'owner'), field('builder', 'builder')])).success).toBe(
      true,
    );
  });

  it('refuses one answer for everybody', () => {
    expect(messages(explain([field('owner', 'owner')]))).toContain(
      'EXPLAIN IT asks for the owner version and the builder version; author a written field for each audience',
    );
  });
});

describe('checks on the sales projections (EXR-002)', () => {
  const check = (path: string) => ({
    id: 'a1',
    type: 'state',
    path,
    operator: 'gte',
    value: 1,
    description: 'A check on a sales figure.',
  });

  it('accepts a check on a figure the family produces', () => {
    expect(
      parse(auditExercise({ expected_outcomes: [check('audit.findings_count')] })).success,
    ).toBe(true);
  });

  it('refuses a figure that projection does not produce', () => {
    expect(messages(auditExercise({ expected_outcomes: [check('audit.vibes')] }))).toContain(
      'audit.vibes is not one of findings_count, classified, verified, likely, unknown, supported, unsupported_claims, with_verification_plan',
    );
  });

  it('refuses an audit figure on an exercise that collects no findings', () => {
    expect(
      messages(prospectExercise({ expected_outcomes: [check('audit.findings_count')] })),
    ).toContain('Only AUDIT IT collects findings');
  });

  it('refuses a per-message check naming a field that does not exist', () => {
    const wrong = auditExercise({ expected_outcomes: [check('message.fields.ghost.word_count')] });
    expect(messages(wrong)).toContain('message.fields.ghost needs a written field named ghost');
  });

  it('refuses a conversation check on an exercise with no thread', () => {
    expect(messages(auditExercise({ expected_outcomes: [check('conversation.turns')] }))).toContain(
      'conversation.* needs an authored conversation',
    );
  });

  it('refuses a topic check the thread never covers', () => {
    const threaded = auditExercise({
      conversation: conversation(),
      expected_outcomes: [
        { ...check('conversation.topics.budget'), operator: 'equals', value: true },
      ],
    });
    expect(messages(threaded)).toContain('no turn of this thread covers budget');
  });

  it('refuses a frame check with no frame authored for that part', () => {
    const explain = {
      ...exercise,
      id: 'EX-EXPLAIN_IT-frame',
      type: 'EXPLAIN_IT',
      grading: { mode: 'deterministic', pass_threshold: 70 },
      critical_failures: [],
      written_fields: [
        { key: 'owner', label: 'Owner', help: 'Say what changed.', audience: 'owner' },
        { key: 'builder', label: 'Builder', help: 'Say what fires it.', audience: 'builder' },
      ],
      expected_outcomes: [
        { ...check('explanation.frame.problem'), operator: 'equals', value: true },
      ],
    };
    expect(messages(explain)).toContain(
      'explanation.frame.problem needs a sales.frame entry for problem',
    );
  });
});

describe('the authored thread (CONV-002)', () => {
  const parseThread = (value: unknown) => ConversationSchema.safeParse(value);
  const errors = (value: unknown): string[] => {
    const result = parseThread(value);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it('accepts a thread that opens, branches and ends', () => {
    expect(parseThread(conversation()).success).toBe(true);
  });

  it('refuses a branch to a node that does not exist', () => {
    const broken = conversation({
      nodes: [
        {
          id: 'n1',
          client_message: 'What do you want to know?',
          moves: [{ id: 'ask', label: 'Ask how it works', kind: 'ask', next: 'nowhere' }],
          fallback: 'n2',
        },
        { id: 'n2', client_message: 'Done.', end: true },
      ],
    });
    expect(errors(broken)).toContain('nowhere is not one of the nodes');
  });

  it('refuses a branching node with no fallback for a reply it cannot place', () => {
    const noFallback = conversation({
      nodes: [
        {
          id: 'n1',
          client_message: 'What do you want to know?',
          moves: [{ id: 'ask', label: 'Ask how it works', kind: 'ask', next: 'n2' }],
        },
        { id: 'n2', client_message: 'Done.', end: true },
      ],
    });
    expect(errors(noFallback)).toContain(
      'Every branching node needs a fallback for a reply the move does not classify',
    );
  });

  it('refuses a thread with nowhere to end', () => {
    const endless = conversation({
      nodes: [
        {
          id: 'n1',
          client_message: 'What do you want to know?',
          moves: [{ id: 'ask', label: 'Ask', kind: 'ask', next: 'n2' }],
          fallback: 'n2',
        },
        {
          id: 'n2',
          client_message: 'And?',
          moves: [{ id: 'ask2', label: 'Ask again', kind: 'ask', next: 'n1' }],
          fallback: 'n1',
        },
      ],
    });
    expect(errors(endless)).toContain('A thread needs somewhere to end');
  });

  it('refuses a node the learner can never reach', () => {
    const orphan = conversation({
      nodes: [
        ...conversation().nodes,
        { id: 'n9', client_message: 'Nobody gets here.', end: true },
      ],
    });
    expect(errors(orphan)).toContain('n9 cannot be reached from n1');
  });

  it('refuses duplicate node ids', () => {
    const twice = conversation({ nodes: [...conversation().nodes, conversation().nodes[1]] });
    expect(errors(twice)).toContain('Duplicate node id: n2');
  });

  it('refuses a closing message that still offers moves', () => {
    const talkative = conversation({
      nodes: [
        conversation().nodes[0],
        {
          id: 'n2',
          client_message: 'Done.',
          end: true,
          moves: [{ id: 'more', label: 'Keep going', kind: 'ask', next: 'n1' }],
        },
      ],
    });
    expect(errors(talkative)).toContain('A closing message offers no further moves');
  });
});

describe('rubric items carry what they judge (SAL-003, SAL-004)', () => {
  it('accepts topics and concepts on an item', () => {
    const parsed = RubricSchema.safeParse({
      id: 'SALES_DISCOVERY_RUBRIC_V9',
      version: 9,
      title: 'Discovery',
      applies_to: ['SAY_IT'],
      model_class: 'strong',
      output_schema: 'ai_grading_v1',
      items: [
        {
          id: 'r1',
          tier: 'required',
          criterion: 'Got the current process out of them.',
          topics: ['current_process'],
          concepts: ['evidence'],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('refuses a topic that is not one of the fifteen', () => {
    const parsed = RubricSchema.safeParse({
      id: 'SALES_DISCOVERY_RUBRIC_V9',
      version: 9,
      title: 'Discovery',
      applies_to: ['SAY_IT'],
      model_class: 'strong',
      output_schema: 'ai_grading_v1',
      items: [
        { id: 'r1', tier: 'required', criterion: 'Asked about the weather.', topics: ['weather'] },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('hidden facts stay hidden (§23, §35)', () => {
  /** Compiles and returns the issue codes the build failed with. */
  async function failsWith(sources: ReturnType<typeof baseSources>): Promise<IssueCode[]> {
    try {
      await compileSources(sources);
    } catch (error) {
      if (error instanceof ContentBuildError) {
        return error.issues.filter((issue) => issue.level === 'error').map((issue) => issue.code);
      }
      throw error;
    }
    throw new Error('Expected the build to fail');
  }

  const secret = 'the quote follow-up never happens';
  const withSecret = () =>
    withFile(
      'clients/CL-acme.yaml',
      yaml({ ...client, hidden_facts: { quote_follow_up: secret } }),
      baseSources(),
    );
  const audit = (id: string, observation: string) =>
    auditExercise({
      id,
      scenario: undefined,
      client: 'CL-acme',
      sales: { evidence: [evidence('ev-look', { observation })] },
    });

  it('refuses an evidence item that hands the learner a hidden fact', async () => {
    const sources = withFile(
      'exercises/EX-AUDIT_IT-leak.yaml',
      yaml(audit('EX-AUDIT_IT-leak', `Anyone can see that ${secret} here.`)),
      withSecret(),
    );
    expect(await failsWith(sources)).toContain('HIDDEN_FACT_EXPOSED');
  });

  it('accepts the same audit when the evidence is something the learner could see', async () => {
    const sources = withFile(
      'exercises/EX-AUDIT_IT-clean.yaml',
      yaml(audit('EX-AUDIT_IT-clean', 'The reply to your test enquiry took 22 hours.')),
      withSecret(),
    );
    await expect(compileSources(sources)).resolves.toBeTruthy();
  });
});
