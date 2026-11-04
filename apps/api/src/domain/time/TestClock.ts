import type { Clock } from './Clock.ts';

export interface TestClock {
  readonly now: Clock;
  setFixed(instant: Date): void;
  useRealTime(): void;
}

// Fixed at one instant once set, so a tester reads the same amount until they move the clock again.
export function createTestClock(): TestClock {
  let fixedInstant: Date | null = null;
  return {
    now: () => (fixedInstant === null ? new Date() : new Date(fixedInstant)),
    setFixed: (instant) => {
      fixedInstant = new Date(instant);
    },
    useRealTime: () => {
      fixedInstant = null;
    },
  };
}
