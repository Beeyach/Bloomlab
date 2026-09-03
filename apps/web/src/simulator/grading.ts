import type { ContextSource, GradingContext, GradingEvent } from '@bloomlab/exercise-engine';
import {
  contentEventName,
  type SimulatorEvent,
  type SimulatorState,
} from '@bloomlab/simulator-core';

/**
 * Simulator → grading adapter (spec TA§31–§33).
 *
 * Phase 9 deliberately made the grader independent of the simulator, and that separation stays:
 * this module lives in the app, not in either engine, and it only translates. It never invents a
 * context — every value below is read from a real run — and it only claims a source the run can
 * actually supply, because a claimed-but-absent source turns "we cannot judge this" into "you got
 * it wrong" (EXR-024).
 *
 * What Phase 10 can supply: the shared account state, and the run's own event history with its
 * ordering. References are derived from the run when the exercise names the contact they are
 * about. Architecture is never supplied here: the workflow a learner *builds* comes from the
 * Workflow Lab in Phase 12, and the workflows a scenario authored are its starting conditions,
 * not the learner's answer.
 */

/** Scalars an authored `where` clause can match on. */
type Field = string | number | boolean | null;

const isField = (value: unknown): value is Field =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

/** The event's flat, matchable fields: its scalar payload entries plus where it came from. */
function fieldsOf(event: SimulatorEvent): Record<string, Field> {
  const fields: Record<string, Field> = {};
  for (const [key, value] of Object.entries(event.payload)) {
    if (isField(value)) fields[key] = value;
  }
  fields.origin = event.origin;
  if (event.source) fields.source = event.source.id;
  return fields;
}

/**
 * The run's history in the grader's shape. `index` is the simulator's own sequence, so "two
 * events at the same timestamp" resolves the same way in both engines, and the authored dotted
 * name is what the assertions were written against.
 */
export const gradingEvents = (state: SimulatorState): GradingEvent[] =>
  state.log.map((event) => ({
    type: contentEventName(event.type),
    at: event.at,
    index: event.sequence,
    fields: fieldsOf(event),
  }));

/**
 * Named instants a timing assertion measures against, read out of the account rather than
 * authored twice. Every appointment is addressable by id; the bare `appointment.start` is only
 * offered when the exercise names the contact it is about, so it can never mean the wrong one.
 */
export function gradingReferences(
  state: SimulatorState,
  subjectContactId?: string | null,
): Record<string, string> {
  const references: Record<string, string> = {};
  const appointments = Object.values(state.account.appointments);
  for (const appointment of appointments) {
    references[`appointment.${appointment.id}.start`] = appointment.starts_at;
  }
  if (subjectContactId) {
    const live = appointments
      .filter(
        (appointment) =>
          appointment.contact_id === subjectContactId && appointment.status !== 'cancelled',
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const first = live[0];
    if (first) references['appointment.start'] = first.starts_at;
  }
  references['simulation.start'] = state.log[0]?.at ?? state.clock.now;
  references['simulation.now'] = state.clock.now;
  return references;
}

export interface SimulatorContextOptions {
  /** The contact the exercise is about, from its authored `starting_state.contact_id`. */
  subjectContactId?: string | null;
  /**
   * What the learner supplied — `prediction`, `decision`, `answer`. The runner owns these; they
   * are merged into the same state tree because assertions address both the same way.
   */
  learner?: Record<string, unknown>;
}

/**
 * A grading context built from a real run. Nothing here is fabricated: if the run did not produce
 * an event, the context does not contain one.
 */
export function gradingContextFrom(
  state: SimulatorState,
  options: SimulatorContextOptions = {},
): GradingContext {
  const references = gradingReferences(state, options.subjectContactId);
  const provides: ContextSource[] = ['state', 'events', 'references'];
  if (options.learner) provides.push('learner');

  return {
    state: { ...(state.account as unknown as Record<string, unknown>), ...(options.learner ?? {}) },
    events: gradingEvents(state),
    references,
    // Phase 12 supplies this from what the learner builds. Claiming the scenario's own starting
    // workflows here would grade a learner on architecture they never authored.
    architecture: null,
    provides,
  };
}

/** The sources a run can fill today, for the runner's runtime panel. */
export const SIMULATOR_PROVIDES: readonly ContextSource[] = ['state', 'events', 'references'];
