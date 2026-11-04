import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// The theme token test runs in Node, where there is no page to reset.
afterEach(() => {
  if (typeof window === 'undefined') {
    return;
  }
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  document.documentElement.lang = 'fr';
});
