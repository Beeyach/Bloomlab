import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildReport,
  contentEventName,
  funnelAutopsy,
  processEvent,
  validateScenario,
  type Report,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { BloomlabDatabase } from '../data/db';
import { startRun, type StoredRun } from '../simulator/store';
import { pendingCount, reportFor, runWindow, windowEnd } from './window';

/**
 * REP-001 reconciliation: every number in the report is checked against the run's own history.
 *
 * The point of this file is that nothing is taken on trust. A metric is not compared with a
 * remembered figure; it is compared with the events and records it claims to come from, counted
 * again here from the log. If the projection and the log ever disagree, one of them is wrong and
 * this says which.
 *
 * The cohort is small enough to add up by hand, and the raw facts are written out below so a
 * reviewer can check the arithmetic without reverse-engineering two hundred and sixty-seven
 * events (§54).
 *
 *   40 visits   → 14 leads    → 11 booked   → 9 due, 4 showed → 3 sold
 *   meta-ads 20 · google-search 12 · instagram-bio 8
 *   revenue 2160 received − 480 refunded = 1680, and one failed payment worth nothing
 *   open pipeline 480 + 480 + 1200 = 2160; one lost and one abandoned deal are outside it
 *   12 leads were texted (one had no number, one asked not to be), 5 of them replied
 *   time to contact: median 6 minutes, two leads never contacted
 */

const SCENARIO_ID = 'SC-glowhaus-reporting';

const scenario = (): SimulatorScenario => {
  const found = (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === SCENARIO_ID,
  );
  if (!found) throw new Error(`${SCENARIO_ID} is not in the content bundle`);
  return found;
};

let database: BloomlabDatabase;
let run: StoredRun;
let report: Report;

const options = () => ({ database, createWorker: null });

/** Events of one authored name, counted from the run's own log rather than from the report. */
const logged = (type: string) =>
  run.state.log.filter((event) => contentEventName(event.type) === type);

beforeEach(async () => {
  database = new BloomlabDatabase(`reporting-${Math.random().toString(36).slice(2)}`);
  run = await startRun(scenario(), database);
  const result = await runWindow(run, scenario(), options());
  if (!result) throw new Error('The scenario queued no history to run');
  if (!result.ok) throw new Error(`The window was refused: ${result.refusal.message}`);
  run = result.run;
  report = reportFor(run);
});

describe('the scenario is runnable and its history is real', () => {
  it('compiles with no issues', () => {
    expect(validateScenario(scenario())).toEqual([]);
  });

  it('starts with nothing to report and every fact still queued', async () => {
    const fresh = await startRun(scenario(), database);
    const before = reportFor(fresh);
    expect(before.empty).toBe(true);
    expect(before.metrics.leads.value).toBe(0);
    expect(pendingCount(fresh.state)).toBeGreaterThan(200);
    expect(windowEnd(fresh.state)).not.toBeNull();
  });

  it('holds no contact, payment or opportunity before the window runs', async () => {
    const fresh = await startRun(scenario(), database);
    expect(Object.keys(fresh.state.account.contacts)).toEqual([]);
    expect(Object.keys(fresh.state.account.payments)).toEqual([]);
    expect(Object.keys(fresh.state.account.opportunities)).toEqual([]);
    expect(Object.keys(fresh.state.account.funnel_visits)).toEqual([]);
  });

  it('leaves nothing queued once the window has run', () => {
    expect(pendingCount(run.state)).toBe(0);
    expect(report.empty).toBe(false);
  });
});

describe('REP-001: the ten metrics reconcile with the event log', () => {
  it('counts leads as the contacts the log actually created', () => {
    const created = logged('contact.created');
    expect(created).toHaveLength(14);
    expect(report.metrics.leads.value).toBe(created.length);
    // Provenance is not decoration: every id the metric cites is a real event of this run.
    expect(report.metrics.leads.evidence_event_ids.sort()).toEqual(
      created.map((event) => event.id).sort(),
    );
    // And the account's own counter agrees, because the cohort definitions match (§47).
    expect(run.state.account.analytics.contacts_created).toBe(created.length);
  });

  it('maps conversion to funnel visits that ended up identified', () => {
    const visits = Object.values(run.state.account.funnel_visits);
    const identified = visits.filter((visit) => visit.contact_id !== null);
    expect(visits).toHaveLength(40);
    expect(identified).toHaveLength(14);
    expect(report.metrics.conversion.numerator).toBe(14);
    expect(report.metrics.conversion.denominator).toBe(40);
    expect(report.metrics.conversion.value).toBeCloseTo(0.35, 10);
  });

  it('maps booking rate to leads with a real appointment.booked event', () => {
    const booked = logged('appointment.booked');
    expect(booked).toHaveLength(11);
    const people = new Set(booked.map((event) => event.payload.contact_id));
    expect(people.size).toBe(11);
    expect(report.metrics.booking_rate.numerator).toBe(11);
    expect(report.metrics.booking_rate.denominator).toBe(14);
  });

  it('states the show-rate denominator and excludes cancelled and not-yet-due bookings', () => {
    const appointments = Object.values(run.state.account.appointments);
    expect(appointments).toHaveLength(11);
    expect(appointments.filter((a) => a.status === 'cancelled')).toHaveLength(1);
    expect(appointments.filter((a) => a.status === 'showed')).toHaveLength(4);
    expect(appointments.filter((a) => a.status === 'no_show')).toHaveLength(5);
    // One booking is still ahead of the clock: it is neither a show nor a miss yet.
    expect(report.appointments).toMatchObject({
      booked: 11,
      cancelled: 1,
      not_yet_due: 1,
      due: 9,
      showed: 4,
      no_show: 5,
      still_open: 0,
    });
    expect(report.metrics.show_rate.numerator).toBe(4);
    expect(report.metrics.show_rate.denominator).toBe(9);
  });

  it('takes close rate from won opportunities, never from a tag', () => {
    const showed = Object.values(run.state.account.appointments)
      .filter((a) => a.status === 'showed')
      .map((a) => a.contact_id);
    expect(new Set(showed).size).toBe(4);
    const won = Object.values(run.state.account.opportunities).filter((o) => o.status === 'won');
    expect(won).toHaveLength(3);
    expect(won.every((o) => showed.includes(o.contact_id))).toBe(true);
    expect(report.metrics.close_rate.numerator).toBe(3);
    expect(report.metrics.close_rate.denominator).toBe(4);
  });

  it('takes revenue from payment and refund events, not from product prices', () => {
    const received = logged('payment.received');
    const failed = logged('payment.failed');
    const refunded = logged('refund.issued');
    expect(received).toHaveLength(3);
    expect(failed).toHaveLength(1);
    expect(refunded).toHaveLength(1);
    const sum = received.reduce((total, event) => total + (event.payload.amount as number), 0);
    expect(sum).toBe(2160);
    expect(report.metrics.revenue.value).toBe(1680);
    expect(report.metrics.revenue.numerator).toBe(2160);
    expect(report.metrics.revenue.denominator).toBe(480);
    // The account's own revenue counter is kept by the reducers and must agree (§47).
    expect(run.state.account.analytics.revenue).toBe(report.metrics.revenue.value);
    // A declined card is worth nothing, and its product's list price is not revenue either.
    expect(run.state.account.products['glow-membership']?.price).toBe(149);
  });

  it('sums open pipeline from open opportunities only', () => {
    const opportunities = Object.values(run.state.account.opportunities);
    expect(opportunities.filter((o) => o.status === 'open')).toHaveLength(3);
    expect(opportunities.filter((o) => o.status === 'lost')).toHaveLength(1);
    expect(opportunities.filter((o) => o.status === 'abandoned')).toHaveLength(1);
    expect(report.metrics.pipeline_value.value).toBe(2160);
    expect(report.metrics.pipeline_value.numerator).toBe(3);
  });

  it('breaks performance down by source and never hides a sample size', () => {
    const bySource = Object.fromEntries(report.sources.map((row) => [row.source, row]));
    expect(bySource['meta-ads']).toMatchObject({ visits: 20, leads: 6 });
    expect(bySource['google-search']).toMatchObject({ visits: 12, leads: 6 });
    expect(bySource['instagram-bio']).toMatchObject({ visits: 8, leads: 2 });
    const visits = report.sources.reduce((total, row) => total + row.visits, 0);
    const leads = report.sources.reduce((total, row) => total + row.leads, 0);
    expect(visits).toBe(40);
    expect(leads).toBe(14);
    expect(report.metrics.source_performance.value).toBe(3);
  });

  it('counts response rate against the messages that actually went out', () => {
    // Two leads were never reached: one filled the form in with no phone number, and one asked
    // not to be texted. Both sends are in the log as skipped actions and neither is a message.
    const skipped = run.state.execution.filter((row) => row.kind === 'action_skipped');
    expect(skipped.map((row) => row.reason).sort()).toEqual(['dnd', 'missing_phone']);
    const conversations = Object.values(run.state.account.conversations);
    const messaged = conversations.filter((c) =>
      c.messages.some((m) => m.direction === 'outbound'),
    );
    const replied = messaged.filter((c) => c.messages.some((m) => m.direction === 'inbound'));
    expect(messaged).toHaveLength(12);
    expect(replied).toHaveLength(5);
    expect(report.metrics.response_rate.numerator).toBe(5);
    expect(report.metrics.response_rate.denominator).toBe(12);
  });

  it('measures time to contact in simulator time and counts the leads nobody messaged', () => {
    expect(report.speed.contacted).toBe(12);
    expect(report.speed.never_contacted).toBe(2);
    expect(report.speed.never_contacted_ids.sort()).toEqual(['lena', 'nell']);
    expect(report.speed.median_minutes).toBe(6);
    // The mean is dragged a long way by one lead who waited a day. Both are exposed, because a
    // report that showed only the mean would say Glowhaus takes two hours to answer.
    expect(report.speed.mean_minutes).toBeGreaterThan(100);
    expect(report.metrics.time_to_contact.value).toBe(6);
    expect(report.metrics.time_to_contact.numerator).toBe(12);
    expect(report.metrics.time_to_contact.denominator).toBe(14);
    expect(Math.max(...report.speed.samples)).toBe(1445);
  });
});

describe('REP-001: the chain and the definitions', () => {
  it('reads as one chain from visitor to sale', () => {
    expect(report.stages.map((row) => [row.id, row.count])).toEqual([
      ['visits', 40],
      ['leads', 14],
      ['booked', 11],
      ['showed', 4],
      ['sold', 3],
    ]);
    expect(report.stages[1]?.lost).toBe(26);
    expect(report.stages[3]?.lost).toBe(7);
  });

  it('carries a definition and a status with every metric', () => {
    for (const value of report.ordered) {
      expect(value.definition.length).toBeGreaterThan(10);
      expect(value.status).toBe('ok');
    }
    expect(report.ordered).toHaveLength(10);
  });

  it('keeps a current-state snapshot apart from a window fact', () => {
    expect(report.metrics.pipeline_value.basis).toBe('snapshot');
    expect(report.metrics.revenue.basis).toBe('window');
  });
});

describe('REP-001: nothing is invented when there is nothing to divide', () => {
  it('reports no value rather than a confident zero on an empty run', async () => {
    const fresh = await startRun(scenario(), database);
    const empty = reportFor(fresh);
    for (const id of [
      'conversion',
      'booking_rate',
      'show_rate',
      'close_rate',
      'response_rate',
    ] as const) {
      expect(empty.metrics[id].value).toBeNull();
      expect(empty.metrics[id].status).toBe('no_data');
      expect(empty.metrics[id].denominator).toBe(0);
    }
    expect(empty.metrics.leads.value).toBe(0);
    expect(empty.metrics.revenue.value).toBe(0);
    expect(empty.metrics.time_to_contact.value).toBeNull();
    expect(empty.speed.never_contacted).toBe(0);
  });
});

describe('REP-001: the report survives reset and replay', () => {
  it('comes out identical when the same history is run twice', async () => {
    const second = await startRun(scenario(), new BloomlabDatabase(`reporting-twin`));
    const result = await runWindow(second, scenario(), {
      database: new BloomlabDatabase('reporting-twin'),
      createWorker: null,
    });
    if (!result || !result.ok) throw new Error('The twin run could not run its window');
    const twin = buildReport(result.run.state);
    expect(twin.stages).toEqual(report.stages);
    expect(twin.sources).toEqual(report.sources);
    expect(twin.speed).toEqual(report.speed);
    for (const id of Object.keys(report.metrics) as (keyof typeof report.metrics)[]) {
      expect(twin.metrics[id].value).toEqual(report.metrics[id].value);
    }
  });
});

describe('REP-001 audit regressions', () => {
  it('counts a booking whose appointment id was minted by the reducer', () => {
    const next = processEvent(run.state, {
      type: 'APPOINTMENT_BOOKED',
      at: run.state.clock.now,
      origin: 'injected',
      source: { kind: 'injector_action', id: 'reporting-audit' },
      payload: {
        contact_id: 'lena',
        calendar_id: 'consultation',
        starts_at: '2026-09-10T10:00:00-05:00',
        booked_by: 'staff',
      },
    });
    const booking = next.log.find(
      (event) => event.type === 'APPOINTMENT_BOOKED' && event.payload.appointment_id === undefined,
    );
    if (!booking) throw new Error('The id-less booking did not reach history');
    expect(next.account.appointments[`appt-${booking.id}`]).toBeDefined();

    const after = buildReport(next);
    expect(after.metrics.booking_rate.numerator).toBe(12);
    expect(after.metrics.booking_rate.evidence_event_ids).toContain(booking.id);
  });
});

describe('FUN-004: the Funnel Autopsy reads the same traffic', () => {
  it('exposes all six views from the run', () => {
    const autopsy = funnelAutopsy(run.state, 'fn-consult');
    if (!autopsy) throw new Error('The funnel is not in the account');
    expect(autopsy.empty).toBe(false);
    expect(autopsy.visits).toBe(40);

    // 1. traffic source, with sample sizes
    expect(autopsy.traffic.map((row) => [row.source, row.visits])).toEqual([
      ['meta-ads', 20],
      ['google-search', 12],
      ['instagram-bio', 8],
    ]);

    // 2. conversion
    expect(autopsy.conversion).toMatchObject({ numerator: 14, denominator: 40 });

    // 3. reach, in blocks rather than pixels
    const landing = autopsy.reach.find((row) => row.step_id === 'st-landing');
    expect(landing).toMatchObject({ views: 40, blocks: 4 });
    expect(landing?.by_level).toEqual({ top: 6, middle: 5, bottom: 29 });
    const apply = autopsy.reach.find((row) => row.step_id === 'st-apply');
    expect(apply).toMatchObject({ views: 26, blocks: 2 });

    // 4. form completion, both counts visible
    expect(autopsy.form_completion).toMatchObject({ starts: 22, submissions: 14 });
    expect(autopsy.form_completion.value).toBeCloseTo(14 / 22, 10);

    // 5. booking rate, on the denominator the chain uses
    expect(autopsy.booking).toMatchObject({ numerator: 11, denominator: 14 });
    expect(autopsy.booking_denominator).toContain('lead');

    // 6. drop-off, by the step sessions ended on
    const dropOff = Object.fromEntries(autopsy.drop_off.map((row) => [row.step_id, row.left]));
    expect(dropOff).toEqual({
      'st-landing': 14,
      'st-apply': 12,
      'st-book': 3,
      'st-thanks': 0,
    });
  });

  it('says nothing about a funnel with no traffic rather than showing zeroes', () => {
    const other = funnelAutopsy(
      {
        ...run.state,
        account: {
          ...run.state.account,
          funnel_visits: {},
        },
      },
      'fn-consult',
    );
    expect(other?.empty).toBe(true);
    expect(other?.conversion.value).toBeNull();
    expect(other?.form_completion.value).toBeNull();
    expect(other?.booking.value).toBeNull();
  });

  it('excludes another funnel\u2019s traffic', () => {
    const withOther = {
      ...run.state,
      account: {
        ...run.state.account,
        funnels: {
          ...run.state.account.funnels,
          'fn-other': { id: 'fn-other', name: 'Other', steps: [], version: 1 },
        },
        funnel_visits: {
          ...run.state.account.funnel_visits,
          'v-other': {
            id: 'v-other',
            funnel_id: 'fn-other',
            source: 'meta-ads',
            started_at: run.state.clock.now,
            steps: [],
            forms_started: [],
            contact_id: null,
            contact_is_new: false,
            ended_at: run.state.clock.now,
            ended_reason: 'left' as const,
            last_step_id: null,
          },
        },
      },
    };
    expect(funnelAutopsy(withOther, 'fn-consult')?.visits).toBe(40);
    expect(funnelAutopsy(withOther, 'fn-other')?.visits).toBe(1);
  });

  it('does not give this funnel a booking explicitly linked to another funnel visit', () => {
    const seeded = {
      ...run.state,
      account: {
        ...run.state.account,
        funnels: {
          ...run.state.account.funnels,
          'fn-other': { id: 'fn-other', name: 'Other', steps: [], version: 1 },
        },
        funnel_visits: {
          ...run.state.account.funnel_visits,
          'v-other-linked': {
            id: 'v-other-linked',
            funnel_id: 'fn-other',
            source: 'meta-ads',
            started_at: run.state.clock.now,
            steps: [],
            forms_started: [],
            contact_id: 'lena',
            contact_is_new: false,
            ended_at: run.state.clock.now,
            ended_reason: 'completed' as const,
            last_step_id: null,
          },
        },
      },
    };
    const linked = processEvent(seeded, {
      type: 'APPOINTMENT_BOOKED',
      at: run.state.clock.now,
      origin: 'injected',
      source: { kind: 'injector_action', id: 'autopsy-audit' },
      payload: {
        appointment_id: 'ap-other-linked',
        contact_id: 'lena',
        calendar_id: 'consultation',
        starts_at: '2026-09-10T11:00:00-05:00',
        booked_by: 'staff',
        visit_id: 'v-other-linked',
      },
    });

    expect(funnelAutopsy(linked, 'fn-consult')?.booking.numerator).toBe(11);
    expect(funnelAutopsy(linked, 'fn-other')?.booking).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
  });
});
