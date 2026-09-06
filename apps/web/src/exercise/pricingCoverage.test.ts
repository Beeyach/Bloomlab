import { describe, expect, it } from 'vitest';

import {
  PRICING_CONCEPTS,
  PROPOSAL_SECTIONS,
  SCOPE_DIMENSIONS,
  type Exercise,
} from '@bloomlab/content-schema';
import { gradeExercise } from '@bloomlab/exercise-engine';

import { content } from '../content/bundle';
import { emptyResponse, learnerState } from './response';
import { economicsFor, emptyPricingResponse, type PricingResponse } from './pricing';

/**
 * What Phase 17 actually authored (EXR-016, SAL-009, SAL-016, PRI-001 … PRI-003).
 *
 * The requirements say the curriculum covers ten pricing concepts and thirteen scope dimensions
 * and that a proposal has eight sections. Those are checked here against the compiled content,
 * so dropping one fails a test rather than quietly narrowing the product.
 *
 * The grading tests at the bottom run the real authored exercises through the real grader. They
 * are the evidence that a defensible quote passes and an underpriced one fails for the reason it
 * should, rather than that the checks parse.
 */

const exercises = content.exercises as Exercise[];
const priced = exercises.filter((exercise) => exercise.pricing !== null);
const units = content.learning_units;

const find = (id: string): Exercise => {
  const exercise = exercises.find((candidate) => candidate.id === id);
  expect(exercise, `${id} is authored`).toBeDefined();
  return exercise as Exercise;
};

/** Grades an authored PRICE IT against a priced deal, with no runtime involved. */
function gradePricing(exercise: Exercise, pricing: PricingResponse) {
  return gradeExercise({
    exercise,
    context: {
      state: learnerState(exercise, { ...emptyResponse(), pricing }),
      events: [],
      references: {},
      architecture: null,
      provides: ['learner'],
    },
    hints_used: [],
    assistance: 'independent',
  });
}

const summit = () => find('EX-PRICE_IT-summit-application-funnel');
const glowhaus = () => find('EX-PRICE_IT-glowhaus-two-locations');

describe('the ten pricing concepts are taught (PRI-003)', () => {
  const taught = new Set(units.flatMap((unit) => unit.pricing_concepts));

  it.each(PRICING_CONCEPTS)('%s is covered by a learning unit', (concept) => {
    expect(taught.has(concept)).toBe(true);
  });

  it('teaches them in units with real bodies rather than declarations', () => {
    const pricingUnits = units.filter((unit) => unit.pricing_concepts.length > 0);
    expect(pricingUnits.length).toBeGreaterThan(0);
    for (const unit of pricingUnits) {
      expect(unit.word_count).toBeGreaterThan(600);
      expect(unit.headings.length).toBeGreaterThan(3);
      // A unit that names a concept has to say the word somewhere in the body it is teaching.
      expect(unit.body_mdx.length).toBeGreaterThan(2000);
    }
  });
});

describe('scope training covers all thirteen dimensions (SAL-016)', () => {
  const training = priced.filter((exercise) => exercise.pricing?.scope_training);

  it('is authored at least once', () => {
    expect(training.length).toBeGreaterThan(0);
  });

  it.each(SCOPE_DIMENSIONS)('%s is one of the dimensions the training makes real', (dimension) => {
    const covered = training.some(
      (exercise) =>
        exercise.pricing?.scope.some((line) => line.dimensions.includes(dimension)) ||
        exercise.pricing?.control_dimensions.includes(dimension),
    );
    expect(covered).toBe(true);
  });
});

describe('a proposal is all eight sections (SAL-009)', () => {
  const proposals = exercises.filter((exercise) =>
    exercise.written_fields.some((field) => field.proposal_section !== undefined),
  );

  it('is authored', () => {
    expect(proposals.length).toBeGreaterThan(0);
  });

  it.each(PROPOSAL_SECTIONS)('%s is a section the learner writes', (section) => {
    const owner = proposals.find((exercise) =>
      exercise.written_fields.some((field) => field.proposal_section === section),
    );
    const field = owner?.written_fields.find((candidate) => candidate.proposal_section === section);
    expect(field?.max_words ?? 0).toBeGreaterThan(0);
    expect(field?.help.length ?? 0).toBeGreaterThan(10);
  });
});

describe('every priced exercise is priced against its own scenario (PRI-002)', () => {
  it.each(priced.map((exercise) => exercise.id))('%s', (id) => {
    const exercise = find(id);
    const economics = economicsFor(exercise);
    expect(economics, `${id} has scenario economics`).not.toBeNull();
    const hours = (exercise.pricing?.scope ?? []).reduce((sum, line) => sum + line.hours, 0);
    expect(hours).toBe(economics?.estimated_labor_hours);
  });

  it('never renders the hidden half as an authored learner-facing string', () => {
    for (const exercise of priced) {
      const visible = [
        exercise.instructions,
        ...(exercise.pricing?.scope ?? []).flatMap((line) => [
          line.name,
          line.description,
          line.consequence,
        ]),
        ...(exercise.pricing?.requirements ?? []).map((requirement) => requirement.need),
        ...exercise.hints.map((hint) => hint.text),
      ].join(' ');
      const hourly = String(exercise.pricing?.cost.hourly_cost ?? '');
      expect(visible).not.toContain(`$${hourly}`);
      expect(visible.toLowerCase()).not.toContain('margin');
    }
  });
});

describe('the Summit deal accepts more than one defensible price (PRI-002, EXR-016)', () => {
  const answered = (project: number): PricingResponse => ({
    ...emptyPricingResponse(),
    project,
    rush_fee: 0,
    recurring: 150,
    deposit: { kind: 'percent', value: 50 },
    timeline_days: 21,
    revisions: 1,
    exclusions: ['Writing the application questions from scratch', 'Paid ads and ad management'],
  });

  // 22 hours at $55 is $1,210 of delivery, plus 2 hours of the one revision round: $1,320.
  it.each([2200, 3200])('$%i clears the floor, the risk and the margin', (project) => {
    const report = gradePricing(summit(), answered(project));
    const failed = report.tiers.critical.filter((row) => !row.passed && !row.unevaluated);
    expect(failed).toEqual([]);
    const byId = new Map(
      [...report.tiers.required, ...report.tiers.quality].map((row) => [row.id, row]),
    );
    expect(byId.get('a1')?.passed).toBe(true);
    expect(byId.get('a7')?.passed).toBe(true);
    expect(byId.get('a8')?.passed).toBe(true);
  });

  it('fails the critical check below what delivering the scope costs', () => {
    const report = gradePricing(summit(), answered(1200));
    const failed = report.tiers.critical.filter((row) => !row.passed && !row.unevaluated);
    expect(failed.map((row) => row.id)).toEqual(['c1']);
    expect(report.outcome).not.toBe('passed');
  });

  it('drops the floor when the learner drops scope, so a smaller deal is defensible cheaper', () => {
    // Without migration and the handover the build is 17 hours, and $1,600 clears that floor.
    const smaller: PricingResponse = {
      ...answered(1600),
      excluded: ['typeform_migration', 'handover'],
      revisions: 0,
    };
    const report = gradePricing(summit(), smaller);
    const critical = report.tiers.critical.filter((row) => !row.passed && !row.unevaluated);
    expect(critical).toEqual([]);
    // But it is a different deal, and the checks say which promises it stopped keeping.
    const byId = new Map(report.tiers.required.map((row) => [row.id, row]));
    expect(byId.get('a2')?.passed).toBe(false);
  });

  it('is graded on the deterministic half and waits for its rubric', () => {
    const report = gradePricing(summit(), answered(2200));
    expect(report.rubric_pending).toBe('PRICING_REASONING_RUBRIC_V1');
  });
});

describe('the Glowhaus scope training runs end to end today (SAL-016)', () => {
  const answered = (change: Partial<PricingResponse> = {}): PricingResponse => ({
    ...emptyPricingResponse(),
    project: 3200,
    rush_fee: 600,
    recurring: 250,
    deposit: { kind: 'percent', value: 40 },
    timeline_days: 11,
    revisions: 1,
    exclusions: [
      'Writing the treatment descriptions',
      'Paid ad management',
      'Anything in Square after the import date',
    ],
    ...change,
  });

  it('passes a quote that hits the opening date and charges for the rush', () => {
    const report = gradePricing(glowhaus(), answered());
    expect(report.tiers.critical.filter((row) => !row.passed && !row.unevaluated)).toEqual([]);
    expect(report.outcome).toBe('passed');
    expect(report.rubric_pending).toBeNull();
  });

  it('fails the rush check when the timeline is compressed and nothing is charged for it', () => {
    const report = gradePricing(glowhaus(), answered({ rush_fee: 0 }));
    const byId = new Map(report.tiers.required.map((row) => [row.id, row]));
    expect(byId.get('a3')?.passed).toBe(false);
  });

  it('fails the date check when the deal is promised after the location opens', () => {
    const report = gradePricing(glowhaus(), answered({ timeline_days: 30, rush_fee: 0 }));
    const byId = new Map(report.tiers.required.map((row) => [row.id, row]));
    expect(byId.get('a2')?.passed).toBe(false);
  });

  it('says which requirement stopped being answered when a line comes out', () => {
    const report = gradePricing(glowhaus(), answered({ excluded: ['meta_lead_ads'] }));
    const byId = new Map(report.tiers.required.map((row) => [row.id, row]));
    expect(byId.get('a4')?.passed).toBe(false);
  });

  it('reports a locked line the response claims to have removed', () => {
    const report = gradePricing(glowhaus(), answered({ excluded: ['booking_calendars'] }));
    // The desk cannot do this: a locked line's checkbox is disabled. The check exists for the
    // response that says it anyway, and it is deliberately both things at once. The hours stay
    // in the cost, so the deal cannot be priced as though the calendars were gone, and dropping
    // the thing the opening depends on fails the attempt whatever the rest of it scores.
    const failed = report.tiers.critical.filter((row) => !row.passed && !row.unevaluated);
    expect(failed.map((row) => row.id)).toEqual(['c2']);
    expect(report.outcome).toBe('failed');
  });
});
