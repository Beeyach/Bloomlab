import { describe, expect, it } from 'vitest';

import { applyEvent } from '../src/apply.ts';
import { isSimulatorError, type SimulatorError } from '../src/errors.ts';
import {
  SLOT_COUNT,
  bookableSlots,
  canCreateContact,
  firstStep,
  reachableSteps,
  readingOrder,
  stepAfter,
  validateFunnel,
  visitorActions,
} from '../src/index.ts';
import { initialAccount } from '../src/scenario.ts';
import { createRun, processEvent } from '../src/run.ts';
import type { AccountState, Funnel, SimulatorEvent } from '../src/state.ts';
import { funnelScenario } from './fixtures.ts';

/**
 * Funnels in the engine (FUN-001, FUN-002, D-119).
 *
 * Definitions are account events, validated the way workflow definitions are; validation is what
 * decides whether a visitor can walk one; and the visitor's offered actions come from the
 * architecture rather than from a screen.
 */

const account = (): AccountState => initialAccount(funnelScenario());

const event = (type: SimulatorEvent['type'], payload: Record<string, unknown>): SimulatorEvent => ({
  id: 'e-1',
  sequence: 1,
  type,
  at: '2026-09-08T09:00:00-05:00',
  origin: 'injected',
  source: { kind: 'injector_action', id: 'test' },
  payload,
});

const funnel = (steps: Funnel['steps']): Record<string, unknown> => ({
  id: 'fn-1',
  name: 'Consultation funnel',
  steps,
});

const capture = (blocks: unknown[] = [], next: string | null = null) => ({
  id: 'st-capture',
  name: 'Consultation offer',
  purpose: 'capture',
  blocks,
  next_step_id: next,
});

const booking = (blocks: unknown[] = []) => ({
  id: 'st-booking',
  name: 'Pick a time',
  purpose: 'booking',
  blocks,
  next_step_id: null,
});

const refusal = (run: () => unknown): SimulatorError => {
  try {
    run();
  } catch (error) {
    if (isSimulatorError(error)) return error;
    throw error;
  }
  throw new Error('expected a refusal');
};

describe('a funnel definition is an account event (D-119)', () => {
  it('creates a funnel at version 1 and records what it holds', () => {
    const result = applyEvent(
      account(),
      event('FUNNEL_CREATED', {
        funnel: funnel([
          capture([{ id: 'b1', role: 'headline', headline: 'Book a consultation' }], 'st-booking'),
          booking([{ id: 'b2', role: 'calendar', reference_id: 'consultation' }]),
        ]),
      }),
      createRun(funnelScenario()),
    );
    const saved = result.account.funnels['fn-1'];
    expect(saved?.version).toBe(1);
    expect(saved?.steps).toHaveLength(2);
    expect(result.records[0]?.data).toMatchObject({ funnel_id: 'fn-1', steps: 2, blocks: 2 });
  });

  it('bumps the version on an update, so a grade of version 2 still says version 2', () => {
    let state = createRun(funnelScenario());
    state = processEvent(state, {
      type: 'FUNNEL_CREATED',
      at: state.clock.now,
      origin: 'injected',
      source: { kind: 'injector_action', id: 'test' },
      payload: { funnel: funnel([capture([{ id: 'b1', role: 'headline' }])]) },
    });
    state = processEvent(state, {
      type: 'FUNNEL_UPDATED',
      at: state.clock.now,
      origin: 'injected',
      source: { kind: 'injector_action', id: 'test' },
      payload: {
        funnel_id: 'fn-1',
        funnel: funnel([
          capture([
            { id: 'b1', role: 'headline' },
            { id: 'b2', role: 'proof' },
          ]),
        ]),
      },
    });
    expect(state.account.funnels['fn-1']?.version).toBe(2);
    expect(state.account.funnels['fn-1']?.steps[0]?.blocks).toHaveLength(2);
  });

  it('refuses a second funnel with the same id', () => {
    let state = createRun(funnelScenario());
    const create = {
      type: 'FUNNEL_CREATED' as const,
      at: state.clock.now,
      origin: 'injected' as const,
      source: { kind: 'injector_action' as const, id: 'test' },
      payload: { funnel: funnel([capture([{ id: 'b1', role: 'headline' }])]) },
    };
    state = processEvent(state, create);
    expect(refusal(() => processEvent(state, create)).code).toBe('DUPLICATE_ENTITY');
  });

  it('refuses a capture block that names an entity the account does not hold', () => {
    const error = refusal(() =>
      applyEvent(
        account(),
        event('FUNNEL_CREATED', {
          funnel: funnel([capture([{ id: 'b1', role: 'form', reference_id: 'no-such-form' }])]),
        }),
        createRun(funnelScenario()),
      ),
    );
    expect(error.code).toBe('UNKNOWN_ENTITY');
    expect(error.message).toContain('no-such-form');
  });

  it('refuses a destination that names a step this funnel does not have', () => {
    expect(
      refusal(() =>
        applyEvent(
          account(),
          event('FUNNEL_CREATED', {
            funnel: funnel([capture([{ id: 'b1', role: 'headline' }], 'st-elsewhere')]),
          }),
          createRun(funnelScenario()),
        ),
      ).code,
    ).toBe('UNKNOWN_ENTITY');
  });

  it('refuses an unknown block role and an unknown step purpose', () => {
    expect(
      refusal(() =>
        applyEvent(
          account(),
          event('FUNNEL_CREATED', {
            funnel: funnel([capture([{ id: 'b1', role: 'testimonial-carousel' }])]),
          }),
          createRun(funnelScenario()),
        ),
      ).code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        applyEvent(
          account(),
          event('FUNNEL_CREATED', {
            funnel: funnel([{ ...capture(), purpose: 'upsell' }]),
          }),
          createRun(funnelScenario()),
        ),
      ).code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('refuses a reference on a role that uses no account entity', () => {
    expect(
      refusal(() =>
        applyEvent(
          account(),
          event('FUNNEL_CREATED', {
            funnel: funnel([
              capture([{ id: 'b1', role: 'proof', reference_id: 'consult-request' }]),
            ]),
          }),
          createRun(funnelScenario()),
        ),
      ).code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('saves a half-built funnel: a block with no reference yet is allowed', () => {
    const result = applyEvent(
      account(),
      event('FUNNEL_CREATED', { funnel: funnel([capture([{ id: 'b1', role: 'form' }])]) }),
      createRun(funnelScenario()),
    );
    expect(result.account.funnels['fn-1']?.steps[0]?.blocks[0]?.reference_id).toBeNull();
  });
});

describe('validation decides whether a visitor can walk it', () => {
  const built = (steps: Funnel['steps']): Funnel => ({
    id: 'fn-1',
    name: 'Consultation funnel',
    steps,
    version: 1,
  });

  it('says a funnel with no steps cannot be walked', () => {
    const issues = validateFunnel(built([]), account());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('NO_STEPS');
    expect(issues[0]?.severity).toBe('error');
  });

  it('reports a form block with nothing connected as an error, naming its step', () => {
    const issues = validateFunnel(
      built([
        {
          id: 'st-1',
          name: 'Offer',
          purpose: 'capture',
          blocks: [
            {
              id: 'b1',
              role: 'form',
              headline: null,
              body: null,
              reference_id: null,
              target_step_id: null,
            },
          ],
          next_step_id: null,
        },
      ]),
      account(),
    );
    const missing = issues.find((issue) => issue.code === 'MISSING_REFERENCE');
    expect(missing?.severity).toBe('error');
    expect(missing?.step_id).toBe('st-1');
    expect(missing?.block_id).toBe('b1');
  });

  it('reports a step nothing sends the visitor to', () => {
    const issues = validateFunnel(
      built([
        {
          id: 'st-1',
          name: 'Offer',
          purpose: 'capture',
          blocks: [
            {
              id: 'b1',
              role: 'cta',
              headline: 'Go',
              body: null,
              reference_id: null,
              target_step_id: null,
            },
          ],
          next_step_id: null,
        },
        {
          id: 'st-2',
          name: 'Orphan',
          purpose: 'booking',
          blocks: [
            {
              id: 'b2',
              role: 'calendar',
              headline: null,
              body: null,
              reference_id: 'consultation',
              target_step_id: null,
            },
          ],
          next_step_id: null,
        },
      ]),
      account(),
    );
    expect(issues.find((issue) => issue.code === 'UNREACHABLE_STEP')?.step_id).toBe('st-2');
  });

  it('warns rather than blocks when a step never asks for anything', () => {
    const issues = validateFunnel(
      built([
        {
          id: 'st-1',
          name: 'Reading',
          purpose: 'content',
          blocks: [
            {
              id: 'b1',
              role: 'problem',
              headline: 'It is slow',
              body: null,
              reference_id: null,
              target_step_id: null,
            },
          ],
          next_step_id: null,
        },
      ]),
      account(),
    );
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(issues.some((issue) => issue.code === 'NO_ASK')).toBe(true);
  });

  it('warns when the checkout comes before the form that identifies the buyer', () => {
    const issues = validateFunnel(
      built([
        {
          id: 'st-1',
          name: 'Buy',
          purpose: 'checkout',
          blocks: [
            {
              id: 'b1',
              role: 'checkout',
              headline: null,
              body: null,
              reference_id: 'glow-membership',
              target_step_id: null,
            },
          ],
          next_step_id: 'st-2',
        },
        {
          id: 'st-2',
          name: 'Details',
          purpose: 'capture',
          blocks: [
            {
              id: 'b2',
              role: 'form',
              headline: null,
              body: null,
              reference_id: 'consult-request',
              target_step_id: null,
            },
          ],
          next_step_id: null,
        },
      ]),
      account(),
    );
    const found = issues.find((issue) => issue.code === 'CAPTURE_AFTER_CHECKOUT');
    expect(found?.severity).toBe('warning');
    expect(found?.step_id).toBe('st-2');
  });
});

describe('reading order and progression are the engine’s, not a screen’s', () => {
  const twoStep: Funnel = {
    id: 'fn-1',
    name: 'Consultation funnel',
    version: 1,
    steps: [
      {
        id: 'st-1',
        name: 'Offer',
        purpose: 'capture',
        blocks: [
          {
            id: 'b1',
            role: 'headline',
            headline: 'Book',
            body: null,
            reference_id: null,
            target_step_id: null,
          },
          {
            id: 'b2',
            role: 'form',
            headline: null,
            body: null,
            reference_id: 'consult-request',
            target_step_id: null,
          },
          {
            id: 'b3',
            role: 'cta',
            headline: 'Skip',
            body: null,
            reference_id: null,
            target_step_id: 'st-3',
          },
        ],
        next_step_id: 'st-2',
      },
      {
        id: 'st-2',
        name: 'Pick a time',
        purpose: 'booking',
        blocks: [
          {
            id: 'b4',
            role: 'calendar',
            headline: null,
            body: null,
            reference_id: 'consultation',
            target_step_id: null,
          },
        ],
        next_step_id: 'st-3',
      },
      {
        id: 'st-3',
        name: 'Thanks',
        purpose: 'confirmation',
        blocks: [
          {
            id: 'b5',
            role: 'headline',
            headline: 'See you',
            body: null,
            reference_id: null,
            target_step_id: null,
          },
        ],
        next_step_id: null,
      },
    ],
  };

  it('reads steps in order and blocks in theirs', () => {
    expect(readingOrder(twoStep).map((row) => row.block.id)).toEqual([
      'b1',
      'b2',
      'b3',
      'b4',
      'b5',
    ]);
  });

  it('starts on the first step and follows the step’s destination', () => {
    expect(firstStep(twoStep)?.id).toBe('st-1');
    expect(stepAfter(twoStep, 'st-1')).toBe('st-2');
    expect(stepAfter(twoStep, 'st-3')).toBeNull();
  });

  it('lets a call to action branch away from the step’s own destination', () => {
    expect(stepAfter(twoStep, 'st-1', 'b3')).toBe('st-3');
    expect(stepAfter(twoStep, 'st-1', 'b2')).toBe('st-2');
  });

  it('counts every step a visitor can reach', () => {
    expect([...reachableSteps(twoStep)].sort()).toEqual(['st-1', 'st-2', 'st-3']);
  });

  it('offers exactly the actions the architecture contains, with the form’s own fields', () => {
    const actions = visitorActions(twoStep, account(), 'st-1', '2026-09-08T09:00:00-05:00');
    expect(actions.map((action) => action.kind)).toEqual(['submit_form', 'advance']);
    const submit = actions[0];
    if (submit?.kind !== 'submit_form') throw new Error('expected a form action');
    expect(submit.form_id).toBe('consult-request');
    expect(submit.fields).toEqual([
      'first_name',
      'last_name',
      'email',
      'phone',
      'treatment_interest',
    ]);
    expect(submit.to_step_id).toBe('st-2');
  });

  it('offers nothing for a capture block that is not connected yet', () => {
    const unconnected: Funnel = {
      ...twoStep,
      steps: [
        {
          ...twoStep.steps[0]!,
          blocks: [
            {
              id: 'b2',
              role: 'form',
              headline: null,
              body: null,
              reference_id: null,
              target_step_id: null,
            },
          ],
        },
      ],
    };
    expect(visitorActions(unconnected, account(), 'st-1', '2026-09-08T09:00:00-05:00')).toEqual([]);
  });
});

describe('booking slots come from the run’s clock and the shared calendar engine (D-129)', () => {
  it('offers the calendar’s real openings, honouring its minimum notice', () => {
    const slots = bookableSlots(account(), 'consultation', '2026-09-08T09:20:00-05:00');
    expect(slots).toHaveLength(SLOT_COUNT);
    // 30-minute appointments on a 09:00–17:00 Tuesday, an hour's notice from 09:20.
    expect(slots.map((slot) => slot.starts_at)).toEqual([
      '2026-09-08T10:30:00-05:00',
      '2026-09-08T11:00:00-05:00',
      '2026-09-08T11:30:00-05:00',
      '2026-09-08T12:00:00-05:00',
      '2026-09-08T12:30:00-05:00',
      '2026-09-08T13:00:00-05:00',
    ]);
    expect(slots[0]?.ends_at).toBe('2026-09-08T11:00:00-05:00');
    expect(slots[0]?.duration_minutes).toBe(30);
  });

  it('rolls to the next working day when the run’s clock is past closing', () => {
    const slots = bookableSlots(account(), 'consultation', '2026-09-08T21:00:00-05:00');
    expect(slots[0]?.starts_at).toBe('2026-09-09T09:00:00-05:00');
  });

  it('gives the same answer every time it is asked', () => {
    const once = bookableSlots(account(), 'consultation', '2026-09-08T09:20:00-05:00');
    const twice = bookableSlots(account(), 'consultation', '2026-09-08T09:20:00-05:00');
    expect(once).toEqual(twice);
  });

  it('offers nothing for a calendar the account does not hold', () => {
    expect(bookableSlots(account(), 'no-such-calendar', '2026-09-08T09:20:00-05:00')).toEqual([]);
  });
});

describe('a new contact needs a name before a submission can create one', () => {
  it('says so before the event is built', () => {
    expect(canCreateContact({ email: 'a@example.com' })).toBe(false);
    expect(canCreateContact({ first_name: '   ' })).toBe(false);
    expect(canCreateContact({ first_name: 'Nadia' })).toBe(true);
  });
});
