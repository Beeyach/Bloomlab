import type { AccountState, FunnelReachLevel, FunnelVisit, SimulatorState } from '../state.ts';
import { FUNNEL_REACH_LEVELS } from '../state.ts';

/**
 * The Funnel Autopsy projection (FUN-004, EXR-010, D-137).
 *
 * One pure function, six views, one funnel. The Funnel Lab's Autopsy lens, the FUNNEL AUTOPSY
 * exercise and the tests all read this — nothing recomputes a funnel rate of its own, and no
 * screen holds a cohort React invented.
 *
 * It is forensic rather than analytical: it says what the traffic did and never why. There is no
 * health score, no benchmark, no "your headline is weak" — a drop-off is a place sessions ended,
 * and turning that into a cause is the learner's job, which is the whole point of separating a
 * problem from a hypothesis.
 *
 * Two honesty rules run through all of it. Every rate carries the two counts it came from, and a
 * rate with nothing to divide has no value rather than a confident zero.
 */

export interface AutopsySourceRow {
  source: string;
  visits: number;
  /** Visits from this source that ended up identified as a contact. */
  leads: number;
  /** Leads over visits for this source, or null when the source had no visits to convert. */
  conversion: number | null;
  visit_ids: string[];
}

/** How far down one step the traffic got. Semantic depth in blocks, never pixels (§11). */
export interface AutopsyReachRow {
  step_id: string;
  step_name: string;
  /** How many visits met this step at all. */
  views: number;
  /** Views at each reach level, in the level's own order. */
  by_level: Record<FunnelReachLevel, number>;
  /** The deepest block index any visit reached on this step. */
  deepest_blocks_seen: number;
  /** How many blocks the step actually has, so the depth is readable against something. */
  blocks: number;
}

export interface AutopsyDropOffRow {
  step_id: string;
  step_name: string;
  /** Visits that ended on this step without reaching the next one. */
  left: number;
  /** Visits that met this step at all, so the loss is readable as a share. */
  reached: number;
  /** Left over reached, or null when nothing reached it. */
  share: number | null;
  visit_ids: string[];
}

export interface AutopsyRate {
  numerator: number;
  denominator: number;
  /** The fraction, or null when the denominator is zero. Never a pre-multiplied percentage. */
  value: number | null;
}

export interface FunnelAutopsy {
  funnel_id: string;
  funnel_name: string;
  /** Every visit this funnel received, in id order. */
  visits: number;
  /** True when nothing has visited this funnel: every view says so rather than showing zeroes. */
  empty: boolean;

  /* the six views */
  traffic: AutopsySourceRow[];
  conversion: AutopsyRate;
  reach: AutopsyReachRow[];
  form_completion: AutopsyRate & { starts: number; submissions: number };
  booking: AutopsyRate;
  drop_off: AutopsyDropOffRow[];

  /** Which denominator the booking rate used, in words, so it is never guessed at. */
  booking_denominator: string;
}

const emptyLevels = (): Record<FunnelReachLevel, number> => ({ top: 0, middle: 0, bottom: 0 });

const asRate = (numerator: number, denominator: number): AutopsyRate => ({
  numerator,
  denominator,
  value: denominator === 0 ? null : numerator / denominator,
});

/**
 * The one denominator the funnel chain uses for bookings, stated where the number is (§11). Leads
 * rather than visits, so the Autopsy's booking rate and the Reporting Lab's mean the same thing.
 */
export const BOOKING_DENOMINATOR =
  'Visits that became a lead. A visit that never identified anybody could not book.';

export function funnelAutopsy(state: SimulatorState, funnelId: string): FunnelAutopsy | null {
  const account = state.account;
  const funnel = account.funnels[funnelId];
  if (!funnel) return null;

  // Only this funnel's traffic. Another funnel's visits are another funnel's problem (§70).
  const visits = Object.values(account.funnel_visits)
    .filter((visit) => visit.funnel_id === funnelId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(visits.map((visit) => [visit.id, visit]));

  /* what the log says these visits achieved ------------------------------------------------ */
  const submittedVisits = new Set<string>();
  const bookedVisitContacts = new Set<string>();
  for (const event of state.log) {
    const visitId =
      typeof event.payload.visit_id === 'string' ? (event.payload.visit_id as string) : null;
    if (event.type === 'FORM_SUBMITTED' || event.type === 'SURVEY_SUBMITTED') {
      if (visitId && byId.has(visitId)) submittedVisits.add(visitId);
    } else if (event.type === 'APPOINTMENT_BOOKED') {
      const contactId =
        typeof event.payload.contact_id === 'string' ? (event.payload.contact_id as string) : null;
      if (contactId) bookedVisitContacts.add(contactId);
    }
  }

  const leads = visits.filter((visit) => visit.contact_id !== null);
  const leadContactIds = new Set(leads.map((visit) => visit.contact_id as string));
  const booked = [...leadContactIds].filter((id) => bookedVisitContacts.has(id));

  /* 1. traffic source ---------------------------------------------------------------------- */
  const sourceRows = new Map<string, AutopsySourceRow>();
  for (const visit of visits) {
    const existing = sourceRows.get(visit.source) ?? {
      source: visit.source,
      visits: 0,
      leads: 0,
      conversion: null,
      visit_ids: [],
    };
    existing.visits += 1;
    existing.visit_ids.push(visit.id);
    if (visit.contact_id !== null) existing.leads += 1;
    sourceRows.set(visit.source, existing);
  }
  const traffic = [...sourceRows.values()]
    .map((row) => ({ ...row, conversion: row.visits === 0 ? null : row.leads / row.visits }))
    .sort((a, b) => b.visits - a.visits || a.source.localeCompare(b.source));

  /* 3. reach ------------------------------------------------------------------------------- */
  const reach: AutopsyReachRow[] = funnel.steps.map((step) => {
    const row: AutopsyReachRow = {
      step_id: step.id,
      step_name: step.name,
      views: 0,
      by_level: emptyLevels(),
      deepest_blocks_seen: 0,
      blocks: step.blocks.length,
    };
    for (const visit of visits) {
      const view = deepestView(visit, step.id);
      if (!view) continue;
      row.views += 1;
      row.by_level[view.reach] += 1;
      row.deepest_blocks_seen = Math.max(row.deepest_blocks_seen, view.blocks_seen);
    }
    return row;
  });

  /* 4. form completion ---------------------------------------------------------------------- */
  const starts = visits.filter((visit) => visit.forms_started.length > 0).length;
  const submissions = submittedVisits.size;
  const formCompletion = { ...asRate(submissions, starts), starts, submissions };

  /* 6. drop-off ------------------------------------------------------------------------------ */
  const dropOff: AutopsyDropOffRow[] = funnel.steps.map((step) => {
    const reached = visits.filter((visit) => deepestView(visit, step.id) !== null);
    const left = reached.filter(
      (visit) => visit.ended_reason === 'left' && visit.last_step_id === step.id,
    );
    return {
      step_id: step.id,
      step_name: step.name,
      left: left.length,
      reached: reached.length,
      share: reached.length === 0 ? null : left.length / reached.length,
      visit_ids: left.map((visit) => visit.id),
    };
  });

  return {
    funnel_id: funnel.id,
    funnel_name: funnel.name,
    visits: visits.length,
    empty: visits.length === 0,
    traffic,
    conversion: asRate(leads.length, visits.length),
    reach,
    form_completion: formCompletion,
    booking: asRate(booked.length, leads.length),
    drop_off: dropOff,
    booking_denominator: BOOKING_DENOMINATOR,
  };
}

/** The deepest view a visit made of one step. A visitor who came back counts once, at their best. */
function deepestView(visit: FunnelVisit, stepId: string) {
  let best: FunnelVisit['steps'][number] | null = null;
  for (const view of visit.steps) {
    if (view.step_id !== stepId) continue;
    if (
      !best ||
      FUNNEL_REACH_LEVELS.indexOf(view.reach) > FUNNEL_REACH_LEVELS.indexOf(best.reach) ||
      view.blocks_seen > best.blocks_seen
    ) {
      best = view;
    }
  }
  return best;
}

/** Every funnel in the account that has any traffic, for a lens that has to offer a choice. */
export const funnelsWithTraffic = (account: AccountState): string[] => {
  const seen = new Set<string>();
  for (const visit of Object.values(account.funnel_visits)) seen.add(visit.funnel_id);
  return [...seen].filter((id) => account.funnels[id]).sort();
};
