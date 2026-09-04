import { expect } from 'vitest';

import {
  advanceTo,
  createRun,
  historyHash,
  processEvent,
  replay,
  stateHash,
} from '../../src/index.ts';
import { NOW, event } from '../fixtures.ts';
import type { RegressionFixture } from './registry.ts';
import {
  CANCELLATION,
  CAREFUL_REMINDER,
  REMINDER,
  TAG_REMINDER,
  booked,
  cancelled,
  clinicWith,
  edge,
  end,
  enrol,
  eventsOf,
  ifElse,
  messagesTo,
  onlyRun,
  records,
  removeFrom,
  reply,
  rescheduled,
  runsOf,
  sms,
  tag,
  tagged,
  wait,
  workflow,
} from './workflows.ts';

/**
 * Workflow Lab regression fixtures (SIM-017, WFL-006..WFL-010).
 *
 * Each one runs the engine on a small authored workflow and pins one behaviour by id. The waits
 * really wait: the run parks, a wake sits in the queue, and only the Time Machine releases it.
 * The branches really evaluate: the record says what was compared with what. Where GoHighLevel
 * itself would misbehave — a reminder to a cancelled appointment, two confirmations for two
 * bookings — the fixture pins the platform behaviour and a second fixture pins the design that
 * avoids it, because the simulator's job is to let a learner see both.
 */

const FRIDAY_1800 = '2026-09-04T18:00:00-05:00';
const MONDAY_0900 = '2026-09-07T09:00:00-05:00';

const SATURDAY_APPOINTMENT = '2026-09-05T14:00:00-05:00';
const AN_HOUR_BEFORE = '2026-09-05T13:00:00-05:00';

const FOLLOW_UP = workflow({
  id: 'wf-followup',
  name: 'Next-day follow-up',
  trigger: { ghl_feature_id: 'GHL-WF-CONTACT-TAG', filters: [] },
  nodes: [
    wait('w1', { wait_type: 'period', days: 1 }),
    sms('s1', 'Still thinking it over?'),
    end('e1'),
  ],
});

export const WORKFLOW_FIXTURES: RegressionFixture[] = [
  /* ---- waits ---------------------------------------------------------------------------- */
  {
    id: 'WAIT-001',
    behaviour: 'A fixed Wait releases a contact at the authored delay, and not before.',
    covers: 'WFL-006',
    status: 'implemented',
    run: () => {
      const parked = processEvent(
        createRun(clinicWith([FOLLOW_UP])),
        enrol('wf-followup', 'maria'),
      );
      expect(onlyRun(parked).status).toBe('waiting');
      expect(onlyRun(parked).wait?.wake_at).toBe('2026-09-04T09:00:00-05:00');
      expect(messagesTo(parked, 'maria')).toHaveLength(0);
      expect(parked.queue.map((row) => row.type)).toEqual(['WORKFLOW_RESUMED']);
      // An hour short of the delay, still nothing.
      const early = advanceTo(parked, '2026-09-04T08:00:00-05:00');
      expect(messagesTo(early, 'maria')).toHaveLength(0);
      return advanceTo(early, '2026-09-04T09:00:00-05:00');
    },
    expect: (state) => {
      expect(messagesTo(state, 'maria').map((m) => m.at)).toEqual(['2026-09-04T09:00:00-05:00']);
      expect(onlyRun(state).status).toBe('completed');
      expect(eventsOf(state, 'WORKFLOW_RESUMED')[0]?.origin).toBe('scheduled');
      expect(records(state, 'input').some((row) => row.reason === 'wait_released')).toBe(true);
    },
  },
  {
    id: 'WAIT-002',
    behaviour: 'An appointment-relative Wait releases relative to the appointment, not enrolment.',
    covers: 'WFL-006',
    status: 'implemented',
    run: () => {
      const state = processEvent(
        createRun(clinicWith([REMINDER])),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      // Enrolled at 09:00 Thursday; the wake is an hour before Saturday's 14:00, not 10:00 today.
      expect(onlyRun(state).wait?.wake_at).toBe(AN_HOUR_BEFORE);
      expect(onlyRun(state).wait?.appointment_id).toBe('appt-sat');
      return advanceTo(state, AN_HOUR_BEFORE);
    },
    expect: (state) => {
      const [message] = messagesTo(state, 'maria');
      expect(message?.at).toBe(AN_HOUR_BEFORE);
      expect(message?.body).toBe('See you at 2:00 pm, Maria.');
      expect(onlyRun(state).status).toBe('completed');
    },
  },
  {
    id: 'WAIT-003',
    behaviour:
      'A contact enrolled after the wait target has passed proceeds at once, and the record says the wait was already over.',
    covers: 'WFL-006',
    status: 'implemented',
    run: () =>
      processEvent(
        createRun(clinicWith([REMINDER])),
        // Booked 40 minutes out: "an hour before" was twenty minutes ago.
        booked('maria', 'appt-soon', '2026-09-03T09:40:00-05:00'),
      ),
    expect: (state) => {
      const [waiting] = records(state, 'waiting');
      expect(waiting?.reason).toBe('wait_target_passed');
      expect(waiting?.data).toMatchObject({ late: true, target: '2026-09-03T08:40:00-05:00' });
      expect(messagesTo(state, 'maria').map((m) => m.at)).toEqual([NOW]);
      expect(state.queue.filter((row) => row.type === 'WORKFLOW_RESUMED')).toHaveLength(0);
      expect(onlyRun(state).status).toBe('completed');
    },
  },
  {
    id: 'WAIT-004',
    behaviour:
      'Cancelling an appointment during a wait ends the run the booking started (platform behaviour: the contact is pulled out, nothing more runs). A reminder started by a tag is not about that appointment, is not pulled out, and with no status check still sends.',
    covers: 'WFL-006, SIM-011',
    status: 'implemented',
    run: () => {
      let state = processEvent(
        // Without Maria's authored Friday appointment, Saturday's is the one a tag-started
        // run finds; the booking-started run is about Saturday's regardless.
        createRun(clinicWith([REMINDER, TAG_REMINDER], { appointments: [] })),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      state = processEvent(state, tagged('maria', 'booked'));
      expect(runsOf(state).map((run) => [run.workflow_id, run.status])).toEqual([
        ['wf-reminder', 'waiting'],
        ['wf-tag-reminder', 'waiting'],
      ]);
      state = processEvent(state, cancelled('appt-sat', '2026-09-04T10:00:00-05:00'));
      // The booking-started run is gone with its wake; the tag-started run is still parked.
      expect(onlyRun(state, 'wf-reminder')).toMatchObject({
        status: 'exited',
        exit_reason: 'appointment_cancelled',
      });
      expect(onlyRun(state, 'wf-tag-reminder').status).toBe('waiting');
      expect(state.queue.filter((row) => row.type === 'WORKFLOW_RESUMED')).toHaveLength(1);
      return advanceTo(state, AN_HOUR_BEFORE);
    },
    expect: (state) => {
      const released = records(state, 'input').find((row) => row.reason === 'wait_released');
      expect(released?.data).toMatchObject({
        appointment_id: 'appt-sat',
        appointment_status: 'cancelled',
      });
      // One reminder went out, from the tag-started run, to a cancelled appointment — with the
      // time blank, because there is no live appointment left to merge.
      const messages = messagesTo(state, 'maria');
      expect(messages.map((m) => m.workflow_id)).toEqual(['wf-tag-reminder']);
      expect(messages[0]?.body).toBe('See you at , Maria.');
      expect(
        records(state, 'exit').find((row) => row.reason === 'appointment_cancelled')?.data,
      ).toMatchObject({ was_waiting: true });
    },
  },
  {
    id: 'RESCHED-001',
    behaviour:
      'Rescheduling ends the run the old booking started and starts a fresh one against the new time, so the reminder moves with the appointment.',
    covers: 'WFL-006, WFL-010',
    status: 'implemented',
    run: () => {
      let state = processEvent(
        createRun(clinicWith([REMINDER])),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      state = processEvent(
        state,
        rescheduled('appt-sat', '2026-09-06T16:00:00-05:00', '2026-09-04T10:00:00-05:00'),
      );
      return advanceTo(state, '2026-09-06T15:00:00-05:00');
    },
    expect: (state) => {
      const runs = runsOf(state, 'wf-reminder');
      expect(runs.map((run) => [run.status, run.exit_reason])).toEqual([
        ['exited', 'appointment_rescheduled'],
        ['completed', 'completed'],
      ]);
      expect(messagesTo(state, 'maria').map((m) => m.at)).toEqual(['2026-09-06T15:00:00-05:00']);
      expect(messagesTo(state, 'maria')[0]?.body).toBe('See you at 4:00 pm, Maria.');
    },
  },

  /* ---- branches ------------------------------------------------------------------------- */
  {
    id: 'BRANCH-001',
    behaviour: 'An If/Else with AND and OR conditions takes the branch the values imply.',
    covers: 'WFL-007',
    status: 'implemented',
    run: () => {
      const route = workflow({
        id: 'wf-route',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [
          ifElse('b1', [
            {
              name: 'Priority',
              groups: [
                {
                  // AND inside a group…
                  conditions: [
                    { field: 'contact.tags', operator: 'contains', value: 'vip' },
                    {
                      field: 'contact.custom_fields.treatment_interest',
                      operator: 'is',
                      value: 'Membership',
                    },
                  ],
                },
                // …OR between groups.
                { conditions: [{ field: 'contact.source', operator: 'is', value: 'Referral' }] },
              ],
            },
          ]),
          tag('t1', 'priority'),
          tag('t2', 'standard'),
        ],
        edges: [edge('b1', 't1', 'Priority'), edge('b1', 't2', 'None')],
      });
      const base = clinicWith([route]);
      const contacts = [
        ...(base.initial_account_state.contacts ?? []),
        {
          id: 'priya',
          first_name: 'Priya',
          tags: ['vip'],
          custom_fields: { treatment_interest: 'Membership' },
        },
        { id: 'rafa', first_name: 'Rafa', source: 'Referral' },
        // vip but a different interest: the AND fails and there is no referral to rescue it.
        {
          id: 'noor',
          first_name: 'Noor',
          tags: ['vip'],
          custom_fields: { treatment_interest: 'Laser' },
        },
      ];
      let state = createRun({
        ...base,
        initial_account_state: { ...base.initial_account_state, contacts },
      });
      for (const id of ['maria', 'priya', 'rafa', 'noor'])
        state = processEvent(state, enrol('wf-route', id));
      return state;
    },
    expect: (state) => {
      const tagsOf = (id: string) => state.account.contacts[id]?.tags ?? [];
      expect(tagsOf('priya')).toContain('priority');
      expect(tagsOf('rafa')).toContain('priority');
      expect(tagsOf('maria')).toContain('standard');
      expect(tagsOf('noor')).toContain('standard');
      const results = records(state, 'branch_result');
      expect(results.map((row) => row.data.chosen)).toEqual([
        'None',
        'Priority',
        'Priority',
        'None',
      ]);
    },
  },
  {
    id: 'BRANCH-002',
    behaviour: 'When two branches would match, the first wins and the rest are not evaluated.',
    covers: 'WFL-007',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-first',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [
          ifElse('b1', [
            {
              name: 'Has email',
              groups: [{ conditions: [{ field: 'contact.email', operator: 'exists' }] }],
            },
            {
              name: 'Has phone',
              groups: [{ conditions: [{ field: 'contact.phone', operator: 'exists' }] }],
            },
          ]),
          tag('t1', 'emailed'),
          tag('t2', 'texted'),
          end('e1'),
        ],
        edges: [
          edge('b1', 't1', 'Has email'),
          edge('b1', 't2', 'Has phone'),
          edge('b1', 'e1', 'None'),
        ],
      });
      return processEvent(createRun(clinicWith([wf])), enrol('wf-first', 'maria'));
    },
    expect: (state) => {
      const [result] = records(state, 'branch_result');
      expect(result?.data.chosen).toBe('Has email');
      expect((result?.data.branches as unknown[]).length).toBe(1);
      expect(state.account.contacts.maria?.tags).toContain('emailed');
      expect(state.account.contacts.maria?.tags).not.toContain('texted');
    },
  },
  {
    id: 'BRANCH-003',
    behaviour:
      'When nothing matches the None branch is taken, and the record keeps every comparison with its actual and expected values.',
    covers: 'WFL-007, SIM-010',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-none',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [
          ifElse('b1', [
            {
              name: 'Laser',
              groups: [
                {
                  conditions: [
                    {
                      field: 'contact.custom_fields.treatment_interest',
                      operator: 'is',
                      value: 'Laser',
                    },
                  ],
                },
              ],
            },
          ]),
          tag('t1', 'laser'),
          tag('t2', 'other'),
        ],
        edges: [edge('b1', 't1', 'Laser'), edge('b1', 't2', 'None')],
      });
      return processEvent(createRun(clinicWith([wf])), enrol('wf-none', 'maria'));
    },
    expect: (state) => {
      const [result] = records(state, 'branch_result');
      expect(result?.data).toMatchObject({
        chosen: 'None',
        fallback: true,
        branches: [
          {
            name: 'Laser',
            passed: false,
            groups: [
              {
                passed: false,
                conditions: [
                  {
                    field: 'contact.custom_fields.treatment_interest',
                    operator: 'is',
                    expected: 'Laser',
                    actual: 'Signature Facial',
                    passed: false,
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(state.account.contacts.maria?.tags).toContain('other');
    },
  },
  {
    id: 'BRANCH-004',
    behaviour:
      'A branch can compare a number on the contact’s opportunity, not only text on the contact.',
    covers: 'WFL-007',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-value',
        trigger: { ghl_feature_id: 'GHL-WF-PIPELINE-STAGE-CHANGED' },
        nodes: [
          ifElse('b1', [
            {
              name: 'High value',
              groups: [
                { conditions: [{ field: 'opportunity.value', operator: 'gt', value: 300 }] },
              ],
            },
          ]),
          tag('t1', 'high-value'),
          tag('t2', 'low-value'),
        ],
        edges: [edge('b1', 't1', 'High value'), edge('b1', 't2', 'None')],
      });
      // Maria's authored opportunity is worth 410.
      return processEvent(
        createRun(clinicWith([wf])),
        enrol('wf-value', 'maria', { context: { opportunity_id: 'opp-maria' } }),
      );
    },
    expect: (state) => {
      expect(records(state, 'branch_result')[0]?.data).toMatchObject({ chosen: 'High value' });
      expect(state.account.contacts.maria?.tags).toContain('high-value');
    },
  },
  {
    id: 'BRANCH-005',
    behaviour:
      'A branch after an action sees what that action did, because effects apply before the walk continues.',
    covers: 'WFL-007, WFL-010',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-sees',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [
          tag('t1', 'hot'),
          ifElse('b1', [
            {
              name: 'Hot',
              groups: [
                { conditions: [{ field: 'contact.tags', operator: 'contains', value: 'hot' }] },
              ],
            },
          ]),
          sms('s1', 'You are hot.'),
          end('e1'),
        ],
        edges: [edge('t1', 'b1'), edge('b1', 's1', 'Hot'), edge('b1', 'e1', 'None')],
      });
      return processEvent(createRun(clinicWith([wf])), enrol('wf-sees', 'maria'));
    },
    expect: (state) => {
      expect(records(state, 'branch_result')[0]?.data).toMatchObject({ chosen: 'Hot' });
      expect(messagesTo(state, 'maria')).toHaveLength(1);
      const types = state.log.map((row) => row.type);
      expect(types.indexOf('TAG_ADDED')).toBeLessThan(types.indexOf('SMS_SENT'));
    },
  },

  /* ---- time ----------------------------------------------------------------------------- */
  {
    id: 'TIME-001',
    behaviour:
      'A message outside the workflow’s time window is held until the window next opens, over a weekend if need be.',
    covers: 'WFL-008',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-hours',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [sms('s1', 'Office hours only.'), tag('t1', 'messaged')],
        settings: { time_window: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } },
      });
      let state = advanceTo(createRun(clinicWith([wf])), FRIDAY_1800);
      state = processEvent(state, enrol('wf-hours', 'maria', {}, FRIDAY_1800));
      expect(onlyRun(state).status).toBe('waiting');
      expect(records(state, 'waiting')[0]?.reason).toBe('time_window');
      expect(records(state, 'waiting')[0]?.data).toMatchObject({ held_until: MONDAY_0900 });
      expect(messagesTo(state, 'maria')).toHaveLength(0);
      // Saturday: still held.
      state = advanceTo(state, '2026-09-05T12:00:00-05:00');
      expect(messagesTo(state, 'maria')).toHaveLength(0);
      return advanceTo(state, MONDAY_0900);
    },
    expect: (state) => {
      expect(messagesTo(state, 'maria').map((m) => m.at)).toEqual([MONDAY_0900]);
      // The step after the held message ran after it, not before.
      expect(state.account.contacts.maria?.tags).toContain('messaged');
      expect(onlyRun(state).status).toBe('completed');
    },
  },
  {
    id: 'TIME-002',
    behaviour:
      'A workflow’s time window is read in the workflow’s own timezone, not the account’s.',
    covers: 'WFL-008, SIM-006',
    status: 'implemented',
    run: () => {
      const hours = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' };
      const east = workflow({
        id: 'wf-east',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [sms('s1', 'From New York.')],
        settings: { timezone: 'America/New_York', time_window: hours },
      });
      const west = workflow({
        id: 'wf-west',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [sms('s1', 'From Los Angeles.')],
        settings: { timezone: 'America/Los_Angeles', time_window: hours },
      });
      // 08:30 in Chicago is 09:30 in New York (open) and 06:30 in Los Angeles (closed).
      const start = '2026-09-03T08:30:00-05:00';
      let state = createRun({ ...clinicWith([east, west]), simulation_time: start });
      state = processEvent(state, enrol('wf-east', 'maria', {}, start));
      state = processEvent(state, enrol('wf-west', 'maria', {}, start));
      return state;
    },
    expect: (state) => {
      expect(messagesTo(state, 'maria').map((m) => m.body)).toEqual(['From New York.']);
      expect(onlyRun(state, 'wf-east').status).toBe('completed');
      expect(onlyRun(state, 'wf-west').status).toBe('waiting');
      // 09:00 Pacific, expressed in the run's zone.
      expect(onlyRun(state, 'wf-west').wait?.wake_at).toBe('2026-09-03T11:00:00-05:00');
    },
  },

  /* ---- replies -------------------------------------------------------------------------- */
  {
    id: 'REPLY-001',
    behaviour: 'A reply wait is released by the contact’s own reply and by nobody else’s.',
    covers: 'WFL-006, CONV-001',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-ask',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [
          sms('s1', 'Reply YES to confirm.'),
          wait('w1', { wait_type: 'reply', channel: 'sms' }),
          tag('t1', 'replied'),
        ],
      });
      let state = processEvent(createRun(clinicWith([wf])), enrol('wf-ask', 'maria'));
      expect(onlyRun(state).status).toBe('waiting');
      expect(onlyRun(state).wait?.kind).toBe('reply');
      // Someone else replying changes nothing for Maria's run.
      state = processEvent(state, reply('lena', 'YES', '2026-09-03T09:10:00-05:00'));
      expect(onlyRun(state).status).toBe('waiting');
      return processEvent(state, reply('maria', 'YES', '2026-09-03T09:30:00-05:00'));
    },
    expect: (state) => {
      expect(onlyRun(state).status).toBe('completed');
      expect(state.account.contacts.maria?.tags).toContain('replied');
      const released = records(state, 'input').find((row) => row.reason === 'wait_released');
      expect(released?.data).toMatchObject({ cause: 'event', wait_kind: 'reply' });
      expect(released?.at).toBe('2026-09-03T09:30:00-05:00');
    },
  },
  {
    id: 'REPLY-002',
    behaviour:
      'A reply wait with a timeout moves on when the timeout passes without a reply, and says it timed out.',
    covers: 'WFL-006',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-ask',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [
          sms('s1', 'Reply YES to confirm.'),
          wait('w1', { wait_type: 'reply', channel: 'any', timeout_hours: 24 }),
          tag('t1', 'no-reply'),
        ],
      });
      const state = processEvent(createRun(clinicWith([wf])), enrol('wf-ask', 'maria'));
      expect(onlyRun(state).wait?.wake_reason).toBe('timeout');
      return advanceTo(state, '2026-09-04T09:00:00-05:00');
    },
    expect: (state) => {
      expect(records(state, 'input').some((row) => row.reason === 'wait_timed_out')).toBe(true);
      expect(state.account.contacts.maria?.tags).toContain('no-reply');
      expect(onlyRun(state).status).toBe('completed');
    },
  },

  /* ---- enrolment, overlap, duplicates --------------------------------------------------- */
  {
    id: 'ENROLL-002',
    behaviour: 'With re-entry on, a second enrolment of an active contact starts a second run.',
    covers: 'WFL-010',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        ...FOLLOW_UP,
        id: 'wf-reenter',
        settings: { allow_reentry: true },
      });
      const once = processEvent(createRun(clinicWith([wf])), enrol('wf-reenter', 'maria'));
      return processEvent(once, enrol('wf-reenter', 'maria', {}, '2026-09-03T09:05:00-05:00'));
    },
    expect: (state) => {
      expect(runsOf(state)).toHaveLength(2);
      expect(runsOf(state).map((run) => run.status)).toEqual(['waiting', 'waiting']);
      expect(records(state, 'trigger')[1]?.data).toMatchObject({ reentry: true });
    },
  },
  {
    id: 'OVERLAP-001',
    behaviour:
      'Two workflows on the same trigger both enrol, in a fixed order, and each run is its own.',
    covers: 'WFL-010, SIM-011',
    status: 'implemented',
    run: () => {
      const confirm = workflow({
        id: 'wf-a-confirm',
        trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
        nodes: [sms('s1', 'Booked!', 'confirmation')],
      });
      const alsoConfirm = workflow({
        id: 'wf-b-confirm-again',
        trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
        nodes: [sms('s1', 'You are booked.', 'confirmation')],
      });
      return processEvent(
        createRun(clinicWith([alsoConfirm, confirm])),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
    },
    expect: (state) => {
      expect(runsOf(state).map((run) => run.workflow_id)).toEqual([
        'wf-a-confirm',
        'wf-b-confirm-again',
      ]);
      const enrolments = eventsOf(state, 'WORKFLOW_ENROLLED');
      expect(enrolments.map((row) => row.payload.workflow_id)).toEqual([
        'wf-a-confirm',
        'wf-b-confirm-again',
      ]);
      expect(enrolments.every((row) => row.origin === 'generated')).toBe(true);
      // Two confirmations to one person: the overlap a learner should be able to spot.
      expect(messagesTo(state, 'maria').map((m) => m.workflow_id)).toEqual([
        'wf-a-confirm',
        'wf-b-confirm-again',
      ]);
    },
  },
  {
    id: 'MSG-003',
    behaviour:
      'Two bookings send two confirmations even with re-entry off, because re-entry only guards a run that is still active.',
    covers: 'WFL-010, SIM-011',
    status: 'implemented',
    run: () => {
      const confirm = workflow({
        id: 'wf-confirm',
        trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
        nodes: [sms('s1', 'You are booked.', 'confirmation')],
        settings: { allow_reentry: false },
      });
      let state = processEvent(
        createRun(clinicWith([confirm])),
        booked('maria', 'appt-1', SATURDAY_APPOINTMENT),
      );
      state = processEvent(
        state,
        booked('maria', 'appt-2', '2026-09-06T14:00:00-05:00', '2026-09-03T09:05:00-05:00'),
      );
      return state;
    },
    expect: (state) => {
      expect(messagesTo(state, 'maria')).toHaveLength(2);
      expect(runsOf(state).map((run) => run.status)).toEqual(['completed', 'completed']);
      expect(records(state, 'exit').map((row) => row.reason)).toEqual(['completed', 'completed']);
    },
  },

  /* ---- exits ---------------------------------------------------------------------------- */
  {
    id: 'EXIT-001',
    behaviour: 'Remove From Workflow ends the current run where it stands; nothing after it runs.',
    covers: 'WFL-010',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-stop',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [tag('t1', 'seen'), removeFrom('r1', 'this'), sms('s1', 'Never sent.')],
      });
      return processEvent(createRun(clinicWith([wf])), enrol('wf-stop', 'maria'));
    },
    expect: (state) => {
      expect(onlyRun(state).status).toBe('exited');
      expect(onlyRun(state).exit_reason).toBe('removed');
      expect(state.account.contacts.maria?.tags).toContain('seen');
      expect(messagesTo(state, 'maria')).toHaveLength(0);
      expect(records(state, 'exit')[0]?.data).toMatchObject({ removed_by: 'wf-stop' });
    },
  },
  {
    id: 'EXIT-002',
    behaviour:
      'A workflow that removes a contact from another workflow ends that run and drops its pending wake.',
    covers: 'WFL-010, WFL-006',
    status: 'implemented',
    run: () => {
      let state = processEvent(
        createRun(clinicWith([TAG_REMINDER, CANCELLATION], { appointments: [] })),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      state = processEvent(state, tagged('maria', 'booked'));
      expect(onlyRun(state, 'wf-tag-reminder').status).toBe('waiting');
      state = processEvent(state, cancelled('appt-sat', '2026-09-04T10:00:00-05:00'));
      expect(onlyRun(state, 'wf-tag-reminder').status).toBe('exited');
      expect(state.queue.filter((row) => row.type === 'WORKFLOW_RESUMED')).toHaveLength(0);
      return advanceTo(state, AN_HOUR_BEFORE);
    },
    expect: (state) => {
      expect(messagesTo(state, 'maria')).toHaveLength(0);
      expect(onlyRun(state, 'wf-tag-reminder').exit_reason).toBe('removed');
      expect(onlyRun(state, 'wf-cancellation').status).toBe('completed');
      expect(state.account.contacts.maria?.tags).toContain('cancelled');
      // The removal is attributed to the step that did it.
      expect(records(state, 'exit').find((row) => row.reason === 'removed')?.data).toMatchObject({
        removed_by: 'wf-cancellation',
        was_waiting: true,
      });
    },
  },
  {
    id: 'REM-002',
    behaviour:
      'A cancelled appointment receives no reminder from a tag-started reminder that checks the appointment status after its wait.',
    covers: 'WFL-006, WFL-007, SIM-011',
    status: 'implemented',
    run: () => {
      let state = processEvent(
        createRun(clinicWith([CAREFUL_REMINDER], { appointments: [] })),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      state = processEvent(state, tagged('maria', 'booked'));
      state = processEvent(state, cancelled('appt-sat', '2026-09-04T10:00:00-05:00'));
      return advanceTo(state, AN_HOUR_BEFORE);
    },
    expect: (state) => {
      expect(messagesTo(state, 'maria')).toHaveLength(0);
      expect(onlyRun(state).status).toBe('completed');
      const [result] = records(state, 'branch_result');
      expect(result?.data).toMatchObject({ chosen: 'None', fallback: true });
      // With no live appointment left, the status reads as missing: `is_not cancelled` fails
      // on a missing value, which is the explicit-missing rule the branch is built on.
      expect(result?.data).toMatchObject({
        branches: [
          {
            groups: [
              {
                conditions: [
                  {
                    field: 'appointment.status',
                    operator: 'is_not',
                    expected: 'cancelled',
                    actual: null,
                  },
                  {
                    field: 'appointment.status',
                    operator: 'is_not',
                    expected: 'no_show',
                    actual: null,
                  },
                ],
              },
            ],
          },
        ],
      });
    },
  },

  /* ---- triggers ------------------------------------------------------------------------- */
  {
    id: 'TRIGGER-001',
    behaviour: 'A trigger filter admits the events it names and nothing else.',
    covers: 'WFL-005',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-vip',
        trigger: {
          ghl_feature_id: 'GHL-WF-CONTACT-TAG',
          filters: [
            { field: 'change', operator: 'is', value: 'added' },
            { field: 'tag', operator: 'is', value: 'vip' },
          ],
        },
        nodes: [sms('s1', 'Welcome to the club.')],
      });
      let state = createRun(clinicWith([wf]));
      state = processEvent(
        state,
        event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'newsletter' }),
      );
      expect(runsOf(state)).toHaveLength(0);
      state = processEvent(state, event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'vip' }));
      expect(runsOf(state)).toHaveLength(1);
      // Removing the tag is a different change and does not enrol again.
      return processEvent(state, event('TAG_REMOVED', NOW, { contact_id: 'maria', tag: 'vip' }));
    },
    expect: (state) => {
      expect(runsOf(state)).toHaveLength(1);
      expect(records(state, 'trigger')[0]?.data).toMatchObject({
        trigger_values: { change: 'added', tag: 'vip' },
      });
      expect(messagesTo(state, 'maria')).toHaveLength(1);
    },
  },
  {
    id: 'TRIGGER-002',
    behaviour:
      'Customer Replied enrols on an inbound message, and the reply body is readable by a branch.',
    covers: 'WFL-005, CONV-001',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-replied',
        trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-REPLIED' },
        nodes: [
          ifElse('b1', [
            {
              name: 'Stop',
              groups: [
                { conditions: [{ field: 'message.body', operator: 'contains', value: 'stop' }] },
              ],
            },
          ]),
          tag('t1', 'opted-out'),
          tag('t2', 'engaged'),
        ],
        edges: [edge('b1', 't1', 'Stop'), edge('b1', 't2', 'None')],
      });
      let state = processEvent(
        createRun(clinicWith([wf])),
        reply('maria', 'Please STOP texting', NOW),
      );
      state = processEvent(state, reply('lena', 'Sounds good', '2026-09-03T09:01:00-05:00'));
      return state;
    },
    expect: (state) => {
      expect(state.account.contacts.maria?.tags).toContain('opted-out');
      expect(state.account.contacts.lena?.tags).toContain('engaged');
      expect(runsOf(state).map((run) => run.context.message_id)).toEqual([
        expect.stringMatching(/^msg-/),
        expect.stringMatching(/^msg-/),
      ]);
    },
  },

  {
    id: 'TRIGGER-003',
    behaviour:
      'Appointment Status filtered to No-show enrols from a no-show and never from a cancellation, and the trigger record names the status it matched.',
    covers: 'WFL-004, WFL-005',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-no-show-only',
        trigger: {
          ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
          filters: [{ field: 'appointment_status', operator: 'is', value: 'no_show' }],
        },
        nodes: [sms('s1', 'Sorry we missed you.')],
      });
      let state = processEvent(
        createRun(clinicWith([wf])),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      // Booking is the status "new": no match. Cancelling is "cancelled": no match either.
      expect(runsOf(state)).toHaveLength(0);
      state = processEvent(state, cancelled('appt-sat', '2026-09-04T10:00:00-05:00'));
      expect(runsOf(state)).toHaveLength(0);
      // A second booking that is then a no-show is the one event the filter admits.
      state = processEvent(state, booked('maria', 'appt-sun', '2026-09-06T10:00:00-05:00'));
      return processEvent(
        state,
        event('APPOINTMENT_STATUS_CHANGED', '2026-09-06T10:40:00-05:00', {
          appointment_id: 'appt-sun',
          status: 'no_show',
        }),
      );
    },
    expect: (state) => {
      const runs = runsOf(state);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        contact_id: 'maria',
        context: { appointment_id: 'appt-sun' },
      });
      expect(runs[0]?.context.trigger_event_id).toMatch(/^ev-/);
      const trigger = records(state, 'trigger', runs[0]?.id)[0];
      expect(trigger?.data).toMatchObject({
        enrolled_by: 'trigger',
        trigger_feature: 'GHL-WF-APPOINTMENT-STATUS',
        trigger_values: { appointment_status: 'no_show' },
      });
      // One text, for the no-show; nothing for the booking or the cancellation of appt-sat.
      expect(messagesTo(state, 'maria')).toHaveLength(1);
      expect(runs.some((run) => run.context.appointment_id === 'appt-sat')).toBe(false);
    },
  },
  {
    id: 'TRIGGER-004',
    behaviour:
      'A contact enrolled directly (a test started at the first step) is recorded as a direct enrolment, never as the configured trigger firing, and the run replays identically.',
    covers: 'WFL-004, SIM-013',
    status: 'implemented',
    run: () => {
      const wf = workflow({
        id: 'wf-no-show-only',
        trigger: {
          ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
          filters: [{ field: 'appointment_status', operator: 'is', value: 'no_show' }],
        },
        nodes: [sms('s1', 'Sorry we missed you.')],
      });
      const authored = clinicWith([wf]);
      // Maria's appointment is live and was never a no-show; a direct enrolment still walks her.
      const live = processEvent(
        createRun(authored),
        enrol('wf-no-show-only', 'maria', {
          context: { appointment_id: 'appt-maria' },
          test: true,
        }),
      );
      const replayed = replay(authored, live.log, { run_id: live.run_id });
      expect(stateHash(replayed)).toBe(stateHash(live));
      expect(historyHash(replayed)).toBe(historyHash(live));
      expect(replayed.execution).toEqual(live.execution);
      return live;
    },
    expect: (state) => {
      const run = onlyRun(state, 'wf-no-show-only');
      expect(run.context.trigger_event_id).toBeNull();
      const trigger = records(state, 'trigger', run.id)[0];
      expect(trigger?.data).toMatchObject({
        enrolled_by: 'direct',
        test: true,
        trigger_event_id: null,
        trigger_values: null,
      });
      // The status Appointment Status would have needed never appears as a matched value.
      expect(JSON.stringify(trigger?.data.trigger_values)).not.toContain('no_show');
      expect(messagesTo(state, 'maria')).toHaveLength(1);
    },
  },

  /* ---- replay --------------------------------------------------------------------------- */
  {
    id: 'REPLAY-002',
    behaviour:
      'A run with waits, wakes, branches and removals replays from its scenario and log to the same state, records and queue.',
    covers: 'SIM-013, SIM-018, WFL-010',
    status: 'implemented',
    run: () => {
      const authored = clinicWith([REMINDER, CANCELLATION, FOLLOW_UP]);
      let live = processEvent(
        createRun(authored),
        booked('maria', 'appt-sat', SATURDAY_APPOINTMENT),
      );
      live = processEvent(live, enrol('wf-followup', 'lena'));
      live = processEvent(live, cancelled('appt-sat', '2026-09-04T10:00:00-05:00'));
      live = advanceTo(live, '2026-09-04T09:00:00-05:00');
      const replayed = replay(authored, live.log, { run_id: live.run_id });
      expect(stateHash(replayed)).toBe(stateHash(live));
      expect(historyHash(replayed)).toBe(historyHash(live));
      expect(replayed.execution).toEqual(live.execution);
      expect(replayed.queue).toEqual(live.queue);
      return live;
    },
    expect: (state) => {
      expect(eventsOf(state, 'WORKFLOW_RESUMED').some((row) => row.origin === 'scheduled')).toBe(
        true,
      );
      expect(onlyRun(state, 'wf-reminder')).toMatchObject({
        status: 'exited',
        exit_reason: 'appointment_cancelled',
      });
      // Lena's follow-up ran its day; the cancellation's tag enrolled Maria in the same follow-up,
      // and hers is still waiting — workflows reacting to each other is exactly what replay
      // has to reproduce.
      const followUps = runsOf(state, 'wf-followup');
      expect(followUps.map((run) => [run.contact_id, run.status])).toEqual([
        ['lena', 'completed'],
        ['maria', 'waiting'],
      ]);
    },
  },
];
