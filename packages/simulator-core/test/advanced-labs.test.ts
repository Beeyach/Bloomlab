import { describe, it, expect } from 'vitest';
import {
  createRun,
  processEvent,
  paymentsCatalog,
  slotAt,
  replay,
  historyHash,
  type SimulatorState,
  type SimulatorEventType,
  type SimulatorScenario,
} from '../src/index.ts';

const scenario: SimulatorScenario = {
  id: 'SC-advanced-labs',
  simulation_time: '2026-09-09T09:00:00Z',
  timezone: 'UTC',
  seed: 25,
  initial_account_state: {
    users: [
      { id: 'host', name: 'Host' },
      { id: 'other', name: 'Other' },
    ],
    contacts: [
      { id: 'a', first_name: 'Ada' },
      { id: 'b', first_name: 'Bo' },
      { id: 'c', first_name: 'Cy' },
    ],
    workflows: ['success', 'failed', 'refund'].map((status) => ({
      id: `wf-${status}`,
      name: status,
      trigger: {
        ghl_feature_id: status === 'refund' ? 'GHL-WF-REFUND' : 'GHL-WF-PAYMENT-RECEIVED',
        filters:
          status === 'refund' ? [] : [{ field: 'payment_status', operator: 'is', value: status }],
      },
      nodes: [
        {
          id: 'tag',
          type: 'action',
          ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
          config: { tag: status },
          position: { x: 0, y: 0 },
        },
        { id: 'end', type: 'end', position: { x: 0, y: 100 } },
      ],
      edges: [{ from: 'tag', to: 'end' }],
      settings: { allow_reentry: true },
    })),
  },
};
const start = () => createRun(scenario, { run_id: 'advanced-labs' });
const fire = (state: SimulatorState, type: SimulatorEventType, payload: Record<string, unknown>) =>
  processEvent(state, { type, payload, at: state.clock.now, origin: 'injected' });
const calendar = {
  id: 'classroom',
  name: 'Training class',
  type: 'class',
  seats_per_class: 2,
  duration_minutes: 60,
  slot_interval_minutes: 30,
  staff_ids: ['host'],
  availability: [{ day: 3, start: '09:00', end: '17:00' }],
};
const at = (state: SimulatorState, id: string, time = '2026-09-09T10:00:00Z', service?: string) =>
  slotAt(state.account, state.account.calendars[id]!, state.clock.now, time, {
    service_id: service,
  });

describe('CAL-002 shared constraints', () => {
  it('uses peak simultaneous resource occupancy, not the count of sequential bookings', () => {
    let state = fire(start(), 'RESOURCE_SAVED', { id: 'shared', name: 'Shared room', capacity: 2 });
    const service = { id: 'consult', name: 'Consultation', resource_ids: ['shared'] };
    for (const [id, host] of [
      ['first', 'host'],
      ['second', 'other'],
    ])
      state = fire(state, 'CALENDAR_CREATED', {
        calendar: { ...calendar, id, type: 'service', staff_ids: [host], services: [service] },
      });
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'one',
      contact_id: 'a',
      calendar_id: 'first',
      service_id: 'consult',
      starts_at: '2026-09-09T10:00:00Z',
    });
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'two',
      contact_id: 'b',
      calendar_id: 'first',
      service_id: 'consult',
      starts_at: '2026-09-09T11:00:00Z',
    });
    expect(
      slotAt(
        state.account,
        state.account.calendars.second!,
        state.clock.now,
        '2026-09-09T10:00:00Z',
        { service_id: 'consult', duration_minutes: 120 },
      )?.resource_id,
    ).toBe('shared');
    expect(() =>
      fire(state, 'APPOINTMENT_BOOKED', {
        appointment_id: 'bypass',
        contact_id: 'c',
        calendar_id: 'second',
        starts_at: '2026-09-09T10:00:00Z',
      }),
    ).toThrow();
  });
  it('consumes class seats across overlapping starts, refuses overflow and reopens on cancellation', () => {
    let state = fire(start(), 'CALENDAR_CREATED', { calendar });
    expect(at(state, 'classroom')?.seats_remaining).toBe(2);
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'one',
      contact_id: 'a',
      calendar_id: 'classroom',
      starts_at: '2026-09-09T10:00:00Z',
      duration_minutes: 500,
    });
    expect(state.account.appointments.one?.duration_minutes).toBe(60);
    expect(at(state, 'classroom', '2026-09-09T10:30:00Z')?.seats_remaining).toBe(1);
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'two',
      contact_id: 'b',
      calendar_id: 'classroom',
      starts_at: '2026-09-09T10:30:00Z',
    });
    expect(at(state, 'classroom')).toBeNull();
    expect(() =>
      fire(state, 'APPOINTMENT_BOOKED', {
        appointment_id: 'three',
        contact_id: 'c',
        calendar_id: 'classroom',
        starts_at: '2026-09-09T10:00:00Z',
      }),
    ).toThrow();
    state = fire(state, 'APPOINTMENT_CANCELLED', { appointment_id: 'one' });
    expect(at(state, 'classroom')?.seats_remaining).toBe(1);
    expect(historyHash(replay(scenario, state.log, { run_id: state.run_id }))).toBe(
      historyHash(state),
    );
  });
  it('still respects notice and host conflicts on another calendar; rescheduling cannot overbook', () => {
    let state = fire(start(), 'CALENDAR_CREATED', { calendar });
    state = fire(state, 'CALENDAR_CREATED', {
      calendar: { ...calendar, id: 'other', type: 'personal' },
    });
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'other-booking',
      contact_id: 'a',
      calendar_id: 'other',
      starts_at: '2026-09-09T10:00:00Z',
      host_id: 'host',
    });
    expect(at(state, 'classroom')).toBeNull();
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'class-booking',
      contact_id: 'b',
      calendar_id: 'classroom',
      starts_at: '2026-09-09T12:00:00Z',
    });
    expect(() =>
      fire(state, 'APPOINTMENT_RESCHEDULED', {
        appointment_id: 'class-booking',
        starts_at: '2026-09-09T10:00:00Z',
      }),
    ).toThrow();
    state = fire(state, 'CALENDAR_UPDATED', {
      calendar_id: 'classroom',
      calendar: { ...calendar, minimum_notice_minutes: 300 },
    });
    expect(at(state, 'classroom', '2026-09-09T12:00:00Z')).toBeNull();
  });
  it('reserves one available service resource across calendars and releases it on cancellation', () => {
    let state = start();
    for (const id of ['room-one', 'room-two'])
      state = fire(state, 'RESOURCE_SAVED', { id, name: id, capacity: 1 });
    const service = { id: 'consult', name: 'Consultation', resource_ids: ['room-one', 'room-two'] };
    for (const [id, host] of [
      ['first', 'host'],
      ['second', 'other'],
    ])
      state = fire(state, 'CALENDAR_CREATED', {
        calendar: { ...calendar, id, type: 'service', staff_ids: [host], services: [service] },
      });
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'one',
      contact_id: 'a',
      calendar_id: 'first',
      service_id: 'consult',
      starts_at: '2026-09-09T10:00:00Z',
    });
    expect(state.account.appointments.one?.resource_id).toBe('room-one');
    expect(at(state, 'second', undefined, 'consult')?.resource_id).toBe('room-two');
    state = fire(state, 'APPOINTMENT_BOOKED', {
      appointment_id: 'two',
      contact_id: 'b',
      calendar_id: 'second',
      service_id: 'consult',
      starts_at: '2026-09-09T10:00:00Z',
    });
    expect(state.account.appointments.two?.resource_id).toBe('room-two');
    state = fire(state, 'APPOINTMENT_CANCELLED', { appointment_id: 'one' });
    expect(at(state, 'first', undefined, 'consult')?.resource_id).toBe('room-one');
    expect(() => fire(state, 'RESOURCE_SAVED', { id: 'bad', name: 'Bad', capacity: 0 })).toThrow();
    expect(historyHash(replay(scenario, state.log, { run_id: state.run_id }))).toBe(
      historyHash(state),
    );
  });
});

const catalogRun = () => {
  let state = fire(start(), 'PRODUCT_SAVED', { id: 'maintenance', name: 'Training maintenance' });
  for (const [id, interval] of [
    ['once', 'one_time'],
    ['monthly', 'month'],
  ])
    state = fire(state, 'PRICE_CREATED', {
      id,
      name: id,
      product_id: 'maintenance',
      cents: 2500,
      interval,
    });
  state = fire(state, 'PAYMENT_LINK_SAVED', {
    id: 'link',
    name: 'Monthly plan',
    price_id: 'monthly',
    active: true,
  });
  return state;
};
describe('PAY-001 shared payment lifecycle', () => {
  it('runs a failed invoice, successful retry and refund through workflows and real revenue', () => {
    let state = fire(catalogRun(), 'INVOICE_CREATED', {
      id: 'invoice',
      contact_id: 'a',
      price_id: 'once',
    });
    state = fire(state, 'PAYMENT_CHECKOUT', {
      id: 'failed',
      source: 'invoice',
      target_id: 'invoice',
      outcome: 'failed',
      reason: 'Synthetic decline',
    });
    expect(state.account.analytics.revenue).toBe(0);
    expect(state.account.contacts.a?.tags).toContain('failed');
    expect(paymentsCatalog(state.account).invoices.invoice?.status).toBe('open');
    state = fire(state, 'PAYMENT_CHECKOUT', {
      id: 'retry',
      source: 'invoice',
      target_id: 'invoice',
      outcome: 'success',
    });
    expect(state.account.analytics.revenue).toBe(25);
    expect(state.account.contacts.a?.tags).toContain('success');
    expect(paymentsCatalog(state.account).invoices.invoice?.status).toBe('paid');
    expect(() =>
      fire(state, 'PAYMENT_CHECKOUT', {
        id: 'duplicate',
        source: 'invoice',
        target_id: 'invoice',
        outcome: 'success',
      }),
    ).toThrow();
    state = fire(state, 'REFUND_ISSUED', { payment_id: 'retry', reason: 'Synthetic refund' });
    expect(state.account.analytics.revenue).toBe(0);
    expect(state.account.contacts.a?.tags).toContain('refund');
    expect(() => fire(state, 'REFUND_ISSUED', { payment_id: 'retry' })).toThrow();
    expect(historyHash(replay(scenario, state.log, { run_id: state.run_id }))).toBe(
      historyHash(state),
    );
  });
  it('distinguishes recurring terms, explicit renewal failures, refunds and cancellation', () => {
    let state = fire(catalogRun(), 'PAYMENT_CHECKOUT', {
      id: 'first',
      source: 'payment_link',
      target_id: 'link',
      contact_id: 'a',
      subscription_id: 'subscription',
      outcome: 'success',
    });
    expect(paymentsCatalog(state.account).subscriptions.subscription?.successful_charges).toBe(1);
    state = fire(state, 'PAYMENT_CHECKOUT', {
      id: 'renewal',
      source: 'subscription',
      target_id: 'subscription',
      outcome: 'failed',
      reason: 'Synthetic decline',
    });
    expect(paymentsCatalog(state.account).subscriptions.subscription?.status).toBe('past_due');
    state = fire(state, 'PAYMENT_CHECKOUT', {
      id: 'retry',
      source: 'subscription',
      target_id: 'subscription',
      outcome: 'success',
    });
    expect(state.account.analytics.revenue).toBe(50);
    expect(paymentsCatalog(state.account).subscriptions.subscription?.status).toBe('active');
    state = fire(state, 'REFUND_ISSUED', { payment_id: 'first' });
    expect(paymentsCatalog(state.account).subscriptions.subscription?.status).toBe('active');
    state = fire(state, 'SUBSCRIPTION_CANCELLED', { id: 'subscription' });
    expect(() =>
      fire(state, 'PAYMENT_CHECKOUT', {
        id: 'late',
        source: 'subscription',
        target_id: 'subscription',
        outcome: 'success',
      }),
    ).toThrow();
    expect(state.account.analytics.revenue).toBe(25);
  });
  it('refuses malformed amounts, mutable prices, dangling references, disabled links and repeated attempts', () => {
    let state = catalogRun();
    expect(state.account.products.maintenance?.price).toBe(25);
    expect(state.account.products.maintenance?.recurring).toBe(false);
    const incomplete = fire(state, 'PAYMENT_CHECKOUT', {
      id: 'initial-failure',
      source: 'payment_link',
      target_id: 'link',
      contact_id: 'a',
      subscription_id: 'not-started',
      outcome: 'failed',
      reason: 'Synthetic initial decline',
    });
    expect(paymentsCatalog(incomplete.account).subscriptions['not-started']?.status).toBe(
      'incomplete',
    );
    expect(() =>
      fire(incomplete, 'PAYMENT_CHECKOUT', {
        id: 'initial-failure',
        source: 'subscription',
        target_id: 'not-started',
        outcome: 'success',
      }),
    ).toThrow();
    for (const cents of [-1, 0, 0.5, NaN, Infinity, 100_000_001])
      expect(() =>
        fire(state, 'PRICE_CREATED', {
          id: 'bad',
          name: 'Bad',
          product_id: 'maintenance',
          cents,
          interval: 'one_time',
        }),
      ).toThrow();
    expect(() =>
      fire(state, 'PRICE_CREATED', {
        id: 'once',
        name: 'Again',
        product_id: 'maintenance',
        cents: 1,
        interval: 'one_time',
      }),
    ).toThrow();
    expect(() =>
      fire(state, 'INVOICE_CREATED', { id: 'bad', contact_id: 'missing', price_id: 'once' }),
    ).toThrow();
    state = fire(state, 'PAYMENT_LINK_SAVED', {
      id: 'link',
      name: 'Paused',
      price_id: 'monthly',
      active: false,
    });
    expect(() =>
      fire(state, 'PAYMENT_CHECKOUT', {
        id: 'one',
        source: 'payment_link',
        target_id: 'link',
        contact_id: 'a',
        subscription_id: 'sub',
        outcome: 'success',
      }),
    ).toThrow();
  });
});
