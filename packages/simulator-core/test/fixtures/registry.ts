import type { SimulatorScenario, SimulatorState } from '../../src/index.ts';

/**
 * The simulator regression registry (SIM-017).
 *
 * Every simulated GoHighLevel behaviour gets a fixture with a **stable id** — `TAG-001`, not a
 * test name someone will reword. A fixture is a scenario, a script of operations and an
 * expectation, so a change to the engine that breaks an old behaviour fails by id and says which
 * behaviour it broke. Every future simulator bug adds a fixture here.
 *
 * A fixture is either `implemented`, meaning it runs real engine behaviour right now, or
 * `reserved`, meaning the id is claimed for a behaviour a later phase will own. A reserved
 * fixture has no expectation and is never reported as passing — reserving an id is not the same
 * as implementing the behaviour behind it.
 */

export interface FixtureContext {
  scenario: SimulatorScenario;
}

export interface RegressionFixture {
  /** Stable and permanent. Never renumbered, never reused for a different behaviour. */
  id: string;
  /** What behaviour this pins down, in one line. */
  behaviour: string;
  /** The requirement or spec section it belongs to. */
  covers: string;
  status: 'implemented' | 'reserved';
  /** The phase that owns the behaviour, for a reserved fixture. */
  owner?: string;
  /** Runs the behaviour and returns the run to assert against. */
  run?: (context: FixtureContext) => SimulatorState;
  /** Throws when the behaviour is wrong. Kept beside `run` so a fixture is one readable unit. */
  expect?: (state: SimulatorState) => void;
}

export const isImplemented = (fixture: RegressionFixture): boolean =>
  fixture.status === 'implemented';
