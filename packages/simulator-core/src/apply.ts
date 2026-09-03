import type { SimulatorEvent, SimulatorEventType } from './events.ts';
import type { AccountState, SimulatorState } from './state.ts';
import {
  appointmentBooked,
  appointmentCancelled,
  appointmentRescheduled,
  appointmentStatusChanged,
} from './reducers/appointments.ts';
import { contactCreated, contactUpdated, tagAdded, tagRemoved } from './reducers/contacts.ts';
import { emailOpened, emailSent, smsReceived, smsSent } from './reducers/conversations.ts';
import {
  formSubmitted,
  surveySubmitted,
  webhookReceived,
  webhookResponse,
} from './reducers/intake.ts';
import {
  opportunityCreated,
  opportunityUpdated,
  pipelineStageChanged,
} from './reducers/opportunities.ts';
import { paymentFailed, paymentReceived, refundIssued } from './reducers/payments.ts';
import { result, type Reducer, type ReducerResult } from './reducers/shared.ts';
import { workflowEnrolled, workflowExited, workflowStepCompleted } from './reducers/workflows.ts';

/**
 * The transition (spec §42, SIM-003):
 *
 *   State + Event + Configuration → Transition → New State + Generated Events + Execution Records
 *
 * `applyEvent` is pure. It never calls Claude, mutates a global, reads the system clock, draws
 * uncontrolled randomness or performs a request, and it never mutates the state it is given —
 * every reducer returns new objects along the path it changed. That is what makes the simulator
 * testable, replayable and gradable.
 */

/** The clock's own event: it moves time and records nothing about the account. */
const timeAdvanced: Reducer = (account, event) =>
  result(account, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: { to: event.at, reason: event.payload.reason ?? null },
    },
  ]);

const REDUCERS: Record<SimulatorEventType, Reducer> = {
  CONTACT_CREATED: contactCreated,
  CONTACT_UPDATED: contactUpdated,
  TAG_ADDED: tagAdded,
  TAG_REMOVED: tagRemoved,
  FORM_SUBMITTED: formSubmitted,
  SURVEY_SUBMITTED: surveySubmitted,
  APPOINTMENT_BOOKED: appointmentBooked,
  APPOINTMENT_RESCHEDULED: appointmentRescheduled,
  APPOINTMENT_CANCELLED: appointmentCancelled,
  APPOINTMENT_STATUS_CHANGED: appointmentStatusChanged,
  SMS_SENT: smsSent,
  SMS_RECEIVED: smsReceived,
  EMAIL_SENT: emailSent,
  EMAIL_OPENED: emailOpened,
  OPPORTUNITY_CREATED: opportunityCreated,
  OPPORTUNITY_UPDATED: opportunityUpdated,
  PIPELINE_STAGE_CHANGED: pipelineStageChanged,
  PAYMENT_RECEIVED: paymentReceived,
  PAYMENT_FAILED: paymentFailed,
  REFUND_ISSUED: refundIssued,
  TIME_ADVANCED: timeAdvanced,
  WORKFLOW_ENROLLED: workflowEnrolled,
  WORKFLOW_STEP_COMPLETED: workflowStepCompleted,
  WORKFLOW_EXITED: workflowExited,
  WEBHOOK_RECEIVED: webhookReceived,
  WEBHOOK_RESPONSE: webhookResponse,
};

/** Every catalogue type has a reducer; the type system proves it and this exposes it to tests. */
export const REDUCED_EVENT_TYPES = Object.keys(REDUCERS) as SimulatorEventType[];

/**
 * Applies one event to the account. The caller owns identity, ordering, the clock and the queue;
 * this decides only what the account becomes and what the event produced.
 */
export function applyEvent(
  account: AccountState,
  event: SimulatorEvent,
  state: SimulatorState,
): ReducerResult {
  return REDUCERS[event.type](account, event, state);
}
