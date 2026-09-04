import { handleEngineRequest, type EngineRequest } from './engineOps';

/**
 * The simulator on its own thread (SIM-014).
 *
 * The worker holds nothing between messages: each request carries the state, the scenario and
 * the operation, and the answer carries the new state, so a lost worker loses no work and the
 * main thread stays the only owner of the run. The computation is the same `runOp` the direct
 * path calls.
 */

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = (event: MessageEvent<EngineRequest>) => {
  scope.postMessage(handleEngineRequest(event.data));
};
