import { BloomlabDatabase } from './db';

/** A throwaway database per test (fake-indexeddb in Vitest), so tests never share state. */
export const freshDatabase = (): BloomlabDatabase =>
  new BloomlabDatabase(`test-${crypto.randomUUID()}`);
