import { describe, expect, it } from 'vitest';

import type { Exercise } from '@bloomlab/content-schema';
import {
  gradeExercise,
  type GradingArchitecture,
  type GradingContext,
} from '@bloomlab/exercise-engine';
import { initialAccount, type Funnel, type SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { learnerFunnels } from './exerciseRuntime';

/**
 * EXR-011: FUNNEL ASSEMBLY accepts more than one valid ordering.
 *
 * The requirement is easy to claim and easy to fake, so this test does the thing that cannot be
 * faked: it grades **two structurally different funnels** against the same authored exercise and
 * expects both to pass. Ordering A is a two-step funnel that captures then books. Ordering B is a
 * three-step funnel that qualifies with a survey first, puts proof on a different step, and orders
 * its blocks differently. Neither is the exercise's "expected" answer, because the exercise has
 * none — it states constraints, and both architectures satisfy them.
 *
 * The third case inverts a stated dependency (the form before the offer, no calendar) and fails.
 * The fourth sells the membership, which is the exercise's one critical failure.
 */

const EXERCISE_ID = 'EX-FUNNEL_ASSEMBLY-glowhaus-consult-funnel';
const SCENARIO_ID = 'SC-glowhaus-funnel';

const exercise = (): Exercise => {
  const found = (content.exercises as unknown as Exercise[]).find((row) => row.id === EXERCISE_ID);
  if (!found) throw new Error(`${EXERCISE_ID} is not in the content bundle`);
  return found;
};

const scenario = (): SimulatorScenario => {
  const found = (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === SCENARIO_ID,
  );
  if (!found) throw new Error(`${SCENARIO_ID} is not in the content bundle`);
  return found;
};

type Block = Funnel['steps'][number]['blocks'][number];

const block = (id: string, role: Block['role'], reference: string | null = null): Block => ({
  id,
  role,
  headline: null,
  body: null,
  reference_id: reference,
  target_step_id: null,
});

const built = (steps: Funnel['steps']): Funnel => ({
  id: 'fn-learner',
  name: "The learner's funnel",
  steps,
  version: 2,
});

/** A: one capture step that makes the case and asks, then a booking step. */
const orderingA = (): Funnel =>
  built([
    {
      id: 'st-1',
      name: 'Consultation offer',
      purpose: 'capture',
      next_step_id: 'st-2',
      blocks: [
        block('b1', 'headline'),
        block('b2', 'problem'),
        block('b3', 'outcome'),
        block('b4', 'proof'),
        block('b5', 'benefits'),
        block('b6', 'form', 'consult-request'),
      ],
    },
    {
      id: 'st-2',
      name: 'Pick a time',
      purpose: 'booking',
      next_step_id: null,
      blocks: [block('b7', 'headline'), block('b8', 'calendar', 'consultation')],
    },
  ]);

/**
 * B: a qualifying content step first, the capture step ordered differently with objections and a
 * call to action, and proof moved onto the booking step. Structurally a different funnel — more
 * steps, different block order, different placement of proof — and equally defensible.
 */
const orderingB = (): Funnel =>
  built([
    {
      id: 'st-0',
      name: 'Is this for you?',
      purpose: 'content',
      next_step_id: 'st-1',
      blocks: [
        block('b0', 'headline'),
        block('b0b', 'outcome'),
        block('b0c', 'survey', 'fit-check'),
      ],
    },
    {
      id: 'st-1',
      name: 'Your consultation',
      purpose: 'capture',
      next_step_id: 'st-2',
      blocks: [
        block('b1', 'headline'),
        block('b2', 'benefits'),
        block('b3', 'objections'),
        block('b4', 'cta'),
        block('b5', 'form', 'consult-request'),
      ],
    },
    {
      id: 'st-2',
      name: 'Book it',
      purpose: 'booking',
      next_step_id: null,
      blocks: [
        block('b6', 'headline'),
        block('b7', 'proof'),
        block('b8', 'calendar', 'consultation'),
      ],
    },
  ]);

/** Wrong: it asks before it explains, and there is nowhere to book. */
const wrongOrdering = (): Funnel =>
  built([
    {
      id: 'st-1',
      name: 'Sign up',
      purpose: 'capture',
      next_step_id: null,
      blocks: [
        block('b1', 'form', 'consult-request'),
        block('b2', 'headline'),
        block('b3', 'outcome'),
      ],
    },
  ]);

/** The critical failure: the membership is sold on a funnel written for a free consultation. */
const sellsMembership = (): Funnel => {
  const base = orderingA();
  return {
    ...base,
    steps: [
      ...base.steps,
      {
        id: 'st-3',
        name: 'Join the membership',
        purpose: 'checkout',
        next_step_id: null,
        blocks: [block('b9', 'headline'), block('b10', 'checkout', 'glow-membership')],
      },
    ],
  };
};

/** A context built the way the runtime builds one: real account, the learner's own funnel. */
function contextFor(funnel: Funnel): GradingContext {
  const account = initialAccount(scenario());
  const withFunnel = { ...account, funnels: { ...account.funnels, [funnel.id]: funnel } };
  const architecture: GradingArchitecture = {
    workflows: [],
    funnels: learnerFunnels(withFunnel, scenario()),
  };
  return {
    state: withFunnel as unknown as Record<string, unknown>,
    events: [],
    references: {},
    architecture,
    provides: ['state', 'events', 'references', 'architecture'],
  };
}

const report = (funnel: Funnel) =>
  gradeExercise({ exercise: exercise(), context: contextFor(funnel), assistance: 'independent' });

const failedIds = (funnel: Funnel): string[] => {
  const result = report(funnel);
  return [...result.tiers.required, ...result.tiers.quality, ...result.tiers.critical]
    .filter((row) => !row.passed)
    .map((row) => row.id);
};

describe('EXR-011: more than one valid architecture passes', () => {
  it('passes ordering A — capture that makes the case, then booking', () => {
    const result = report(orderingA());
    expect(result.outcome).toBe('passed');
    expect(result.counts.unevaluated).toBe(0);
    expect(failedIds(orderingA())).toEqual([]);
  });

  it('passes ordering B — a qualifying step first, blocks in a different order', () => {
    const result = report(orderingB());
    expect(result.outcome).toBe('passed');
    expect(result.counts.unevaluated).toBe(0);
    expect(failedIds(orderingB())).toEqual([]);
  });

  it('the two orderings really are structurally different', () => {
    const a = orderingA();
    const b = orderingB();
    expect(a.steps).toHaveLength(2);
    expect(b.steps).toHaveLength(3);
    expect(a.steps.map((step) => step.purpose)).not.toEqual(b.steps.map((step) => step.purpose));
    const roles = (funnel: Funnel) =>
      funnel.steps.flatMap((step) => step.blocks.map((x) => x.role));
    expect(roles(a)).not.toEqual(roles(b));
    // Proof sits on different steps, which is the whole "several defensible placements" point.
    const proofStep = (funnel: Funnel) =>
      funnel.steps.find((step) => step.blocks.some((x) => x.role === 'proof'))?.purpose;
    expect(proofStep(a)).toBe('capture');
    expect(proofStep(b)).toBe('booking');
  });

  it('fails an architecture that asks before it explains and never books', () => {
    const result = report(wrongOrdering());
    expect(result.outcome).toBe('failed');
    const failed = failedIds(wrongOrdering());
    // a2: no booking step. a5: no calendar connected. a6: the form comes before the outcome.
    // a3 is not among them and should not be: an order rule about a booking step that does not
    // exist is vacuous, and a2 is the check that says the step is missing.
    expect(failed).toEqual(expect.arrayContaining(['a2', 'a5', 'a6']));
    expect(failed).not.toContain('a3');
  });

  it('fails an otherwise good funnel that sells the membership, whatever it scores', () => {
    const result = report(sellsMembership());
    expect(result.outcome).toBe('failed');
    expect(result.reason).toBe('critical_failure');
    expect(result.failed_critical).toEqual(['c1']);
    // Every scored check still passed; the critical gate is what failed it (D-067).
    expect(result.counts.scored_passed).toBe(result.counts.scored_total);
  });

  it('grades the same funnel the same way every time', () => {
    const once = report(orderingB());
    const twice = report(orderingB());
    expect(once.score).toBe(twice.score);
    expect(once.outcome).toBe(twice.outcome);
    expect(once.dimensions).toEqual(twice.dimensions);
  });

  it('reads the learner’s funnel, not the scenario’s', () => {
    // The scenario authors no funnel, so an account with nothing built grades as no funnel at all
    // rather than passing on something the learner never made.
    const account = initialAccount(scenario());
    expect(learnerFunnels(account, scenario())).toEqual([]);
    const empty = gradeExercise({
      exercise: exercise(),
      context: {
        state: account as unknown as Record<string, unknown>,
        events: [],
        references: {},
        architecture: { workflows: [], funnels: [] },
        provides: ['state', 'events', 'references', 'architecture'],
      },
      assistance: 'independent',
    });
    expect(empty.outcome).toBe('failed');
  });

  it('says a capture block that names a removed entity is not connected', () => {
    // The reference resolves against the account the funnel belongs to, so a form deleted after
    // the funnel was built reads as unconnected rather than as a pass.
    const account = initialAccount(scenario());
    const funnel = orderingA();
    const stripped = {
      ...account,
      forms: {},
      funnels: { [funnel.id]: funnel },
    };
    const read = learnerFunnels(stripped, scenario());
    const formBlock = read?.[0]?.steps
      .flatMap((step) => step.blocks)
      .find((row) => row.role === 'form');
    expect(formBlock?.reference_id).toBe('consult-request');
    expect(formBlock?.reference_resolved).toBe(false);
  });
});

describe('the exercise states constraints, never a sequence', () => {
  it('authors no assertion that pins a block to a position', () => {
    const authored = [...exercise().expected_outcomes, ...exercise().critical_failures];
    expect(authored.length).toBeGreaterThan(0);
    for (const assertion of authored) {
      expect(assertion.type).toBe('architecture');
      if (assertion.type !== 'architecture') continue;
      expect(assertion.requirement).toMatch(/^funnel_/);
      // Order is only ever expressed as "this role before that role", never as an index.
      if (assertion.requirement === 'funnel_block_order') {
        expect(assertion.before).toBeTruthy();
        expect(assertion.after).toBeTruthy();
      }
    }
  });
});
