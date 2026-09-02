// In-memory IndexedDB so the Dexie data layer runs under jsdom (DATA-002 tests).
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals, so Testing Library's automatic cleanup does not register.
afterEach(() => {
  cleanup();
});
