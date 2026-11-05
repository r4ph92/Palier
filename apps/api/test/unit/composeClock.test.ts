import { describe, expect, it } from 'vitest';
import { composeClock } from '../../src/composeClock.ts';
import { systemClock } from '../../src/domain/time/Clock.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

describe('composeClock', () => {
  it('shares one test clock with everything that reads time when test sign-in is on', () => {
    const { testClock, clock } = composeClock(true);
    testClock?.setFixed(new Date('2026-11-04T19:17:00Z'));

    expect(testClock).toBeDefined();
    expect(clock()).toEqual(new Date('2026-11-04T19:17:00Z'));
  });

  it('keeps the system clock and no test clock when test sign-in is off', () => {
    const { testClock, clock } = composeClock(false);

    expect(testClock).toBeUndefined();
    expect(clock).toBe(systemClock);
  });
});

describe('buildServer with test sign-in', () => {
  it('refuses to start without the test clock composeClock builds', async () => {
    const server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories(), settings: { testSignInEnabled: true } });

    await expect(server.ready()).rejects.toThrow(/needs a test clock/);
  });
});
