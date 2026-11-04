import type { Clock } from '../domain/time/Clock.ts';
import { createTestClock, type TestClock } from '../domain/time/TestClock.ts';

export interface ServerClock {
  readonly now: Clock;
  // Present only where test sign-in is enabled: production has no way to move the clock.
  readonly testClock?: TestClock;
}

export function createClock(testSignInEnabled: boolean): ServerClock {
  if (!testSignInEnabled) {
    return { now: () => new Date() };
  }
  const testClock = createTestClock();
  return { now: testClock.now, testClock };
}
