import { slotsForCalendar, type Slot } from '../calendar/availability.ts';
import { type AccountState, type Funnel, type FunnelBlock, type FunnelStep } from '../state.ts';
import { stepAfter, stepOf } from './graph.ts';

/**
 * What a visitor can do on a funnel step, and what each of those things means (FUN-001, FUN-003).
 *
 * This is simulation, so it lives here rather than in the Lab. The Lab renders these actions and
 * collects what the visitor typed; the engine decides what the funnel offers, which account
 * entity each offer uses, and where completing it sends the visitor next. React never invents an
 * action the architecture does not contain.
 *
 * Nothing here produces an event. The Lab turns a chosen action plus the visitor's answers into
 * a real `FORM_SUBMITTED`, `SURVEY_SUBMITTED`, `APPOINTMENT_BOOKED` or `PAYMENT_RECEIVED` and
 * hands it to the one execution door — so the same reducers, the same validation and the same
 * workflow reactions apply as when anything else in the account fires them.
 */

export type VisitAction =
  | {
      kind: 'submit_form';
      block_id: string;
      form_id: string;
      /** The fields the referenced form actually has. Nothing else may be submitted. */
      fields: string[];
      to_step_id: string | null;
    }
  | {
      kind: 'submit_survey';
      block_id: string;
      survey_id: string;
      fields: string[];
      to_step_id: string | null;
    }
  | {
      kind: 'book';
      block_id: string;
      calendar_id: string;
      /**
       * What the shared availability engine says is bookable, from the run's own clock. The
       * visitor sees the learner's real calendar configuration — hours, duration, buffers,
       * notice, who is free — because there is one answer to this question (D-129).
       */
      slots: Slot[];
      to_step_id: string | null;
    }
  | {
      kind: 'checkout';
      block_id: string;
      product_id: string;
      amount: number;
      recurring: boolean;
      to_step_id: string | null;
    }
  | { kind: 'advance'; block_id: string; to_step_id: string | null };

/**
 * How many openings a funnel's calendar block offers a visitor.
 *
 * A funnel page is not a scheduling tool: it shows the next few real openings and books one.
 * Phase 13 computed those from a hardcoded nine-to-five rule of its own, which is exactly the
 * kind of second answer this codebase refuses to keep. Phase 14 retired it — the engine below is
 * the same one Calendar Lab uses, so changing the calendar's hours, duration, buffers, notice or
 * team changes what the visitor is offered (D-129).
 */
export const SLOT_COUNT = 6;

export function bookableSlots(account: AccountState, calendarId: string, now: string): Slot[] {
  return slotsForCalendar(account, calendarId, now, { limit: SLOT_COUNT });
}

/** Everything the visitor can do on this step, in the order the blocks appear. */
export function visitorActions(
  funnel: Funnel,
  account: AccountState,
  stepId: string,
  now: string,
): VisitAction[] {
  const step = stepOf(funnel, stepId);
  if (!step) return [];
  const actions: VisitAction[] = [];
  for (const block of step.blocks) {
    const action = actionFor(funnel, account, step, block, now);
    if (action) actions.push(action);
  }
  return actions;
}

function actionFor(
  funnel: Funnel,
  account: AccountState,
  step: FunnelStep,
  block: FunnelBlock,
  now: string,
): VisitAction | null {
  const to = stepAfter(funnel, step.id, block.id);
  switch (block.role) {
    case 'form': {
      const form = block.reference_id ? account.forms[block.reference_id] : undefined;
      if (!form) return null;
      return {
        kind: 'submit_form',
        block_id: block.id,
        form_id: form.id,
        fields: [...form.fields],
        to_step_id: to,
      };
    }
    case 'survey': {
      const survey = block.reference_id ? account.surveys[block.reference_id] : undefined;
      if (!survey) return null;
      return {
        kind: 'submit_survey',
        block_id: block.id,
        survey_id: survey.id,
        fields: [...survey.fields],
        to_step_id: to,
      };
    }
    case 'calendar': {
      const calendar = block.reference_id ? account.calendars[block.reference_id] : undefined;
      if (!calendar) return null;
      return {
        kind: 'book',
        block_id: block.id,
        calendar_id: calendar.id,
        slots: bookableSlots(account, calendar.id, now),
        to_step_id: to,
      };
    }
    case 'checkout': {
      const product = block.reference_id ? account.products[block.reference_id] : undefined;
      if (!product) return null;
      return {
        kind: 'checkout',
        block_id: block.id,
        product_id: product.id,
        amount: product.price,
        recurring: product.recurring,
        to_step_id: to,
      };
    }
    case 'cta':
      return { kind: 'advance', block_id: block.id, to_step_id: to };
    default:
      return null;
  }
}

/**
 * Whether the visitor can be identified well enough for a submission to create a new contact.
 * The intake reducer refuses a submission that would create a contact with no first name; this
 * says so before the event is built, so the Lab can explain it instead of showing a refusal.
 */
export const canCreateContact = (values: Record<string, unknown>): boolean =>
  typeof values.first_name === 'string' && values.first_name.trim().length > 0;
