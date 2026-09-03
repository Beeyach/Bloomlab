/**
 * The arithmetic behind the funnel diagram and the funnel-math interactive (LU-funnel-math-basics):
 * four stages, four rates, one revenue line. Pure and deterministic so the unit's prose, the
 * diagram and the interactive can never disagree.
 */

export interface FunnelInput {
  leads: number;
  /** Share of leads who book, 0–1. */
  booking: number;
  /** Share of bookings that show up, 0–1. */
  show: number;
  /** Share of consultations that buy, 0–1. */
  close: number;
  /** Value of one sale. */
  ticket: number;
  ad_spend?: number;
}

export type FunnelRate = 'booking' | 'show' | 'close';

export interface FunnelStage {
  key: 'leads' | 'booked' | 'showed' | 'bought';
  label: string;
  count: number;
  /** People lost between this stage and the next (0 for the last stage). */
  lost: number;
  /** The rate that took people from this stage to the next. */
  rate: FunnelRate | null;
}

export interface FunnelOutcome {
  stages: FunnelStage[];
  sales: number;
  revenue: number;
  profit: number | null;
  /** The stage that loses the most people. */
  leak: FunnelStage;
}

export const FUNNEL_LEVERS: { rate: FunnelRate; label: string; target: number }[] = [
  { rate: 'booking', label: 'Booking rate', target: 0.6 },
  { rate: 'show', label: 'Show rate', target: 0.8 },
  { rate: 'close', label: 'Close rate', target: 0.5 },
];

export function funnelOutcome(input: FunnelInput): FunnelOutcome {
  const booked = input.leads * input.booking;
  const showed = booked * input.show;
  const bought = showed * input.close;
  const stages: FunnelStage[] = [
    {
      key: 'leads',
      label: 'Leads',
      count: input.leads,
      lost: input.leads - booked,
      rate: 'booking',
    },
    { key: 'booked', label: 'Booked', count: booked, lost: booked - showed, rate: 'show' },
    { key: 'showed', label: 'Showed', count: showed, lost: showed - bought, rate: 'close' },
    { key: 'bought', label: 'Bought', count: bought, lost: 0, rate: null },
  ];
  const revenue = bought * input.ticket;
  const leak = stages
    .slice(0, 3)
    .reduce((worst, stage) => (stage.lost > worst.lost ? stage : worst));
  return {
    stages,
    sales: bought,
    revenue,
    profit: input.ad_spend === undefined ? null : revenue - input.ad_spend,
    leak,
  };
}

/** The outcome if one rate were lifted to a target, and the change in monthly sales it buys. */
export function liftRate(
  input: FunnelInput,
  rate: FunnelRate,
  target: number,
): { outcome: FunnelOutcome; extraSales: number; extraRevenue: number } {
  const base = funnelOutcome(input);
  const outcome = funnelOutcome({ ...input, [rate]: Math.max(input[rate], target) });
  return {
    outcome,
    extraSales: Math.round(outcome.sales) - Math.round(base.sales),
    extraRevenue: Math.round(outcome.revenue) - Math.round(base.revenue),
  };
}

export const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

export const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export const whole = (count: number): string => Math.round(count).toLocaleString('en-US');

export function parseFunnelInput(attributes: Record<string, unknown>): FunnelInput {
  const number = (key: string): number => Number(attributes[key]);
  return {
    leads: number('leads'),
    booking: number('booking'),
    show: number('show'),
    close: number('close'),
    ticket: number('ticket'),
    ad_spend: attributes.ad_spend === undefined ? undefined : number('ad_spend'),
  };
}
