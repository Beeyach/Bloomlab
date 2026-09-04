import { describe, expect, it } from 'vitest';

import {
  advanceTo,
  createRun,
  historyHash,
  processEvent,
  replay,
  type SimulatorState,
} from '../src/index.ts';
import { event, scenario } from './fixtures.ts';

/**
 * One shared account (SIM-001).
 *
 * A lead arrives through a form, becomes a contact, is tagged, gets an opportunity, receives a
 * message, books an appointment, pays, and the report counts all of it — and every one of those
 * changes lands in the *same* account and the *same* history. This is the property every later
 * Lab depends on: CRM, Conversations, Calendar, Payments and Reporting read this one state.
 *
 * The confirmation SMS is not injected by hand. Booking the appointment fires the workflow's
 * trigger, the engine walks the workflow, and the message in the conversation is the one the
 * Send SMS step produced (Phase 12). Nothing in the log was written by the test pretending to be
 * an engine.
 */

const at = (state: SimulatorState, minutes: number) => {
  const start = Date.parse('2026-09-03T09:00:00-05:00');
  return new Date(start + minutes * 60_000).toISOString();
};

function fullJourney(): SimulatorState {
  let state = createRun(scenario());

  // 1. A lead fills in the consultation form. That creates the contact.
  state = processEvent(
    state,
    event('FORM_SUBMITTED', at(state, 0), {
      form_id: 'consult-request',
      contact_id: 'nina',
      values: {
        first_name: 'Nina',
        phone: '+15125550123',
        email: 'nina@example.com',
        treatment_interest: 'Membership',
      },
    }),
  );

  // 2. The lead is tagged and an opportunity opens on the shared pipeline.
  state = advanceTo(state, at(state, 5));
  state = processEvent(
    state,
    event('TAG_ADDED', state.clock.now, { contact_id: 'nina', tag: 'meta-lead' }),
  );
  state = processEvent(
    state,
    event('OPPORTUNITY_CREATED', state.clock.now, {
      opportunity_id: 'opp-nina',
      contact_id: 'nina',
      pipeline_id: 'consultations',
      stage: 'New Lead',
      value: 410,
    }),
  );

  // 3. The appointment is booked on the shared calendar. That fires the Booking Confirmation
  //    workflow, which sends the confirmation SMS and tags the contact.
  state = processEvent(
    state,
    event('APPOINTMENT_BOOKED', state.clock.now, {
      appointment_id: 'appt-nina',
      contact_id: 'nina',
      calendar_id: 'consultation',
      starts_at: '2026-09-05T15:00:00-05:00',
    }),
  );

  // 4. The lead replies to the confirmation.
  state = advanceTo(state, at(state, 20));
  state = processEvent(
    state,
    event('SMS_RECEIVED', state.clock.now, { contact_id: 'nina', body: 'See you then' }),
  );

  // 5. The appointment is attended.
  state = advanceTo(state, '2026-09-05T15:45:00-05:00');
  state = processEvent(
    state,
    event('APPOINTMENT_STATUS_CHANGED', state.clock.now, {
      appointment_id: 'appt-nina',
      status: 'showed',
    }),
  );

  // 6. The opportunity moves and the payment lands.
  state = processEvent(
    state,
    event('PIPELINE_STAGE_CHANGED', state.clock.now, {
      opportunity_id: 'opp-nina',
      stage: 'Showed',
    }),
  );
  state = processEvent(
    state,
    event('PAYMENT_RECEIVED', state.clock.now, {
      payment_id: 'pay-nina',
      contact_id: 'nina',
      product_id: 'facial',
      amount: 410,
    }),
  );
  return state;
}

describe('one shared simulated account (SIM-001)', () => {
  const state = fullJourney();

  it('holds every domain the journey touched in one account', () => {
    expect(state.account.contacts.nina?.email).toBe('nina@example.com');
    expect(state.account.contacts.nina?.tags).toContain('meta-lead');
    expect(state.account.contacts.nina?.tags).toContain('booked');
    expect(state.account.contacts.nina?.custom_fields.treatment_interest).toBe('Membership');
    expect(state.account.opportunities['opp-nina']?.stage).toBe('Showed');
    expect(state.account.conversations.nina?.messages).toHaveLength(2);
    expect(state.account.appointments['appt-nina']?.status).toBe('showed');
    expect(state.account.payments['pay-nina']?.status).toBe('received');
    expect(Object.values(state.account.workflow_runs)).toHaveLength(1);
    expect(Object.values(state.account.workflow_runs)[0]?.status).toBe('completed');
    expect(state.account.conversations.nina?.messages[0]).toMatchObject({
      body: 'You are booked.',
      workflow_id: 'wf-booking-confirmation',
    });
  });

  it('reports from what actually happened, not from invented analytics', () => {
    expect(state.account.analytics).toMatchObject({
      contacts_created: 1,
      forms_submitted: 1,
      opportunities_created: 1,
      messages_sent: 1,
      messages_received: 1,
      appointments_booked: 1,
      appointments_showed: 1,
      payments_received: 1,
      revenue: 410,
    });
  });

  it('keeps one history, in one order, across all of it', () => {
    const types = state.log.map((row) => row.type);
    expect(types.indexOf('FORM_SUBMITTED')).toBeLessThan(types.indexOf('CONTACT_CREATED'));
    expect(types.indexOf('CONTACT_CREATED')).toBeLessThan(types.indexOf('OPPORTUNITY_CREATED'));
    expect(types.indexOf('SMS_SENT')).toBeLessThan(types.indexOf('SMS_RECEIVED'));
    expect(types.indexOf('APPOINTMENT_BOOKED')).toBeLessThan(types.indexOf('PAYMENT_RECEIVED'));
    // One total order, no gaps, no repeats.
    expect(state.log.map((row) => row.sequence)).toEqual(
      [...state.log.map((row) => row.sequence)].sort((a, b) => a - b),
    );
    expect(new Set(state.log.map((row) => row.id)).size).toBe(state.log.length);
  });

  it('carries the whole journey through a replay unchanged', () => {
    const replayed = replay(scenario(), state.log, { run_id: state.run_id });
    expect(historyHash(replayed)).toBe(historyHash(state));
    expect(replayed.account.analytics.revenue).toBe(410);
  });

  it('does not disturb what the scenario already had, beyond what the run actually did', () => {
    // A shared account is only shared if adding to it leaves the rest intact. Maria keeps her
    // authored tag and her authored opportunity; the one change to her is the scenario's own
    // queued 10:00 event, which the journey's advance ran on the way past.
    expect(state.account.contacts.maria?.tags).toEqual(['meta-lead', 'no-show']);
    expect(state.log.some((row) => row.origin === 'scenario' && row.type === 'TAG_ADDED')).toBe(
      true,
    );
    expect(state.account.opportunities['opp-maria']?.stage).toBe('Booked');
    expect(state.account.contacts.maria?.email).toBe('maria@example.com');
  });
});
