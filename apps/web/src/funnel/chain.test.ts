import { beforeEach, describe, expect, it } from 'vitest';

import {
  contentEventName,
  initialAccount,
  validateScenario,
  type Funnel,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { BloomlabDatabase } from '../data/db';
import { startRun, type StoredRun } from '../simulator/store';
import {
  bookFromFunnel,
  newVisitor,
  payFromFunnel,
  saveFunnel,
  submitForm,
  submitSurvey,
  type Visitor,
} from './commands';

/**
 * FUN-003: submitting a form in the Funnel Lab creates real CRM data and fires the workflow,
 * through the shared account.
 *
 * This is the requirement's whole point, so the test refuses every shortcut the requirement
 * refuses. It never writes a contact. It never injects `WORKFLOW_ENROLLED`. It puts one real
 * `FORM_SUBMITTED` through the same execution door the Workflow Lab uses, and then asserts on the
 * run's own log: the generated `CONTACT_CREATED`, the enrolment the engine's matcher decided, the
 * tag and the text the workflow's own nodes produced.
 */

const SCENARIO_ID = 'SC-glowhaus-funnel';

const scenario = (): SimulatorScenario => {
  const found = (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === SCENARIO_ID,
  );
  if (!found) throw new Error(`${SCENARIO_ID} is not in the content bundle`);
  return found;
};

/** A funnel that captures on the real form, then books on the real calendar. */
const consultFunnel = (): Funnel => ({
  id: 'fn-consult',
  name: 'Consultation funnel',
  version: 0,
  steps: [
    {
      id: 'st-capture',
      name: 'Consultation offer',
      purpose: 'capture',
      next_step_id: 'st-booking',
      blocks: [
        {
          id: 'b-headline',
          role: 'headline',
          headline: 'A free 30-minute consultation',
          body: null,
          reference_id: null,
          target_step_id: null,
        },
        {
          id: 'b-outcome',
          role: 'outcome',
          headline: 'Leave knowing what your skin actually needs',
          body: null,
          reference_id: null,
          target_step_id: null,
        },
        {
          id: 'b-form',
          role: 'form',
          headline: null,
          body: null,
          reference_id: 'consult-request',
          target_step_id: null,
        },
      ],
    },
    {
      id: 'st-booking',
      name: 'Pick a time',
      purpose: 'booking',
      next_step_id: null,
      blocks: [
        {
          id: 'b-calendar',
          role: 'calendar',
          headline: null,
          body: null,
          reference_id: 'consultation',
          target_step_id: null,
        },
      ],
    },
  ],
});

let database: BloomlabDatabase;
let run: StoredRun;

const options = () => ({ database, createWorker: null });

const types = (state: StoredRun) => state.state.log.map((event) => contentEventName(event.type));

const of = (state: StoredRun, type: string) =>
  state.state.log.filter((event) => contentEventName(event.type) === type);

beforeEach(async () => {
  database = new BloomlabDatabase(`funnel-chain-${Math.random().toString(36).slice(2)}`);
  await database.open();
  run = await startRun(scenario(), database);
});

describe('the scenario itself', () => {
  it('is runnable and holds the pieces a funnel connects to, and no funnel', () => {
    expect(validateScenario(scenario())).toEqual([]);
    const account = initialAccount(scenario());
    expect(account.forms['consult-request']).toBeDefined();
    expect(account.surveys['fit-check']).toBeDefined();
    expect(account.calendars.consultation).toBeDefined();
    expect(account.products['glow-membership']).toBeDefined();
    expect(account.workflows['wf-new-lead-welcome']).toBeDefined();
    expect(Object.keys(account.funnels)).toEqual([]);
  });
});

describe('FUN-003: a submission in SIMULATE reaches the CRM and the workflow', () => {
  it('saves the funnel as an account event rather than a store beside it', async () => {
    const result = await saveFunnel(run, scenario(), consultFunnel(), options());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.state.account.funnels['fn-consult']?.version).toBe(1);
    expect(types(result.run)).toContain('funnel.created');
  });

  it('creates a contact, enrols the workflow and runs its steps — from one form submission', async () => {
    const visitor = newVisitor();
    const before = Object.keys(run.state.account.contacts).length;

    const result = await submitForm(
      run,
      scenario(),
      visitor,
      'consult-request',
      {
        first_name: 'Priya',
        last_name: 'Nair',
        email: 'priya.nair@example.com',
        phone: '+15125550190',
        treatment_interest: 'Laser',
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.run.state;

    // The contact is real, and it was created by the reducer's generated event, not by this test.
    expect(Object.keys(after.account.contacts)).toHaveLength(before + 1);
    const contact = after.account.contacts[visitor.contact_id];
    expect(contact?.first_name).toBe('Priya');
    expect(contact?.custom_fields.treatment_interest).toBe('Laser');
    const created = of(result.run, 'contact.created')[0];
    expect(created?.origin).toBe('generated');
    expect(created?.source?.kind).toBe('reducer');
    expect(created?.source?.id).toBe('FORM_SUBMITTED');

    // The enrolment was the engine's decision, from the real event. Nothing injected it.
    const enrolled = of(result.run, 'workflow.enrolled');
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]?.origin).toBe('generated');
    expect(enrolled[0]?.payload.workflow_id).toBe('wf-new-lead-welcome');
    expect(enrolled[0]?.payload.contact_id).toBe(visitor.contact_id);

    // And the workflow's own nodes ran: the tag it adds and the text it sends are in the account.
    expect(contact?.tags).toContain('new-lead');
    const texts = of(result.run, 'sms.sent');
    expect(texts).toHaveLength(1);
    expect(texts[0]?.payload.contact_id).toBe(visitor.contact_id);
    expect(String(texts[0]?.payload.body)).toContain('Priya');
    expect(after.account.workflow_runs).toBeDefined();
    expect(Object.values(after.account.workflow_runs)).toHaveLength(1);
  });

  it('updates an existing contact instead of creating a second one', async () => {
    const visitor: Visitor = { contact_id: 'nadia', is_new: false };
    const before = Object.keys(run.state.account.contacts).length;
    const result = await submitForm(
      run,
      scenario(),
      visitor,
      'consult-request',
      { first_name: 'Nadia', phone: '+15125550199', treatment_interest: 'Membership' },
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.run.state.account.contacts)).toHaveLength(before);
    expect(result.run.state.account.contacts.nadia?.phone).toBe('+15125550199');
    expect(result.run.state.account.contacts.nadia?.custom_fields.treatment_interest).toBe(
      'Membership',
    );
    expect(of(result.run, 'contact.updated')).toHaveLength(1);
    expect(of(result.run, 'contact.created')).toHaveLength(0);
  });

  it('refuses a field the form does not have, and leaves the run untouched', async () => {
    const result = await submitForm(
      run,
      scenario(),
      newVisitor(),
      'consult-request',
      { first_name: 'Priya', favourite_colour: 'green' },
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe('INVALID_PAYLOAD');
    expect(result.refusal.message).toContain('favourite_colour');
    // The run handed back is the one that went in: nothing half-applied was written.
    expect(result.run.state.log).toHaveLength(run.state.log.length);
    expect(Object.keys(result.run.state.account.contacts)).toHaveLength(
      Object.keys(run.state.account.contacts).length,
    );
  });

  it('refuses a submission that would create a contact with no name', async () => {
    const result = await submitForm(
      run,
      scenario(),
      newVisitor(),
      'consult-request',
      { email: 'nobody@example.com' },
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.message).toContain('no first name');
  });

  it('refuses a form the account does not hold', async () => {
    const result = await submitForm(
      run,
      scenario(),
      newVisitor(),
      'no-such-form',
      { first_name: 'Priya' },
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe('UNKNOWN_ENTITY');
  });

  it('never enrols the workflow when the trigger’s filter does not match', async () => {
    // The welcome workflow listens for the consultation request form. A survey submission is a
    // different event entirely, and the engine's matcher — not this test — decides that.
    const result = await submitSurvey(
      run,
      scenario(),
      { contact_id: 'nadia', is_new: false },
      'fit-check',
      { treatment_interest: 'Laser', budget_band: 'Over 500' },
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(of(result.run, 'survey.submitted')).toHaveLength(1);
    expect(of(result.run, 'contact.updated')).toHaveLength(1);
    expect(of(result.run, 'workflow.enrolled')).toHaveLength(0);
  });
});

describe('the rest of the visitor’s funnel reaches the same account', () => {
  it('books a real appointment on the account calendar', async () => {
    const result = await bookFromFunnel(
      run,
      scenario(),
      { contact_id: 'nadia', is_new: false },
      'consultation',
      '2026-09-09T11:00:00-05:00',
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const booked = Object.values(result.run.state.account.appointments);
    expect(booked).toHaveLength(1);
    expect(booked[0]).toMatchObject({
      contact_id: 'nadia',
      calendar_id: 'consultation',
      status: 'booked',
    });
    expect(result.run.state.account.analytics.appointments_booked).toBe(1);
  });

  it('records one payment for the referenced product, and nothing more', async () => {
    const result = await payFromFunnel(
      run,
      scenario(),
      { contact_id: 'nadia', is_new: false },
      'glow-membership',
      149,
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payments = Object.values(result.run.state.account.payments);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      contact_id: 'nadia',
      product_id: 'glow-membership',
      amount: 149,
      status: 'received',
    });
    expect(result.run.state.account.analytics.revenue).toBe(149);
    // No subscription, no invoice, no second payment: Phase 13 records the one event and stops.
    expect(of(result.run, 'payment.received')).toHaveLength(1);
  });

  it('refuses a booking on a calendar the account does not hold', async () => {
    const result = await bookFromFunnel(
      run,
      scenario(),
      { contact_id: 'nadia', is_new: false },
      'no-such-calendar',
      '2026-09-09T11:00:00-05:00',
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe('UNKNOWN_ENTITY');
  });
});

describe('the account survives a reload (DATA-001)', () => {
  it('resumes the funnel and the contact the visit created, without replaying anything', async () => {
    const saved = await saveFunnel(run, scenario(), consultFunnel(), options());
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const visitor = newVisitor();
    const submitted = await submitForm(
      saved.run,
      scenario(),
      visitor,
      'consult-request',
      { first_name: 'Priya', email: 'priya.nair@example.com' },
      options(),
    );
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const { loadRun } = await import('../simulator/store');
    const reloaded = await loadRun(run.state.run_id, database);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.state.account.funnels['fn-consult']?.steps).toHaveLength(2);
    expect(reloaded?.state.account.contacts[visitor.contact_id]?.first_name).toBe('Priya');
    expect(reloaded?.state.account.contacts[visitor.contact_id]?.tags).toContain('new-lead');
    expect(reloaded?.state.log).toHaveLength(submitted.run.state.log.length);
  });
});
