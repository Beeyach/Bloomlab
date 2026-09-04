import type { AccountState, SimulatorState } from '../state.ts';
import { instant, minutesBetween } from '../time.ts';
import { METRIC_DEFINITIONS, REPORT_ORDER, type MetricId } from './definitions.ts';
import { mean, median, metric, rate, type MetricValue } from './provenance.ts';

/**
 * The reporting projection (REP-001, D-134, D-135).
 *
 * One pure function turns a run into its report. Nothing here reads the wall clock, the DOM,
 * storage, the network or a random number, and nothing is cached as truth: a report is derived,
 * always, from the run's own log and the account as it currently stands. Reset the run and the
 * report goes back with it; replay it and the report comes out identical.
 *
 * There is exactly one of these. The Reporting Lab, the Funnel Autopsy, the reporting exercise
 * and every test read this — a second implementation of "booking rate" in React is the bug this
 * module exists to prevent.
 *
 * The log is walked once. Every cohort below comes out of that single pass, so opening the report
 * does not mean ten sweeps of the history, and a bigger run does not cost ten times more.
 */

/* ---- shapes ---------------------------------------------------------------------------- */

/** One stage of the chain a business actually runs: visitor → lead → booked → showed → sold. */
export interface StageRow {
  id: 'visits' | 'leads' | 'booked' | 'showed' | 'sold';
  label: string;
  /** How many reached this stage. */
  count: number;
  /** The stage before it, so the loss between them is readable. */
  from: number | null;
  /** Reaching this stage over reaching the one before, or null when there was nothing before. */
  rate: number | null;
  /** How many were lost between the previous stage and this one. */
  lost: number | null;
}

/** One traffic source's own chain. Sample size is never hidden (§20). */
export interface SourceRow {
  source: string;
  visits: number;
  leads: number;
  booked: number;
  showed: number;
  sold: number;
  revenue: number;
  contact_ids: string[];
  visit_ids: string[];
}

/** Time to first contact, with the leads nobody messaged counted rather than averaged away. */
export interface ContactSpeed {
  /** Minutes, one per lead that was actually messaged. */
  samples: number[];
  median_minutes: number | null;
  mean_minutes: number | null;
  contacted: number;
  never_contacted: number;
  /** Leads nobody messaged, so the report can name them instead of implying they were slow. */
  never_contacted_ids: string[];
}

/** How the show-rate denominator was arrived at, since it is the one that needs saying (§7). */
export interface AppointmentCohort {
  booked: number;
  cancelled: number;
  not_yet_due: number;
  due: number;
  showed: number;
  no_show: number;
  still_open: number;
}

export interface Report {
  run_id: string;
  scenario_id: string;
  /** The window this report covers, in simulator time. */
  window: { from: string; to: string };
  metrics: Record<MetricId, MetricValue>;
  /** The ten in reading order, for a surface that wants them all. */
  ordered: MetricValue[];
  stages: StageRow[];
  sources: SourceRow[];
  speed: ContactSpeed;
  appointments: AppointmentCohort;
  /** True when the run has produced nothing to report on yet. */
  empty: boolean;
}

/* ---- the single pass ------------------------------------------------------------------- */

interface Index {
  /** Contacts created during the window, in creation order. */
  leadIds: string[];
  leadCreatedAt: Map<string, string>;
  leadCreatedEvent: Map<string, string>;
  /** Appointments the reporting window booked. */
  bookedAppointmentIds: string[];
  bookedEventByAppointment: Map<string, string>;
  /** Payments in and out, as window facts. */
  receivedEvents: { id: string; amount: number; payment_id: string }[];
  refundEvents: { id: string; amount: number; payment_id: string }[];
  /** Visits identified by a submission, so a visit's source can follow its contact. */
  visitOfContact: Map<string, string>;
}

function walk(state: SimulatorState): Index {
  const index: Index = {
    leadIds: [],
    leadCreatedAt: new Map(),
    leadCreatedEvent: new Map(),
    bookedAppointmentIds: [],
    bookedEventByAppointment: new Map(),
    receivedEvents: [],
    refundEvents: [],
    visitOfContact: new Map(),
  };
  const payments = state.account.payments;
  for (const event of state.log) {
    const id = (key: string): string | null =>
      typeof event.payload[key] === 'string' ? (event.payload[key] as string) : null;
    switch (event.type) {
      case 'CONTACT_CREATED': {
        const contactId = id('contact_id');
        // A contact the log created twice would be one person counted twice; the reducer already
        // refuses that, and taking the first here means a replay cannot change the answer either.
        if (contactId && !index.leadCreatedAt.has(contactId)) {
          index.leadIds.push(contactId);
          index.leadCreatedAt.set(contactId, event.at);
          index.leadCreatedEvent.set(contactId, event.id);
        }
        break;
      }
      case 'APPOINTMENT_BOOKED': {
        const appointmentId = id('appointment_id');
        if (appointmentId && !index.bookedEventByAppointment.has(appointmentId)) {
          index.bookedAppointmentIds.push(appointmentId);
          index.bookedEventByAppointment.set(appointmentId, event.id);
        }
        break;
      }
      case 'PAYMENT_RECEIVED': {
        const paymentId = id('payment_id');
        const amount = typeof event.payload.amount === 'number' ? event.payload.amount : null;
        if (paymentId && amount !== null) {
          index.receivedEvents.push({ id: event.id, amount, payment_id: paymentId });
        }
        break;
      }
      case 'REFUND_ISSUED': {
        const paymentId = id('payment_id');
        // A refund event names the payment, not an amount: the amount is the payment's own, which
        // is what the reducer took back out of the account's revenue.
        const amount = paymentId ? (payments[paymentId]?.amount ?? 0) : 0;
        if (paymentId) index.refundEvents.push({ id: event.id, amount, payment_id: paymentId });
        break;
      }
      case 'FORM_SUBMITTED':
      case 'SURVEY_SUBMITTED': {
        const visitId = id('visit_id');
        const contactId = id('contact_id');
        if (visitId && contactId && !index.visitOfContact.has(contactId)) {
          index.visitOfContact.set(contactId, visitId);
        }
        break;
      }
      default:
        break;
    }
  }
  return index;
}

/* ---- cohorts --------------------------------------------------------------------------- */

/** Contacts who were successfully messaged, and the instant of the first message that went out. */
function outboundReach(account: AccountState): {
  messaged: Map<string, string>;
  replied: Set<string>;
  outboundMessageIds: Map<string, string>;
} {
  const messaged = new Map<string, string>();
  const replied = new Set<string>();
  const outboundMessageIds = new Map<string, string>();
  for (const conversation of Object.values(account.conversations)) {
    for (const message of conversation.messages) {
      // A conversation only ever holds messages that actually went out or came in: the reducer
      // records a do-not-disturb or missing-number send as a skipped action and appends nothing.
      // That is what makes this the honest denominator (§21).
      if (message.direction === 'outbound') {
        if (!messaged.has(conversation.contact_id)) {
          messaged.set(conversation.contact_id, message.at);
          outboundMessageIds.set(conversation.contact_id, message.id);
        }
      } else if (message.direction === 'inbound') {
        replied.add(conversation.contact_id);
      }
    }
  }
  return { messaged, replied, outboundMessageIds };
}

/** Where a lead came from: the visit that identified them, else their own recorded source. */
function sourceOfLead(account: AccountState, contactId: string, index: Index): string {
  const visitId = index.visitOfContact.get(contactId);
  const visit = visitId ? account.funnel_visits[visitId] : undefined;
  if (visit) return visit.source;
  const recorded = account.contacts[contactId]?.source;
  return recorded && recorded.length > 0 ? recorded : 'Unknown';
}

/* ---- the projection -------------------------------------------------------------------- */

export function buildReport(state: SimulatorState): Report {
  const account = state.account;
  const index = walk(state);
  const now = state.clock.now;
  const leads = index.leadIds;
  const leadSet = new Set(leads);

  /* visits ------------------------------------------------------------------------------ */
  const visits = Object.values(account.funnel_visits).sort((a, b) => a.id.localeCompare(b.id));
  const convertedVisits = visits.filter((visit) => visit.contact_id !== null);

  /* bookings ---------------------------------------------------------------------------- */
  const bookedAppointments = index.bookedAppointmentIds
    .map((id) => account.appointments[id])
    .filter((appointment) => appointment !== undefined);
  const leadsWhoBooked = new Set(
    bookedAppointments.filter((a) => leadSet.has(a.contact_id)).map((a) => a.contact_id),
  );

  /* the appointment cohort, stated rather than assumed (§7) -------------------------------- */
  const cancelled = bookedAppointments.filter((a) => a.status === 'cancelled');
  const notYetDue = bookedAppointments.filter(
    (a) => a.status !== 'cancelled' && instant(a.starts_at) > instant(now),
  );
  const due = bookedAppointments.filter(
    (a) => a.status !== 'cancelled' && instant(a.starts_at) <= instant(now),
  );
  const showed = due.filter((a) => a.status === 'showed');
  const noShow = due.filter((a) => a.status === 'no_show');
  const appointments: AppointmentCohort = {
    booked: bookedAppointments.length,
    cancelled: cancelled.length,
    not_yet_due: notYetDue.length,
    due: due.length,
    showed: showed.length,
    no_show: noShow.length,
    still_open: due.length - showed.length - noShow.length,
  };

  /* sales -------------------------------------------------------------------------------- */
  const showedContacts = new Set(showed.map((a) => a.contact_id));
  const wonByContact = new Set(
    Object.values(account.opportunities)
      .filter((opportunity) => opportunity.status === 'won')
      .map((opportunity) => opportunity.contact_id),
  );
  const soldContacts = [...showedContacts].filter((id) => wonByContact.has(id)).sort();
  const wonOpportunityIds = Object.values(account.opportunities)
    .filter((o) => o.status === 'won' && showedContacts.has(o.contact_id))
    .map((o) => o.id)
    .sort();

  /* money -------------------------------------------------------------------------------- */
  const received = index.receivedEvents.reduce((total, row) => total + row.amount, 0);
  const refunded = index.refundEvents.reduce((total, row) => total + row.amount, 0);
  const openOpportunities = Object.values(account.opportunities)
    .filter((opportunity) => opportunity.status === 'open')
    .sort((a, b) => a.id.localeCompare(b.id));
  const openValue = openOpportunities.reduce((total, o) => total + o.value, 0);

  /* messaging ----------------------------------------------------------------------------- */
  const { messaged, replied, outboundMessageIds } = outboundReach(account);
  const messagedIds = [...messaged.keys()].sort();
  const repliedIds = messagedIds.filter((id) => replied.has(id));

  /* speed --------------------------------------------------------------------------------- */
  const samples: number[] = [];
  const neverContacted: string[] = [];
  for (const contactId of leads) {
    const createdAt = index.leadCreatedAt.get(contactId) as string;
    const firstOut = messaged.get(contactId);
    // A message that went out before the contact existed is not a first contact for this lead;
    // an authored history that puts one there is handled rather than producing a negative wait.
    if (firstOut && instant(firstOut) >= instant(createdAt)) {
      samples.push(minutesBetween(createdAt, firstOut));
    } else {
      neverContacted.push(contactId);
    }
  }
  const speed: ContactSpeed = {
    samples,
    median_minutes: median(samples),
    mean_minutes: mean(samples),
    contacted: samples.length,
    never_contacted: neverContacted.length,
    never_contacted_ids: neverContacted,
  };

  /* sources -------------------------------------------------------------------------------- */
  const sources = buildSources(account, index, {
    leads,
    leadsWhoBooked,
    showedContacts,
    soldContacts: new Set(soldContacts),
    visits,
  });

  /* the ten --------------------------------------------------------------------------------- */
  const metrics: Record<MetricId, MetricValue> = {
    leads: metric({
      id: 'leads',
      value: leads.length,
      numerator: leads.length,
      events: leads.map((id) => index.leadCreatedEvent.get(id) as string),
      records: leads,
    }),
    conversion: rate('conversion', convertedVisits.length, visits.length, {
      records: visits.map((visit) => visit.id),
    }),
    booking_rate: rate('booking_rate', leadsWhoBooked.size, leads.length, {
      events: bookedAppointments
        .filter((a) => leadSet.has(a.contact_id))
        .map((a) => index.bookedEventByAppointment.get(a.id) as string),
      records: [...leadsWhoBooked].sort(),
    }),
    show_rate: rate('show_rate', showed.length, due.length, {
      records: due.map((a) => a.id),
    }),
    close_rate: rate('close_rate', soldContacts.length, showedContacts.size, {
      records: [...wonOpportunityIds, ...[...showedContacts].sort()],
    }),
    revenue: metric({
      id: 'revenue',
      value: received - refunded,
      numerator: received,
      denominator: refunded,
      events: [...index.receivedEvents, ...index.refundEvents].map((row) => row.id),
      records: [...index.receivedEvents, ...index.refundEvents].map((row) => row.payment_id),
    }),
    pipeline_value: metric({
      id: 'pipeline_value',
      value: openValue,
      numerator: openOpportunities.length,
      records: openOpportunities.map((o) => o.id),
    }),
    source_performance: metric({
      id: 'source_performance',
      // The table is the answer; the number beside it is how many sources it covers, so a screen
      // that has room for one figure says something true rather than inventing a headline rate.
      value: sources.length,
      numerator: sources.length,
      records: sources.map((row) => row.source),
    }),
    response_rate: rate('response_rate', repliedIds.length, messagedIds.length, {
      records: [...messagedIds, ...repliedIds.map((id) => outboundMessageIds.get(id) as string)],
    }),
    time_to_contact: metric({
      id: 'time_to_contact',
      value: speed.median_minutes,
      numerator: speed.contacted,
      denominator: leads.length,
      records: leads.filter((id) => !neverContacted.includes(id)),
    }),
  };

  const stages: StageRow[] = [
    { id: 'visits', label: 'Visits', count: visits.length, from: null, rate: null, lost: null },
    stage('leads', 'Leads', leads.length, visits.length),
    stage('booked', 'Booked', leadsWhoBooked.size, leads.length),
    stage('showed', 'Showed', showed.length, leadsWhoBooked.size),
    stage('sold', 'Sold', soldContacts.length, showed.length),
  ];

  return {
    run_id: state.run_id,
    scenario_id: state.scenario_id,
    window: { from: state.log[0]?.at ?? now, to: now },
    metrics,
    ordered: REPORT_ORDER.map((id) => metrics[id]),
    stages,
    sources,
    speed,
    appointments,
    empty:
      visits.length === 0 &&
      leads.length === 0 &&
      bookedAppointments.length === 0 &&
      messagedIds.length === 0 &&
      index.receivedEvents.length === 0,
  };
}

const stage = (id: StageRow['id'], label: string, count: number, from: number): StageRow => ({
  id,
  label,
  count,
  from,
  rate: from === 0 ? null : count / from,
  lost: from === 0 ? null : from - count,
});

function buildSources(
  account: AccountState,
  index: Index,
  cohorts: {
    leads: readonly string[];
    leadsWhoBooked: ReadonlySet<string>;
    showedContacts: ReadonlySet<string>;
    soldContacts: ReadonlySet<string>;
    visits: readonly { id: string; source: string }[];
  },
): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  const row = (source: string): SourceRow => {
    const existing = rows.get(source);
    if (existing) return existing;
    const made: SourceRow = {
      source,
      visits: 0,
      leads: 0,
      booked: 0,
      showed: 0,
      sold: 0,
      revenue: 0,
      contact_ids: [],
      visit_ids: [],
    };
    rows.set(source, made);
    return made;
  };
  for (const visit of cohorts.visits) {
    const target = row(visit.source);
    target.visits += 1;
    target.visit_ids.push(visit.id);
  }
  const revenueByContact = new Map<string, number>();
  for (const entry of index.receivedEvents) {
    const payment = account.payments[entry.payment_id];
    if (!payment) continue;
    const current = revenueByContact.get(payment.contact_id) ?? 0;
    revenueByContact.set(payment.contact_id, current + entry.amount);
  }
  for (const entry of index.refundEvents) {
    const payment = account.payments[entry.payment_id];
    if (!payment) continue;
    const current = revenueByContact.get(payment.contact_id) ?? 0;
    revenueByContact.set(payment.contact_id, current - entry.amount);
  }
  for (const contactId of cohorts.leads) {
    const target = row(sourceOfLead(account, contactId, index));
    target.leads += 1;
    target.contact_ids.push(contactId);
    if (cohorts.leadsWhoBooked.has(contactId)) target.booked += 1;
    if (cohorts.showedContacts.has(contactId)) target.showed += 1;
    if (cohorts.soldContacts.has(contactId)) target.sold += 1;
    target.revenue += revenueByContact.get(contactId) ?? 0;
  }
  // Ordered by size, then by name, so the table is stable across runs and readable at a glance.
  return [...rows.values()].sort(
    (a, b) => b.visits - a.visits || b.leads - a.leads || a.source.localeCompare(b.source),
  );
}

/** The definition behind one metric, for a surface that wants to show the rule beside the number. */
export const definitionOf = (id: MetricId) => METRIC_DEFINITIONS[id];
