import { describe, expect, it } from 'vitest';

import type { Exercise } from '@bloomlab/content-schema';
import { gradeExercise } from '@bloomlab/exercise-engine';

import { content } from '../../content/bundle';
import { emptyResponse, learnerState, type LearnerResponse } from '../response';
import { availableSources } from '../runtime';
import {
  emptyFinding,
  findingVerdict,
  jargonTerms,
  projectAudit,
  projectConversation,
  projectExplanation,
  projectMessages,
  projectProspects,
  prospectVerdict,
  resolveThread,
  sharePercent,
  wordCount,
  type AuditFindingResponse,
  type ConversationTurnResponse,
  type JargonTerm,
  type ProspectDecisionResponse,
  type SalesResponse,
} from './index';
import { emptySalesResponse } from './types';
import { jargonVocabulary } from './vocabulary';

/**
 * The deterministic half of the selling families (Phase 16).
 *
 * Everything here is measured, never judged: how many words, which evidence, which branch, what
 * share of the thread. The point of pinning it is that the number a learner reads in the work area
 * and the number a check reads at submission are produced by these functions and no others.
 */

const byId = (id: string): Exercise =>
  content.exercises.find((candidate) => candidate.id === id) as Exercise;

const PROSPECT = byId('EX-PROSPECT_IT-three-businesses');
const AUDIT = byId('EX-AUDIT_IT-northwind-outside-in');
const COLD_EMAIL = byId('EX-WRITE_IT-northwind-cold-email');
const EXPLAIN = byId('EX-EXPLAIN_IT-no-show-system');
const DISCOVERY = byId('EX-WRITE_IT-summit-written-discovery');
const CLOSING = byId('EX-WRITE_IT-summit-after-the-proposal');

const sales = (overrides: Partial<SalesResponse> = {}): SalesResponse => ({
  ...emptySalesResponse(),
  ...overrides,
});

const respond = (overrides: Partial<LearnerResponse> = {}): LearnerResponse => ({
  ...emptyResponse(),
  ...overrides,
});

/** Grades an exercise the way the runner does, from what the learner supplied and nothing else. */
const grade = (exercise: Exercise, response: LearnerResponse) =>
  gradeExercise({
    exercise,
    context: {
      state: learnerState(exercise, response),
      events: [],
      references: {},
      architecture: null,
      provides: availableSources(exercise),
    },
    hints_used: [],
  });

describe('one word count, everywhere (§44)', () => {
  it('counts words, not spaces or punctuation', () => {
    expect(wordCount('Hello, Gary. Your form took 22 hours.')).toBe(7);
    expect(wordCount('  double   spaces\nand newlines  ')).toBe(4);
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('— …')).toBe(0);
  });

  it('is stable across the punctuation people actually type', () => {
    const plain = wordCount('I looked at your booking page and the reply took 22 hours');
    expect(wordCount('I looked at your booking page, and the reply took 22 hours.')).toBe(plain);
    expect(wordCount('I looked at your booking page — and the reply took 22 hours!')).toBe(plain);
  });

  it('refuses to invent a share out of nothing (REP-003)', () => {
    expect(sharePercent(0, 0)).toBeNull();
    expect(sharePercent(3, 10)).toBe(30);
  });
});

describe('PROSPECT IT counts decisions, not enthusiasm (EXR-012, SAL-002)', () => {
  const halcyon: ProspectDecisionResponse = {
    decision: 'skip',
    reason: 'Eighteen-dollar classes and a booking app the studio cannot change.',
    axes: ['economics', 'technical_fit'],
    evidence: ['ev-hy-prices', 'ev-hy-app'],
  };
  const strongSkip = sales({ prospects: { 'CL-halcyon-yoga': halcyon } });

  it('gives a justified Skip everything a Contact could have got', () => {
    const verdict = prospectVerdict(PROSPECT, 'CL-halcyon-yoga', halcyon);
    expect(verdict).toMatchObject({
      decided: true,
      reasoned: true,
      acceptable: true,
      supported: true,
      unsupported_axes: [],
    });
  });

  it('does not accept Contact for a business the evidence says to skip', () => {
    const contacted = prospectVerdict(PROSPECT, 'CL-halcyon-yoga', {
      ...halcyon,
      decision: 'contact',
    });
    expect(contacted.acceptable).toBe(false);
    expect(contacted.supported).toBe(false);
  });

  it('does not support a dimension with nothing cited behind it', () => {
    const claimed = prospectVerdict(PROSPECT, 'CL-halcyon-yoga', {
      ...halcyon,
      axes: ['economics', 'decision_maker_access'],
      evidence: ['ev-hy-prices'],
    });
    expect(claimed.supported).toBe(false);
    expect(claimed.unsupported_axes).toEqual(['decision_maker_access']);
  });

  it('does not read the length of the reason (§62)', () => {
    const long = prospectVerdict(PROSPECT, 'CL-halcyon-yoga', {
      decision: 'skip',
      reason: 'x '.repeat(200),
      axes: ['economics'],
      evidence: [],
    });
    const short = prospectVerdict(PROSPECT, 'CL-halcyon-yoga', {
      decision: 'skip',
      reason: 'Tickets are too small.',
      axes: ['economics'],
      evidence: ['ev-hy-prices'],
    });
    expect(long.supported).toBe(false);
    expect(short.supported).toBe(true);
  });

  it('counts what was decided, reasoned and supported across the list', () => {
    expect(projectProspects(PROSPECT, strongSkip)).toEqual({
      total: 3,
      decided: 1,
      with_reasoning: 1,
      with_axes: 1,
      acceptable: 1,
      supported: 1,
    });
  });

  it('scores a full pass on the deterministic half when the skip is defended', () => {
    const answered = sales({
      prospects: {
        'CL-northwind-hvac': {
          decision: 'contact',
          reason:
            'Big ticket, a plan they already sell monthly, and the owner runs his own profile.',
          axes: ['economics', 'recurring_need', 'decision_maker_access'],
          evidence: ['ev-nw-replacement', 'ev-nw-plan', 'ev-nw-owner'],
        },
        'CL-ridgeline-roofing': {
          decision: 'maybe',
          reason:
            'Worth it if Dale can change his own follow-up. The network badge says he may not.',
          axes: ['economics', 'technical_fit'],
          evidence: ['ev-rr-ticket', 'ev-rr-network'],
        },
        ...strongSkip.prospects,
      },
    });
    const report = grade(PROSPECT, respond({ sales: answered }));
    expect(report.score).toBe(100);
    // Mixed grading: the numbers are in, the writing is not judged until Phase 19 (AI-006).
    expect(report.reason).toBe('rubric_pending');
    expect(report.outcome).toBe('partial');
    expect(report.rubric_pending).toBe('AUDIT_EVIDENCE_RUBRIC_V1');
  });

  it('fails the deterministic half when every business is contacted', () => {
    const everyone = sales({
      prospects: Object.fromEntries(
        PROSPECT.prospects.map((client) => [
          client,
          { decision: 'contact' as const, reason: 'Looks fine to me.', axes: [], evidence: [] },
        ]),
      ),
    });
    const report = grade(PROSPECT, respond({ sales: everyone }));
    expect(report.score).toBeLessThan(PROSPECT.grading.pass_threshold);
  });
});

describe('AUDIT IT: Verified has to point at something (EXR-013, SAL-001)', () => {
  const finding = (overrides: Partial<AuditFindingResponse> = {}): AuditFindingResponse => ({
    ...emptyFinding('f1'),
    claim: 'They take most of a day to answer a web enquiry.',
    classification: 'verified',
    evidence: ['ev-nw-reply-22h'],
    ...overrides,
  });

  it('supports a Verified finding that cites something observed first-hand', () => {
    expect(findingVerdict(AUDIT, finding())).toMatchObject({ supported: true, problem: null });
  });

  it('refuses a Verified finding with no direct evidence behind it', () => {
    expect(findingVerdict(AUDIT, finding({ evidence: [] }))).toMatchObject({
      supported: false,
      problem: 'verified_without_direct_evidence',
    });
  });

  it('refuses a Verified finding that rests only on second-hand evidence', () => {
    expect(findingVerdict(AUDIT, finding({ evidence: ['ev-nw-reviews'] }))).toMatchObject({
      supported: false,
      problem: 'verified_without_direct_evidence',
    });
  });

  it('lets the same second-hand evidence carry a Likely', () => {
    const likely = finding({ classification: 'likely', evidence: ['ev-nw-reviews'] });
    expect(findingVerdict(AUDIT, likely).supported).toBe(true);
  });

  it('refuses a Likely with nothing cited at all', () => {
    expect(
      findingVerdict(AUDIT, finding({ classification: 'likely', evidence: [] })),
    ).toMatchObject({ problem: 'likely_without_evidence' });
  });

  it('treats an Unknown that says how to confirm it as a good answer', () => {
    const unknown = finding({
      classification: 'unknown',
      evidence: [],
      verification: 'Ask Tina what happens to a quote after the technician leaves.',
    });
    expect(findingVerdict(AUDIT, unknown).supported).toBe(true);
  });

  it('refuses an Unknown that names nothing that would settle it', () => {
    const unknown = finding({ classification: 'unknown', evidence: [], verification: '  ' });
    expect(findingVerdict(AUDIT, unknown)).toMatchObject({ problem: 'unknown_without_plan' });
  });

  it('does not let confident wording stand in for evidence', () => {
    const sure = finding({
      claim: 'They absolutely never follow up an unsold quote. This is definitely costing them.',
      evidence: [],
    });
    expect(findingVerdict(AUDIT, sure).supported).toBe(false);
  });

  it('supports nothing with an id that is not in the pack, including a hidden fact', () => {
    const invented = finding({ evidence: ['quote_follow_up_rate', 'ev-does-not-exist'] });
    expect(findingVerdict(AUDIT, invented).supported).toBe(false);
    expect(AUDIT.sales.evidence.map((item) => item.id)).not.toContain('quote_follow_up_rate');
  });

  it('counts the findings, the labels and what does not stand up', () => {
    const mixed = sales({
      findings: [
        finding({ id: 'f1' }),
        finding({ id: 'f2', classification: 'likely', evidence: ['ev-nw-competitor'] }),
        finding({ id: 'f3', classification: 'unknown', evidence: [], verification: 'Ask them.' }),
        finding({ id: 'f4', evidence: [] }),
        finding({ id: 'f5', claim: '   ' }),
      ],
    });
    expect(projectAudit(AUDIT, mixed)).toEqual({
      findings_count: 4,
      classified: 4,
      verified: 2,
      likely: 1,
      unknown: 1,
      supported: 3,
      unsupported_claims: 1,
      with_verification_plan: 1,
    });
  });

  it('fails the deterministic half on one unsupported Verified claim', () => {
    const three = [
      finding({ id: 'f1' }),
      finding({ id: 'f2', classification: 'likely', evidence: ['ev-nw-reviews'] }),
      finding({ id: 'f3', classification: 'unknown', evidence: [], verification: 'Ask Tina.' }),
    ];
    const clean = grade(AUDIT, respond({ sales: sales({ findings: three }) }));
    expect(clean.score).toBe(100);

    const withClaim = grade(
      AUDIT,
      respond({ sales: sales({ findings: [...three, finding({ id: 'f4', evidence: [] })] }) }),
    );
    expect(withClaim.score).toBeLessThan(clean.score as number);
  });
});

describe('WRITE IT measures the brief, not the prose (EXR-014, SAL-003)', () => {
  const written = (initial: string, follow: string) => ({
    initial_email: initial,
    follow_up: follow,
  });

  it('holds each message to the cap the brief stated', () => {
    const overLong = 'word '.repeat(140);
    const projection = projectMessages(
      COLD_EMAIL,
      written(overLong, 'Short and new.'),
      sales({ next_steps: { initial_email: 'A call', follow_up: 'A reply' } }),
    );
    expect(projection.fields.initial_email?.word_count).toBe(140);
    expect(projection.fields.initial_email?.within_limit).toBe(false);
    expect(projection.fields.follow_up?.within_limit).toBe(true);
    expect(projection.within_word_limit).toBe(false);
    expect(projection.over_limit).toBe(1);
  });

  it('asks for a next step on both messages and notices when one is missing', () => {
    const one = projectMessages(
      COLD_EMAIL,
      written('The first email.', 'The follow-up.'),
      sales({ next_steps: { initial_email: 'Fifteen minutes on Thursday' } }),
    );
    expect(one.has_next_step).toBe(false);
    const both = projectMessages(
      COLD_EMAIL,
      written('The first email.', 'The follow-up.'),
      sales({
        next_steps: { initial_email: 'Fifteen minutes on Thursday', follow_up: 'Reply yes or no' },
      }),
    );
    expect(both.has_next_step).toBe(true);
  });

  it('only counts a citation the exercise actually showed the learner', () => {
    const invented = projectMessages(
      COLD_EMAIL,
      written('The first email.', 'The follow-up.'),
      sales({ citations: { initial_email: ['ev-made-up'] } }),
    );
    expect(invented.fields.initial_email?.citations).toBe(0);
    expect(invented.cites_direct_evidence).toBe(false);
  });

  it('wants the first email to rest on something observed, not on hearsay', () => {
    const hearsay = projectMessages(
      COLD_EMAIL,
      written('The first email.', 'The follow-up.'),
      sales({ citations: { initial_email: ['ev-nw-competitor'] } }),
    );
    expect(hearsay.cites_direct_evidence).toBe(false);
    const observed = projectMessages(
      COLD_EMAIL,
      written('The first email.', 'The follow-up.'),
      sales({ citations: { initial_email: ['ev-nw-reply-22h'] } }),
    );
    expect(observed.cites_direct_evidence).toBe(true);
  });

  it('passes the deterministic half when both messages meet the brief', () => {
    const report = grade(
      COLD_EMAIL,
      respond({
        written: written(
          'Gary, your form took 22 hours to answer my enquiry on Wednesday. Two competitors on the same search let people call straight from the ad. Worth fifteen minutes?',
          'Following up with one thing I did not send last week: the same form on your ads page has no phone number on it at all.',
        ),
        sales: sales({
          next_steps: { initial_email: 'Fifteen minutes Thursday', follow_up: 'Reply yes or no' },
          citations: { initial_email: ['ev-nw-reply-22h'] },
        }),
      }),
    );
    expect(report.score).toBe(100);
    expect(report.rubric_pending).toBe('WRITTEN_COMMUNICATION_RUBRIC_V2');
  });
});

describe('EXPLAIN IT: two audiences, counted against the glossary (EXR-018, SAL-007)', () => {
  const vocabulary = jargonVocabulary();
  const owner =
    'When somebody does not turn up, they get a message the next morning asking if they want to rebook. It costs you two empty chairs a week today.';
  const builder =
    'The appointment status changed trigger fires on no-show only, with re-entry off so nobody gets it twice.';

  it('takes its vocabulary from the glossary, not from a list in a component', () => {
    expect(vocabulary.length).toBeGreaterThan(3);
    expect(vocabulary.map((term) => term.term)).toContain('Workflow');
    expect(vocabulary.map((term) => term.term)).not.toContain('No-show');
  });

  it('counts a builder term and leaves ordinary business words alone', () => {
    expect(jargonTerms('The workflow updates a custom value.', vocabulary).sort()).toEqual([
      'Custom value',
      'Workflow',
    ]);
    expect(jargonTerms('She had two no-shows on Tuesday.', vocabulary)).toEqual([]);
  });

  it('counts a plural as the same term and does not match inside a longer word', () => {
    expect(jargonTerms('Two workflows run.', vocabulary)).toEqual(['Workflow']);
    expect(jargonTerms('The workflowish thing.', vocabulary)).toEqual([]);
  });

  it('holds the owner version to the owner rule and lets the builder version be precise', () => {
    const projection = projectExplanation(
      EXPLAIN,
      { owner, builder },
      (text) => marks(EXPLAIN, text),
      vocabulary,
    );
    expect(projection.audiences_answered).toBe(2);
    expect(projection.owner_jargon_count).toBe(0);
    expect(projection.builder_jargon_count).toBeGreaterThan(0);
  });

  it('flags builder vocabulary in the owner version', () => {
    const jargony = projectExplanation(
      EXPLAIN,
      {
        owner: 'The workflow fires a trigger that updates a custom value on the contact.',
        builder,
      },
      (text) => marks(EXPLAIN, text),
      vocabulary,
    );
    expect(jargony.owner_jargon_count).toBeGreaterThan(2);
    expect(jargony.owner_jargon_terms).toContain('Workflow');
  });

  it('reads the frame from the exercise markers, never from the words problem or outcome', () => {
    const projection = projectExplanation(
      EXPLAIN,
      { owner, builder },
      (text) => marks(EXPLAIN, text),
      vocabulary,
    );
    expect(projection.frame.problem).toBe(true);
    expect(projection.frame.consequence).toBe(true);
    expect(projection.frame.system).toBe(true);
    expect(projection.frame_covered).toBeGreaterThanOrEqual(3);
    expect(owner.toLowerCase()).not.toContain('problem');
    expect(owner.toLowerCase()).not.toContain('outcome');
  });

  it('grades the two answers separately', () => {
    const onlyOwner = grade(EXPLAIN, respond({ written: { owner } }));
    expect(onlyOwner.score).toBeLessThan(100);
    const both = grade(
      EXPLAIN,
      respond({ written: { owner, builder: `${builder} It is rebooked without anyone chasing.` } }),
    );
    expect(both.score).toBe(100);
  });
});

/** The exercise's own markers, matched the way the runner matches them. */
function marks(exercise: Exercise, text: string): string[] {
  const haystack = text.toLowerCase();
  return Object.entries(exercise.response_markers)
    .filter(([, phrases]) => phrases.some((phrase) => haystack.includes(phrase.toLowerCase())))
    .map(([key]) => key);
}

describe('the client thread branches on the move, not on the prose (CONV-002)', () => {
  const thread = DISCOVERY.conversation!;
  const turn = (node: string, move: string | null, text: string): ConversationTurnResponse => ({
    node,
    move,
    text,
  });

  it('opens on the client and waits', () => {
    const resolved = resolveThread(thread, []);
    expect(resolved.messages).toHaveLength(1);
    expect(resolved.messages[0]?.from).toBe('client');
    expect(resolved.current?.id).toBe(thread.opening);
    expect(resolved.complete).toBe(false);
  });

  it('takes a different branch for a different move', () => {
    const asked = resolveThread(thread, [turn('n1', 'ask_process', 'How does it work today?')]);
    const pitched = resolveThread(thread, [
      turn('n1', 'pitch_first', 'I would build you a funnel.'),
    ]);
    expect(asked.current?.id).not.toBe(pitched.current?.id);
    expect(asked.messages.at(-1)?.text).not.toBe(pitched.messages.at(-1)?.text);
  });

  it('takes the authored fallback when the learner sends without saying what they are doing', () => {
    const unplaced = resolveThread(thread, [turn('n1', null, 'Hi Marcus.')]);
    expect(unplaced.current?.id).toBe('n_clarify_early');
    expect(unplaced.messages.at(-2)?.unclassified).toBe(true);
  });

  it('never answers with a verdict on the learner (no "Correct." banner)', () => {
    for (const node of thread.nodes) {
      expect(node.client_message).not.toMatch(/\bcorrect\b/i);
      expect(node.client_message).not.toMatch(/well done|good job|nice work/i);
    }
  });

  it('replays a saved thread into the same place', () => {
    const turns = [
      turn('n1', 'ask_process', 'How does it work today?'),
      turn('n3', 'ask_pain', 'What is the worst part of that?'),
    ];
    const first = resolveThread(thread, turns);
    const again = resolveThread(thread, turns);
    expect(again.current?.id).toBe(first.current?.id);
    expect(again.messages).toEqual(first.messages);
  });

  it('stops rather than guessing when a saved turn no longer matches the content', () => {
    const stale = resolveThread(thread, [turn('n_gone', 'ask_process', 'Anything.')]);
    expect(stale.current?.id).toBe(thread.opening);
    expect(stale.messages).toHaveLength(1);
  });

  it('drops out of the thread when a move leads nowhere real', () => {
    const broken = resolveThread(
      { ...thread, nodes: [{ ...thread.nodes[0]!, fallback: undefined, moves: [], end: false }] },
      [turn(thread.opening, null, 'Hello?')],
    );
    expect(broken.current).toBeNull();
  });
});

describe('talk share and the early pitch (SAL-005)', () => {
  const thread = DISCOVERY.conversation!;
  const words = (count: number) => 'word '.repeat(count).trim();
  const clientWordsAt = (nodeId: string) =>
    wordCount(thread.nodes.find((node) => node.id === nodeId)!.client_message);

  it('computes the share once, from the transcript both sides can see', () => {
    const opening = clientWordsAt('n1');
    const projection = projectConversation(thread, [
      { node: 'n1', move: 'ask_process', text: words(opening) },
    ]);
    expect(projection.client_words).toBe(opening + clientWordsAt('n3'));
    expect(projection.learner_words).toBe(opening);
    expect(projection.talk_share).toBe(
      sharePercent(projection.learner_words, projection.learner_words + projection.client_words),
    );
  });

  it('does not penalise a learner at exactly 60%', () => {
    const client = clientWordsAt('n1') + clientWordsAt('n3');
    // 60% of the whole thread is one and a half times what the client said.
    const learner = client * 1.5;
    const projection = projectConversation(thread, [
      { node: 'n1', move: 'ask_process', text: words(learner) },
    ]);
    expect(projection.talk_share).toBe(60);
    expect(projection.learner_talk_over_60).toBe(false);
  });

  it('penalises a learner who took more than 60% of it', () => {
    const projection = projectConversation(thread, [
      { node: 'n1', move: 'ask_process', text: words(400) },
    ]);
    expect(projection.talk_share).toBeGreaterThan(60);
    expect(projection.learner_talk_over_60).toBe(true);
  });

  it('says nothing about a thread with nothing in it', () => {
    const nothing = projectConversation(null, []);
    expect(nothing.talk_share).toBeNull();
    expect(nothing.learner_talk_over_60).toBe(false);
    expect(nothing.turns).toBe(0);
  });

  it('marks a pitch before the client agreed with the diagnosis', () => {
    const early = projectConversation(thread, [
      { node: 'n1', move: 'pitch_first', text: 'Here is what I would build.' },
    ]);
    expect(early.pitched_before_diagnosis).toBe(true);
    expect(early.diagnosis_agreed).toBe(false);
  });

  it('does not mark a pitch that came after he agreed', () => {
    const inOrder = projectConversation(thread, [
      { node: 'n1', move: 'ask_process', text: 'How does it work today?' },
      { node: 'n3', move: 'ask_pain', text: 'What is the worst part?' },
      { node: 'n5', move: 'reflect_back', text: 'So the right ones wait behind the wrong ones.' },
      { node: 'n7', move: 'propose', text: 'Here is what I would build.' },
    ]);
    expect(inOrder.diagnosis_agreed).toBe(true);
    expect(inOrder.pitched_before_diagnosis).toBe(false);
  });

  it('fails the attempt on an early pitch whatever the rest of it looks like', () => {
    const report = grade(
      DISCOVERY,
      respond({
        sales: {
          ...emptySalesResponse(),
          turns: [
            { node: 'n1', move: 'pitch_first', text: 'I would build you an application funnel.' },
          ],
        },
      }),
    );
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
    expect(report.failed_critical).toEqual(['c1']);
  });

  it('counts the topics the client actually put on the table', () => {
    const walked = projectConversation(thread, [
      { node: 'n1', move: 'set_agenda', text: 'Here is what I want to cover.' },
      { node: 'n2', move: 'ask_process', text: 'How does it work today?' },
      { node: 'n3', move: 'ask_volume', text: 'How many a month?' },
      { node: 'n4', move: 'ask_pain', text: 'What is the worst part?' },
      { node: 'n5', move: 'reflect_back', text: 'The right ones wait behind the wrong ones.' },
      { node: 'n7', move: 'ask_technical', text: 'What does it have to work with?' },
      { node: 'n8', move: 'ask_stakeholders', text: 'Who else has a say?' },
      { node: 'n9', move: 'ask_budget', text: 'What did you have in mind to spend?' },
      { node: 'n10', move: 'set_next_step', text: 'Thursday at ten?' },
    ]);
    expect(walked.complete).toBe(true);
    expect(walked.next_step_agreed).toBe(true);
    expect(walked.topics_covered).toBeGreaterThanOrEqual(12);
    expect(walked.topics.budget).toBe(true);
    expect(walked.topics.urgency).toBe(false);
  });
});

describe('closing (SAL-008)', () => {
  const thread = CLOSING.conversation!;

  it('stages all five closing situations somewhere in the thread', () => {
    const situations = new Set(thread.nodes.map((node) => node.situation).filter(Boolean));
    expect([...situations].sort()).toEqual([
      'commitment',
      'decision_delay',
      'ghosting',
      'next_step_control',
      'proposal_follow_up',
    ]);
  });

  it('reaches a decision when the learner brings something new and then asks for it', () => {
    const projection = projectConversation(thread, [
      {
        node: 'c1',
        move: 'follow_up_with_something',
        text: 'One thing I did not send you before.',
      },
      { node: 'c2', move: 'ask_commitment', text: 'Can you decide either way this week?' },
      { node: 'c5', move: 'set_the_start', text: 'Tuesday at nine, and I need the form login.' },
    ]);
    expect(projection.complete).toBe(true);
    expect(projection.next_step_agreed).toBe(true);
    expect(projection.situations.ghosting).toBe(true);
    expect(projection.situations.decision_delay).toBe(true);
  });
});

describe('a response saved before any of this existed still loads', () => {
  it('reads an old draft with no sales half at all', () => {
    const old = { text: 'Something I wrote in Phase 15.', choice: null, prediction: {} };
    expect(() => learnerState(AUDIT, old)).not.toThrow();
    const state = learnerState(AUDIT, old) as Record<string, { findings_count: number }>;
    expect(state.audit?.findings_count).toBe(0);
  });

  it('leaves the sales roots empty for an exercise that is not a selling family', () => {
    const build = byId('EX-BUILD_IT-no-show-recovery');
    const state = learnerState(build, emptyResponse()) as Record<string, unknown>;
    expect(state.prospects).toMatchObject({ total: 0, decided: 0 });
    expect(state.conversation).toMatchObject({ turns: 0, talk_share: null });
  });
});

describe('the vocabulary is content', () => {
  it('is built from the glossary and its aliases', () => {
    const terms: JargonTerm[] = jargonVocabulary();
    const workflow = terms.find((term) => term.term === 'Workflow');
    expect(workflow?.forms).toContain('workflow');
    expect(content.glossary.some((entry) => entry.owner_safe)).toBe(true);
  });
});
