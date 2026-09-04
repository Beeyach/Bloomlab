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

export const visitorEventsSince = (run: StoredRun, afterSequence: number): SimulatorEvent[] =>
  run.state.log.filter((event) => event.sequence > afterSequence);
