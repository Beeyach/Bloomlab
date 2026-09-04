import type { SimulatorEvent } from '@bloomlab/simulator-core';

import type { StoredRun } from '../simulator/store';

/**
 * The event-sequence boundary of one visitor session (FUN-003).
 *
 * Event sequence is not the same thing as log length: execution records consume sequence numbers
 * too. Using log length as the boundary can make old account events appear under "What the account
 * did" after a funnel has been saved several times. A session starts after the last event actually
 * in the log, and what it did is everything the run has logged since.
 *
 * These are pure reads of a saved run, kept out of the screen so the chain test can assert on the
 * same boundary the Lab draws rather than on a re-implementation of it.
 */

export const visitorLogWatermark = (run: StoredRun): number => run.state.log.at(-1)?.sequence ?? -1;

/**
 * The visit recording itself is not the account doing something (FUN-004, D-136).
 *
 * "What the account did" answers one question: what did this person's actions cause? A visit
 * beginning, a step being met and a form being started are facts *about the visit*, which the
 * Autopsy reads and this panel has no business restating — leaving them in would make a refused
 * submission look as though something had happened.
 */
const TELEMETRY: ReadonlySet<string> = new Set([
  'FUNNEL_VISIT_STARTED',
  'FUNNEL_STEP_VIEWED',
  'FUNNEL_SCROLL_RECORDED',
  'FUNNEL_FORM_STARTED',
  'FUNNEL_VISIT_ENDED',
]);

export const visitorEventsSince = (run: StoredRun, afterSequence: number): SimulatorEvent[] =>
  run.state.log.filter((event) => event.sequence > afterSequence && !TELEMETRY.has(event.type));
