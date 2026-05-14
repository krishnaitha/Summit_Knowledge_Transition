import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Automatically unmount and clean up the DOM after every test.
// This prevents DOM leakage between tests when RTL does not auto-detect
// the Vitest environment's afterEach hook.
afterEach(() => {
  cleanup();
});
