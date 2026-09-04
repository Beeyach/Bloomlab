/**
 * What each reported number means (REP-001, D-134).
 *
 * The master spec names ten metrics and does not settle every denominator, so Phase 15 settles
 * them here, once, as data. The Reporting Lab, the Funnel Autopsy, the exercises and the tests
 * all read these sentences — there is no second definition anywhere, and a rate is never computed
 * a second way in React.
 *
 * Every sentence is written to be checkable by hand against the run it describes. That is the
 * point: a learner who disagrees with a number should be able to open the evidence and settle it.
 */

export const METRIC_IDS = [
  'leads',
  'conversion',
  'booking_rate',
  'show_rate',
  'close_rate',
  'revenue',
  'pipeline_value',
  'source_performance',
  'response_rate',
  'time_to_contact',
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

/**
 * How a number should be read.
 *
 * `window` metrics count what happened between the run's start and its clock. `snapshot` metrics
 * describe the account as it stands now. The two are different kinds of measurement and the
 * interface never lets them look like the same kind: open pipeline is what is on the board today,
 * revenue is what came in during the window (§6).
 */
export type MetricBasis = 'window' | 'snapshot';

export type MetricUnit = 'count' | 'rate' | 'money' | 'minutes' | 'table';

export interface MetricDefinition {
  id: MetricId;
  /** Learner-facing name. Plain words, no jargon. */
  label: string;
  unit: MetricUnit;
  basis: MetricBasis;
  /** The exact rule, in one sentence. Shown wherever the number is shown. */
  definition: string;
  /** What the denominator is, for the six that have one. Null for counts and sums. */
  denominator: string | null;
}

export const METRIC_DEFINITIONS: Readonly<Record<MetricId, MetricDefinition>> = {
  leads: {
    id: 'leads',
    label: 'Leads',
    unit: 'count',
    basis: 'window',
    definition: 'Contacts the account created inside the reporting window, each person once.',
    denominator: null,
  },
  conversion: {
    id: 'conversion',
    label: 'Conversion',
    unit: 'rate',
    basis: 'window',
    definition: 'Funnel visits that became a lead, over funnel visits.',
    denominator: 'Every funnel visit the reporting window recorded.',
  },
  booking_rate: {
    id: 'booking_rate',
    label: 'Booking rate',
    unit: 'rate',
    basis: 'window',
    definition: 'Leads who booked at least one appointment, over leads.',
    denominator: 'The leads counted above.',
  },
  show_rate: {
    id: 'show_rate',
    label: 'Show rate',
    unit: 'rate',
    basis: 'window',
    definition: 'Appointments marked Showed, over appointments that were due and not cancelled.',
    denominator:
      'Appointments booked in the window whose start time has passed and that were not cancelled. ' +
      'Cancelled appointments and appointments still in the future are outside it, and both counts are shown.',
  },
  close_rate: {
    id: 'close_rate',
    label: 'Close rate',
    unit: 'rate',
    basis: 'window',
    definition: 'People who showed and have a won opportunity, over people who showed.',
    denominator:
      'Contacts with at least one Showed appointment inside the reporting period. A sale is a won opportunity, ' +
      'never a tag.',
  },
  revenue: {
    id: 'revenue',
    label: 'Revenue',
    unit: 'money',
    basis: 'window',
    definition:
      'Payments received in the window, less refunds. Failed payments contribute nothing.',
    denominator: null,
  },
  pipeline_value: {
    id: 'pipeline_value',
    label: 'Open pipeline',
    unit: 'money',
    basis: 'snapshot',
    definition:
      'The value of every opportunity that is open right now. Won, lost and abandoned are out.',
    denominator: null,
  },
  source_performance: {
    id: 'source_performance',
    label: 'Source performance',
    unit: 'table',
    basis: 'window',
    definition:
      'Per source: visits, leads, bookings, shows, sales and revenue, each with its own count. ' +
      'Sample size is always shown beside the rate.',
    denominator: null,
  },
  response_rate: {
    id: 'response_rate',
    label: 'Response rate',
    unit: 'rate',
    basis: 'window',
    definition: 'Contacts who replied, over contacts who were successfully messaged.',
    denominator:
      'Contacts who received at least one outbound text or email that actually went out. ' +
      'A send skipped for do-not-disturb or a missing number never reached anyone and is not counted.',
  },
  time_to_contact: {
    id: 'time_to_contact',
    label: 'Time to contact',
    unit: 'minutes',
    basis: 'window',
    definition:
      'Median minutes from a lead being created to the first outbound text or email that went out. ' +
      'Leads nobody messaged are counted separately, never as a long wait.',
    denominator: null,
  },
};

/** The ten, in the order a report reads them: the chain first, then money, then speed. */
export const REPORT_ORDER: readonly MetricId[] = [
  'leads',
  'conversion',
  'booking_rate',
  'show_rate',
  'close_rate',
  'revenue',
  'pipeline_value',
  'source_performance',
  'response_rate',
  'time_to_contact',
];
