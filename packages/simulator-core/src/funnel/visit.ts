import { addMinutes, instant, instantForDay, partsIn, toZone } from '../time.ts';
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
      /** Bookable instants, derived from the run's own clock — never the device's. */
      slots: string[];
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
 * Booking slots for a calendar block, computed from the run's clock and the calendar's duration.
 *
 * Phase 13 needs a visitor to be able to book from a funnel; Phase 14 owns availability, buffers,
 * minimum notice, staff and round robin. So this is the smallest honest rule and is labelled as
 * such wherever it is shown: the next three openings on the hour, starting from the first whole
 * hour at least one hour after the run's current instant, inside a 9-to-5 day in the calendar's
 * own zone. Deterministic, no randomness, no wall clock.
 */
export const SLOT_COUNT = 3;
const DAY_OPENS = 9;
const DAY_CLOSES = 17;

export function bookableSlots(account: AccountState, calendarId: string, now: string): string[] {
  const calendar = account.calendars[calendarId];
  if (!calendar) return [];
  const zone = calendar.timezone ?? account.account.timezone;
  const slots: string[] = [];
  // Start at the first whole hour at least an hour out, then walk hour by hour, skipping the
  // hours outside the working day. A bounded walk: at most a week of hours is ever examined.
  const opening = addMinutes(toZone(now, zone), 60, zone);
  const parts = partsIn(instant(opening), zone);
  const day = `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
  const whole = parts.minute === 0 && parts.second === 0 ? parts.hour : parts.hour + 1;
  let cursor = instantForDay(day, zone, Math.min(whole, 23), 0);
  if (whole > 23) cursor = addMinutes(cursor, 60, zone);
  for (let step = 0; step < 24 * 7 && slots.length < SLOT_COUNT; step += 1) {
    const at = partsIn(instant(cursor), zone);
    if (at.hour >= DAY_OPENS && at.hour < DAY_CLOSES) slots.push(cursor);
    cursor = addMinutes(cursor, 60, zone);
  }
  return slots;
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

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/**
 * Whether the visitor can be identified well enough for a submission to create a new contact.
 * The intake reducer refuses a submission that would create a contact with no first name; this
 * says so before the event is built, so the Lab can explain it instead of showing a refusal.
 */
export const canCreateContact = (values: Record<string, unknown>): boolean =>
  typeof values.first_name === 'string' && values.first_name.trim().length > 0;
