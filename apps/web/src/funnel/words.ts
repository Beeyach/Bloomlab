import type { FunnelBlockRole, FunnelIssue, FunnelStepPurpose } from '@bloomlab/simulator-core';

/**
 * The Funnel Lab's vocabulary (FUN-001, GHL-004).
 *
 * Two kinds of word live here and they are kept apart on purpose.
 *
 * **Bloomlab architecture terms** — a step's purpose, a block's role — are our own way of naming
 * the job a piece of a funnel does. HighLevel has no "outcome block" and no "capture step", so
 * every place these appear says, in the interface, that they are Bloomlab's conversion vocabulary
 * rather than controls in a real sub-account. `origin` below is what the screen reads to say it.
 *
 * **Real HighLevel features** — forms, surveys, calendars, products, funnels themselves — keep
 * HighLevel's own names and are the things a block connects to. Those have registry records.
 */

export type TermOrigin = 'bloomlab' | 'ghl';

export const STEP_PURPOSE_LABELS: Record<FunnelStepPurpose, string> = {
  capture: 'Capture',
  offer: 'Offer',
  booking: 'Booking',
  checkout: 'Checkout',
  confirmation: 'Confirmation',
  content: 'Content',
};

export const STEP_PURPOSE_HELP: Record<FunnelStepPurpose, string> = {
  capture: 'Asks a stranger for their details.',
  offer: 'Makes the case for the thing being sold.',
  booking: 'Puts a time on the calendar.',
  checkout: 'Takes the money.',
  confirmation: 'Tells the visitor what happens next.',
  content: 'Teaches or qualifies without asking for anything.',
};

export const BLOCK_ROLE_LABELS: Record<FunnelBlockRole, string> = {
  headline: 'Headline',
  problem: 'Problem',
  outcome: 'Outcome',
  proof: 'Proof',
  benefits: 'Benefits',
  objections: 'Objections',
  cta: 'Call to action',
  form: 'Form',
  survey: 'Survey',
  calendar: 'Calendar',
  checkout: 'Checkout',
};

export const BLOCK_ROLE_HELP: Record<FunnelBlockRole, string> = {
  headline: 'The one sentence that says what this is.',
  problem: 'The situation the visitor is in right now.',
  outcome: 'What life looks like after the thing works.',
  proof: 'A reason to believe it: results, names, numbers.',
  benefits: 'What they actually get.',
  objections: 'The reasons they would say no, answered.',
  cta: 'The ask, and where it sends them.',
  form: 'A real form from the account. Submitting it creates or updates a contact.',
  survey: 'A real survey from the account. Submitting it creates or updates a contact.',
  calendar: 'A real calendar from the account. Booking creates an appointment.',
  checkout: 'A real product from the account. Paying records a payment.',
};

/**
 * Where each term comes from. The four connecting roles name a HighLevel object; everything else
 * is Bloomlab's own architecture vocabulary and the interface says so rather than implying that
 * a sub-account has a "Proof" element.
 */
export const BLOCK_ROLE_ORIGIN: Record<FunnelBlockRole, TermOrigin> = {
  headline: 'bloomlab',
  problem: 'bloomlab',
  outcome: 'bloomlab',
  proof: 'bloomlab',
  benefits: 'bloomlab',
  objections: 'bloomlab',
  cta: 'bloomlab',
  form: 'ghl',
  survey: 'ghl',
  calendar: 'ghl',
  checkout: 'ghl',
};

export const ORIGIN_NOTE: Record<TermOrigin, string> = {
  bloomlab:
    'Bloomlab conversion vocabulary. HighLevel has no element with this name — you decide the section, this names its job.',
  ghl: 'A real HighLevel object. This block uses one from the training account.',
};

/** What a capture block connects to, in HighLevel's own words. */
export const REFERENCE_NOUN: Partial<Record<FunnelBlockRole, string>> = {
  form: 'form',
  survey: 'survey',
  calendar: 'calendar',
  checkout: 'product',
};

/** The severity word a problem list shows. */
export const ISSUE_TONE: Record<FunnelIssue['severity'], string> = {
  error: 'Stops the visitor',
  warning: 'Worth a look',
};

/** A simulator instant as a person reads it, in the run's own zone. Never the device clock. */
export function simulatorTime(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** A field key from a form or survey as a label. Content decides the keys; this only reads them. */
export const fieldLabel = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (character) => character.toUpperCase())
    .trim();
