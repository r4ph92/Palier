import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../src/App.tsx';

interface RenderOptions {
  readonly path?: string;
  readonly testSignInFlag?: boolean;
}

export function renderDashboard({ path = '/', testSignInFlag = true }: RenderOptions = {}) {
  if (testSignInFlag) {
    vi.stubEnv('VITE_TEST_SIGN_IN', 'true');
  }
  window.history.replaceState(null, '', path);
  return render(<App />);
}
