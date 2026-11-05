import { systemClock, type Clock } from './domain/time/Clock.ts';
import { createTestClock, type TestClock } from './domain/time/TestClock.ts';

export interface ClockComposition {
  readonly testClock: TestClock | undefined;
  readonly clock: Clock;
}

// The one place that decides which clock the app's routes and background jobs share: the test clock exactly when test sign-in is on.
export function composeClock(testSignInEnabled: boolean): ClockComposition {
  if (!testSignInEnabled) {
    return { testClock: undefined, clock: systemClock };
  }
  const testClock = createTestClock();
  return { testClock, clock: testClock.now };
}
