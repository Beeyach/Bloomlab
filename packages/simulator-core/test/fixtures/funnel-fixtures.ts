import { expect } from 'vitest';

import {
  createRun,
  historyHash,
  processEvent,
  replay,
  stateHash,
  tryProcessEvent,
} from '../../src/index.ts';
import { event, funnelScenario } from '../fixtures.ts';
import type { RegressionFixture } from './registry.ts';

/**
 * Funnel Lab regression fixtures (SIM-017, FUN-001 … FUN-003).
 *
 * `FORM-002` is the one this phase found: a form submitted by someone the account has never met
 * fired no trigger, because the trigger matcher asked whether the contact existed at a moment
 * when its own generated `CONTACT_CREATED` had not been processed yet. That is the whole of
 * FUN-003 for a brand-new lead, so it is pinned by id here (D-123).
 */

const NOW = '2026-09-08T09:00:00-05:00';

const newLead = () =>
  processEvent(
    createRun(funnelScenario()),
    event('FORM_SUBMITTED', NOW, {
      form_id: 'consult-request',
      contact_id: 'priya',
      values: { first_name: 'Priya', email: 'priya@example.com', treatment_interest: 'Laser' },
    }),
  );

export const FUNNEL_FIXTURES: RegressionFixture[] = [
  {
    id: 'FORM-002',
    behaviour:
      'A form submitted by a contact the account has never met creates them and still fires the form trigger.',
    covers: 'FUN-003, WFL-010, D-123',
    status: 'implemented',
    run: newLead,
    expect: (state) => {
      // The contact is real and was created by the reducer's own generated event.
      expect(state.account.contacts.priya?.first_name).toBe('Priya');
      const created = state.log.find((row) => row.type === 'CONTACT_CREATED');
      expect(created?.origin).toBe('generated');
      // And the trigger fired for that same new contact — no injection, no staging.
      const enrolled = state.log.filter((row) => row.type === 'WORKFLOW_ENROLLED');
      expect(enrolled).toHaveLength(1);
      expect(enrolled[0]?.payload.workflow_id).toBe('wf-new-lead-welcome');
      expect(enrolled[0]?.payload.contact_id).toBe('priya');
      // The creation is processed before the enrolment, so the run never walks a ghost.
      expect((created?.sequence ?? 0) < (enrolled[0]?.sequence ?? 0)).toBe(true);
      // And the workflow's own steps ran against the real contact.
      expect(state.account.contacts.priya?.tags).toContain('new-lead');
      expect(state.log.filter((row) => row.type === 'SMS_SENT')).toHaveLength(1);
    },
  },
  {
    id: 'FORM-003',
    behaviour:
      'A submission the trigger does not listen for updates the contact and enrols nobody.',
    covers: 'FUN-003, WFL-004',
    status: 'implemented',
    run: () =>
      processEvent(
        createRun(funnelScenario()),
        event('SURVEY_SUBMITTED', NOW, {
          survey_id: 'fit-check',
          contact_id: 'nadia',
          values: { treatment_interest: 'Laser', budget_band: 'Over 500' },
        }),
      ),
    expect: (state) => {
      // The survey reaches the same contact record the form would have.
      expect(state.account.contacts.nadia?.custom_fields.treatment_interest).toBe('Laser');
      expect(state.log.filter((row) => row.type === 'CONTACT_UPDATED')).toHaveLength(1);
      // The welcome workflow listens for a form, not a survey. The matcher decides that.
      expect(state.log.filter((row) => row.type === 'WORKFLOW_ENROLLED')).toHaveLength(0);
    },
  },
  {
    id: 'FORM-004',
    behaviour:
      'A submission that would create a contact with no first name is refused, and nothing is written.',
    covers: 'FUN-003, SIM-011',
    status: 'implemented',
    run: () =>
      tryProcessEvent(
        createRun(funnelScenario()),
        event('FORM_SUBMITTED', NOW, {
          form_id: 'consult-request',
          contact_id: 'ravi',
          values: { email: 'ravi@example.com' },
        }),
      ).state,
    expect: (state) => {
      expect(state.account.contacts.ravi).toBeUndefined();
      expect(state.diagnostics.some((row) => row.code === 'INVALID_PAYLOAD')).toBe(true);
      expect(state.log.filter((row) => row.type === 'WORKFLOW_ENROLLED')).toHaveLength(0);
    },
  },
  {
    id: 'FUNNEL-001',
    behaviour: 'A funnel definition is an account event, versioned and replayable.',
    covers: 'FUN-001, D-119',
    status: 'implemented',
    run: () => {
      let state = createRun(funnelScenario());
      const steps = [
        {
          id: 'st-capture',
          name: 'Consultation offer',
          purpose: 'capture',
          next_step_id: 'st-booking',
          blocks: [
            { id: 'b1', role: 'headline', headline: 'A free consultation' },
            { id: 'b2', role: 'form', reference_id: 'consult-request' },
          ],
        },
        {
          id: 'st-booking',
          name: 'Pick a time',
          purpose: 'booking',
          blocks: [{ id: 'b3', role: 'calendar', reference_id: 'consultation' }],
        },
      ];
      state = processEvent(
        state,
        event('FUNNEL_CREATED', NOW, { funnel: { id: 'fn-1', name: 'Consultation', steps } }),
      );
      return processEvent(
        state,
        event('FUNNEL_UPDATED', NOW, {
          funnel_id: 'fn-1',
          funnel: {
            id: 'fn-1',
            name: 'Consultation',
            steps: [
              { ...steps[0], blocks: [...steps[0]!.blocks, { id: 'b4', role: 'proof' }] },
              steps[1],
            ],
          },
        }),
      );
    },
    expect: (state) => {
      const funnel = state.account.funnels['fn-1'];
      expect(funnel?.version).toBe(2);
      expect(funnel?.steps[0]?.blocks.map((block) => block.role)).toEqual([
        'headline',
        'form',
        'proof',
      ]);
      // Replaying the log rebuilds the same account, so a funnel is history like anything else.
      const replayed = replay(funnelScenario(), state.log, { run_id: state.run_id });
      expect(stateHash(replayed)).toBe(stateHash(state));
      expect(historyHash(replayed)).toBe(historyHash(state));
    },
  },
];
