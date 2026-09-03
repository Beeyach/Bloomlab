import { describe, expect, it } from 'vitest';

import { SimulatorError, createRun, processEvent, type SimulatorState } from '../src/index.ts';
import { NOW, event, scenario } from './fixtures.ts';

/** Real state transitions for every event Phase 10 owns (SIM-004, SIM-005). */

const run = () => createRun(scenario());

const at = (state: SimulatorState, type: string) => state.log.filter((row) => row.type === type);
const records = (state: SimulatorState, kind: string) =>
  state.execution.filter((row) => row.kind === kind);

/** The code a refusal carries, so a test asserts the reason rather than merely "it threw". */
function refusal(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    if (error instanceof SimulatorError) return error.code;
    throw error;
  }
  throw new Error('Expected the engine to refuse');
}

describe('contacts', () => {
  it('creates a contact that then exists in the shared account', () => {
    const state = processEvent(
      run(),
      event('CONTACT_CREATED', NOW, {
        contact_id: 'dana',
        first_name: 'Dana',
        phone: '+15125550190',
        tags: ['walk-in'],
      }),
    );
    expect(state.account.contacts.dana?.first_name).toBe('Dana');
    expect(state.account.contacts.dana?.created_at).toBe(NOW);
    expect(state.account.tags).toContain('walk-in');
    expect(state.account.analytics.contacts_created).toBe(1);
  });

  it('updates only the fields the event names', () => {
    const state = processEvent(
      run(),
      event('CONTACT_UPDATED', NOW, { contact_id: 'maria', phone: '+15125550001' }),
    );
    expect(state.account.contacts.maria?.phone).toBe('+15125550001');
    expect(state.account.contacts.maria?.email).toBe('maria@example.com');
    expect(state.account.contacts.maria?.updated_at).toBe(NOW);
  });

  it('refuses an update to a contact that does not exist', () => {
    expect(
      refusal(() => processEvent(run(), event('CONTACT_UPDATED', NOW, { contact_id: 'ghost' }))),
    ).toBe('UNKNOWN_ENTITY');
  });

  it('refuses a second contact with an id already in use', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('CONTACT_CREATED', NOW, { contact_id: 'maria', first_name: 'X' }),
        ),
      ),
    ).toBe('DUPLICATE_ENTITY');
  });

  it('refuses a custom field the account never defined', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('CONTACT_UPDATED', NOW, {
            contact_id: 'maria',
            custom_fields: { invented_field: 'x' },
          }),
        ),
      ),
    ).toBe('UNKNOWN_ENTITY');
  });

  it('refuses a create with no first name', () => {
    expect(
      refusal(() => processEvent(run(), event('CONTACT_CREATED', NOW, { contact_id: 'dana' }))),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('tags', () => {
  const add = (state: SimulatorState, tag: string) =>
    processEvent(state, event('TAG_ADDED', NOW, { contact_id: 'maria', tag }));

  it('associates a tag with a contact', () => {
    const state = add(run(), 'booked');
    expect(state.account.contacts.maria?.tags).toContain('booked');
    expect(records(state, 'step_completed')).toHaveLength(1);
  });

  it('adds a tag the contact already has exactly once, and says it skipped', () => {
    const state = add(add(run(), 'booked'), 'booked');
    expect(state.account.contacts.maria?.tags.filter((tag) => tag === 'booked')).toHaveLength(1);
    expect(records(state, 'action_skipped')[0]?.reason).toBe('tag_already_present');
  });

  it('removes a tag', () => {
    const state = processEvent(
      add(run(), 'booked'),
      event('TAG_REMOVED', NOW, { contact_id: 'maria', tag: 'booked' }),
    );
    expect(state.account.contacts.maria?.tags).not.toContain('booked');
  });

  it('records removing a tag the contact never had, without failing', () => {
    const state = processEvent(
      run(),
      event('TAG_REMOVED', NOW, { contact_id: 'maria', tag: 'never-had-this' }),
    );
    expect(records(state, 'action_skipped')[0]?.reason).toBe('tag_not_present');
  });

  it('refuses a tag on a contact that does not exist', () => {
    expect(
      refusal(() =>
        processEvent(run(), event('TAG_ADDED', NOW, { contact_id: 'ghost', tag: 'booked' })),
      ),
    ).toBe('UNKNOWN_ENTITY');
  });
});

describe('opportunities and pipelines', () => {
  it('creates an opportunity on a real pipeline stage', () => {
    const state = processEvent(
      run(),
      event('OPPORTUNITY_CREATED', NOW, {
        opportunity_id: 'opp-jordan',
        contact_id: 'jordan',
        pipeline_id: 'consultations',
        stage: 'New Lead',
        value: 149,
      }),
    );
    expect(state.account.opportunities['opp-jordan']?.stage).toBe('New Lead');
    expect(state.account.analytics.opportunities_created).toBe(1);
  });

  it('moves an opportunity between stages', () => {
    const state = processEvent(
      run(),
      event('PIPELINE_STAGE_CHANGED', NOW, { opportunity_id: 'opp-maria', stage: 'Showed' }),
    );
    expect(state.account.opportunities['opp-maria']?.stage).toBe('Showed');
    expect(records(state, 'step_completed')[0]?.data).toMatchObject({
      from_stage: 'Booked',
      to_stage: 'Showed',
    });
  });

  it('updates value and status', () => {
    const state = processEvent(
      run(),
      event('OPPORTUNITY_UPDATED', NOW, { opportunity_id: 'opp-maria', value: 500, status: 'won' }),
    );
    expect(state.account.opportunities['opp-maria']?.value).toBe(500);
    expect(state.account.opportunities['opp-maria']?.status).toBe('won');
  });

  it('refuses a stage the pipeline does not have', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('PIPELINE_STAGE_CHANGED', NOW, { opportunity_id: 'opp-maria', stage: 'Invented' }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('refuses a pipeline that does not exist', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('OPPORTUNITY_CREATED', NOW, {
            opportunity_id: 'opp-x',
            contact_id: 'maria',
            pipeline_id: 'nope',
            stage: 'New Lead',
          }),
        ),
      ),
    ).toBe('UNKNOWN_ENTITY');
  });
});

describe('appointments', () => {
  const book = (state: SimulatorState) =>
    processEvent(
      state,
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-jordan',
        contact_id: 'jordan',
        calendar_id: 'consultation',
        starts_at: '2026-09-05T15:00:00-05:00',
      }),
    );

  it('books an appointment', () => {
    const state = book(run());
    expect(state.account.appointments['appt-jordan']?.status).toBe('booked');
    expect(state.account.analytics.appointments_booked).toBe(1);
  });

  it('reschedules to a new time and returns the appointment to booked', () => {
    const confirmed = processEvent(
      book(run()),
      event('APPOINTMENT_STATUS_CHANGED', NOW, {
        appointment_id: 'appt-jordan',
        status: 'confirmed',
      }),
    );
    const state = processEvent(
      confirmed,
      event('APPOINTMENT_RESCHEDULED', NOW, {
        appointment_id: 'appt-jordan',
        starts_at: '2026-09-06T15:00:00-05:00',
      }),
    );
    expect(state.account.appointments['appt-jordan']?.starts_at).toBe('2026-09-06T15:00:00-05:00');
    expect(state.account.appointments['appt-jordan']?.status).toBe('booked');
  });

  it('cancels an appointment and counts it once', () => {
    const cancelled = processEvent(
      run(),
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-maria' }),
    );
    const twice = processEvent(
      cancelled,
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-maria' }),
    );
    expect(twice.account.appointments['appt-maria']?.status).toBe('cancelled');
    expect(twice.account.analytics.appointments_cancelled).toBe(1);
  });

  it('refuses to reschedule a cancelled appointment', () => {
    const cancelled = processEvent(
      run(),
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-maria' }),
    );
    expect(
      refusal(() =>
        processEvent(
          cancelled,
          event('APPOINTMENT_RESCHEDULED', NOW, {
            appointment_id: 'appt-maria',
            starts_at: '2026-09-06T15:00:00-05:00',
          }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('changes status and counts the outcome', () => {
    const state = processEvent(
      run(),
      event('APPOINTMENT_STATUS_CHANGED', NOW, {
        appointment_id: 'appt-maria',
        status: 'no_show',
      }),
    );
    expect(state.account.appointments['appt-maria']?.status).toBe('no_show');
    expect(state.account.analytics.appointments_no_show).toBe(1);
  });

  it('refuses a status outside the real set', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('APPOINTMENT_STATUS_CHANGED', NOW, {
            appointment_id: 'appt-maria',
            status: 'ghosted',
          }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('conversations', () => {
  const sms = (state: SimulatorState, contact: string) =>
    processEvent(state, event('SMS_SENT', NOW, { contact_id: contact, body: 'You are booked.' }));

  it('records an outbound message on the contact conversation', () => {
    const state = sms(run(), 'maria');
    expect(state.account.conversations.maria?.messages).toHaveLength(1);
    expect(state.account.conversations.maria?.messages[0]?.direction).toBe('outbound');
    expect(state.account.analytics.messages_sent).toBe(1);
  });

  it('skips an SMS to a contact with no phone, and says why', () => {
    const state = sms(run(), 'jordan');
    expect(state.account.conversations.jordan).toBeUndefined();
    expect(records(state, 'action_skipped')[0]?.reason).toBe('missing_phone');
    expect(state.account.analytics.messages_sent).toBe(0);
  });

  it('skips any message to a contact on do-not-disturb', () => {
    const state = sms(run(), 'lena');
    expect(records(state, 'action_skipped')[0]?.reason).toBe('dnd');
  });

  it('records an inbound reply', () => {
    const state = processEvent(
      sms(run(), 'maria'),
      event('SMS_RECEIVED', NOW, { contact_id: 'maria', body: 'CHANGE' }),
    );
    expect(state.account.conversations.maria?.messages).toHaveLength(2);
    expect(state.account.conversations.maria?.messages[1]?.direction).toBe('inbound');
    expect(state.account.analytics.messages_received).toBe(1);
  });

  it('keeps messages in the order the run produced them', () => {
    let state = sms(run(), 'maria');
    state = processEvent(state, event('SMS_RECEIVED', NOW, { contact_id: 'maria', body: 'one' }));
    state = processEvent(state, event('SMS_SENT', NOW, { contact_id: 'maria', body: 'two' }));
    expect(state.account.conversations.maria?.messages.map((row) => row.body)).toEqual([
      'You are booked.',
      'one',
      'two',
    ]);
  });

  it('sends an email and stamps the open on the message it belongs to', () => {
    const sent = processEvent(
      run(),
      event('EMAIL_SENT', NOW, { contact_id: 'maria', body: 'Hello', subject: 'Your booking' }),
    );
    const opened = processEvent(sent, event('EMAIL_OPENED', NOW, { contact_id: 'maria' }));
    expect(opened.account.conversations.maria?.messages[0]?.opened_at).toBe(NOW);
    expect(opened.account.analytics.emails_opened).toBe(1);
  });

  it('counts a second open of the same email once', () => {
    let state = processEvent(run(), event('EMAIL_SENT', NOW, { contact_id: 'maria', body: 'Hi' }));
    state = processEvent(state, event('EMAIL_OPENED', NOW, { contact_id: 'maria' }));
    state = processEvent(state, event('EMAIL_OPENED', NOW, { contact_id: 'maria' }));
    expect(state.account.analytics.emails_opened).toBe(1);
    expect(records(state, 'action_skipped')[0]?.reason).toBe('already_opened');
  });

  it('refuses an open of an email that was never sent', () => {
    expect(
      refusal(() => processEvent(run(), event('EMAIL_OPENED', NOW, { contact_id: 'maria' }))),
    ).toBe('UNKNOWN_ENTITY');
  });
});

describe('payments', () => {
  const paid = (state: SimulatorState) =>
    processEvent(
      state,
      event('PAYMENT_RECEIVED', NOW, {
        payment_id: 'pay-1',
        contact_id: 'maria',
        product_id: 'facial',
        amount: 410,
      }),
    );

  it('records a payment and its revenue', () => {
    const state = paid(run());
    expect(state.account.payments['pay-1']?.status).toBe('received');
    expect(state.account.analytics.revenue).toBe(410);
  });

  it('records a failure with its reason and no revenue', () => {
    const state = processEvent(
      run(),
      event('PAYMENT_FAILED', NOW, {
        payment_id: 'pay-2',
        contact_id: 'maria',
        amount: 410,
        reason: 'card_declined',
      }),
    );
    expect(state.account.analytics.revenue).toBe(0);
    expect(records(state, 'failure')[0]?.reason).toBe('card_declined');
  });

  it('takes revenue back out on a refund', () => {
    const state = processEvent(paid(run()), event('REFUND_ISSUED', NOW, { payment_id: 'pay-1' }));
    expect(state.account.payments['pay-1']?.status).toBe('refunded');
    expect(state.account.analytics.revenue).toBe(0);
    expect(state.account.analytics.refunds_issued).toBe(1);
  });

  it('refuses to refund a payment that never succeeded', () => {
    const failed = processEvent(
      run(),
      event('PAYMENT_FAILED', NOW, { payment_id: 'pay-2', contact_id: 'maria', amount: 10 }),
    );
    expect(
      refusal(() => processEvent(failed, event('REFUND_ISSUED', NOW, { payment_id: 'pay-2' }))),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('forms and surveys', () => {
  it('creates the contact a submission names, through a real generated event', () => {
    const state = processEvent(
      run(),
      event('FORM_SUBMITTED', NOW, {
        form_id: 'consult-request',
        contact_id: 'nina',
        values: { first_name: 'Nina', phone: '+15125550123', treatment_interest: 'Membership' },
      }),
    );
    expect(state.account.contacts.nina?.first_name).toBe('Nina');
    expect(state.account.contacts.nina?.custom_fields.treatment_interest).toBe('Membership');
    // The consequence went through the same path: it is in the log, generated, after its cause.
    const created = at(state, 'CONTACT_CREATED')[0];
    expect(created?.origin).toBe('generated');
    expect(created?.source?.caused_by).toBe(at(state, 'FORM_SUBMITTED')[0]?.id);
    expect(state.account.analytics.forms_submitted).toBe(1);
  });

  it('updates the contact when the submission names one that exists', () => {
    const state = processEvent(
      run(),
      event('FORM_SUBMITTED', NOW, {
        form_id: 'consult-request',
        contact_id: 'maria',
        values: { phone: '+15125550999' },
      }),
    );
    expect(state.account.contacts.maria?.phone).toBe('+15125550999');
    expect(at(state, 'CONTACT_UPDATED')[0]?.origin).toBe('generated');
  });

  it('refuses a field the form does not have', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('FORM_SUBMITTED', NOW, {
            form_id: 'consult-request',
            contact_id: 'nina',
            values: { not_a_field: 'x' },
          }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('refuses a submission for a form that does not exist', () => {
    expect(
      refusal(() =>
        processEvent(
          run(),
          event('FORM_SUBMITTED', NOW, { form_id: 'nope', contact_id: 'maria', values: {} }),
        ),
      ),
    ).toBe('UNKNOWN_ENTITY');
  });

  it('records a survey submission', () => {
    const state = processEvent(
      run(),
      event('SURVEY_SUBMITTED', NOW, {
        survey_id: 'intake',
        contact_id: 'maria',
        values: { treatment_interest: 'Membership' },
      }),
    );
    expect(state.account.analytics.surveys_submitted).toBe(1);
    expect(state.account.contacts.maria?.custom_fields.treatment_interest).toBe('Membership');
  });
});

describe('workflow runs', () => {
  const enrol = (state: SimulatorState) =>
    processEvent(
      state,
      event('WORKFLOW_ENROLLED', NOW, {
        workflow_id: 'wf-booking-confirmation',
        contact_id: 'maria',
      }),
    );

  it('records an enrolment against the shared account', () => {
    const state = enrol(run());
    const [run_] = Object.values(state.account.workflow_runs);
    expect(run_?.status).toBe('active');
    expect(run_?.contact_id).toBe('maria');
    expect(records(state, 'trigger')[0]?.data).toMatchObject({
      trigger_feature: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT',
    });
  });

  it('refuses a second active enrolment when re-entry is off, and says why', () => {
    const twice = enrol(enrol(run()));
    expect(Object.values(twice.account.workflow_runs)).toHaveLength(1);
    const exit = records(twice, 'exit')[0];
    expect(exit?.reason).toBe('duplicate_enrolment');
  });

  it('records a completed step against a node the workflow actually has', () => {
    const enrolled = enrol(run());
    const [id] = Object.keys(enrolled.account.workflow_runs);
    const state = processEvent(
      enrolled,
      event('WORKFLOW_STEP_COMPLETED', NOW, { workflow_run_id: id, node_id: 'n1' }),
    );
    expect(state.account.workflow_runs[id as string]?.completed_node_ids).toEqual(['n1']);
  });

  it('refuses a step for a node the workflow does not have', () => {
    const enrolled = enrol(run());
    const [id] = Object.keys(enrolled.account.workflow_runs);
    expect(
      refusal(() =>
        processEvent(
          enrolled,
          event('WORKFLOW_STEP_COMPLETED', NOW, { workflow_run_id: id, node_id: 'n99' }),
        ),
      ),
    ).toBe('UNKNOWN_ENTITY');
  });

  it('exits a run with a reason, and refuses to exit it twice', () => {
    const enrolled = enrol(run());
    const [id] = Object.keys(enrolled.account.workflow_runs);
    const exited = processEvent(
      enrolled,
      event('WORKFLOW_EXITED', NOW, { workflow_run_id: id, reason: 'goal_met' }),
    );
    expect(exited.account.workflow_runs[id as string]?.status).toBe('exited');
    expect(exited.account.workflow_runs[id as string]?.exit_reason).toBe('goal_met');
    expect(
      refusal(() => processEvent(exited, event('WORKFLOW_EXITED', NOW, { workflow_run_id: id }))),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('webhooks', () => {
  it('records an inbound call with its payload', () => {
    const state = processEvent(
      run(),
      event('WEBHOOK_RECEIVED', NOW, {
        endpoint: 'https://example.test/hook',
        contact_id: 'maria',
        body: { ok: true },
      }),
    );
    expect(records(state, 'input')[0]?.data).toMatchObject({
      endpoint: 'https://example.test/hook',
    });
  });

  it('treats a 4xx or 5xx response as a failure', () => {
    const state = processEvent(
      run(),
      event('WEBHOOK_RESPONSE', NOW, { endpoint: 'https://example.test/hook', status: 401 }),
    );
    expect(records(state, 'failure')[0]?.reason).toBe('webhook_error');
  });

  it('treats a 2xx response as a completed step', () => {
    const state = processEvent(
      run(),
      event('WEBHOOK_RESPONSE', NOW, { endpoint: 'https://example.test/hook', status: 200 }),
    );
    expect(records(state, 'step_completed')).toHaveLength(1);
  });

  it('refuses a response with no status', () => {
    expect(
      refusal(() =>
        processEvent(run(), event('WEBHOOK_RESPONSE', NOW, { endpoint: 'https://x.test' })),
      ),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('malformed input', () => {
  it('refuses an event with no type', () => {
    expect(refusal(() => processEvent(run(), { at: NOW, payload: {} } as never))).toBe(
      'MALFORMED_EVENT',
    );
  });

  it('refuses a type outside the catalogue', () => {
    expect(
      refusal(() =>
        processEvent(run(), {
          type: 'CONTACT_DELETED',
          at: NOW,
          payload: {},
          origin: 'injected',
        } as never),
      ),
    ).toBe('UNKNOWN_EVENT_TYPE');
  });

  it('refuses an event with no simulator timestamp', () => {
    expect(
      refusal(() =>
        processEvent(run(), { type: 'TAG_ADDED', payload: {}, origin: 'injected' } as never),
      ),
    ).toBe('MALFORMED_EVENT');
  });

  it('refuses a payload that is not an object', () => {
    expect(
      refusal(() =>
        processEvent(run(), {
          type: 'TAG_ADDED',
          at: NOW,
          payload: 'maria',
          origin: 'injected',
        } as never),
      ),
    ).toBe('MALFORMED_EVENT');
  });
});
