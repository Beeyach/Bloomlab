// In-memory IndexedDB so the Dexie data layer runs under jsdom (DATA-002 tests).
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Screens are lazy route chunks rendered over the compiled curriculum: the 1 s default for
// findBy* is tight enough under load to fail a working screen. One value for every web test.
configure({ asyncUtilTimeout: 8000 });

// Vitest runs without globals, so Testing Library's automatic cleanup does not register.
afterEach(() => {
  cleanup();
});
