import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateDriver, signInDriver, signOutDriver } from '../../src/domain/drivers/driverSessions.ts';
import { hashSessionToken, purgeEndedSessionTokens } from '../../src/domain/sessions/sessionTokens.ts';
import { FakeDriverRepository, julie, marc } from './fakeDriverRepository.ts';

function fakeDriverAccess() {
  const drivers = new FakeDriverRepository();
  return { drivers, sessions: drivers.sessions };
}

const DAY = 24 * 60 * 60 * 1000;

describe('driver sessions', () => {
  afterEach(() => vi.useRealTimers());

  it('signs Julie in with a fresh token that authenticates her', async () => {
    const access = fakeDriverAccess();

    const signedIn = await signInDriver(access, julie.id);

    expect(signedIn?.driver).toEqual(julie);
    expect(await authenticateDriver(access.sessions, signedIn?.token ?? '')).toEqual(julie);
  });

  it('stores only the hash of the token', async () => {
    const access = fakeDriverAccess();

    const signedIn = await signInDriver(access, julie.id);

    expect(access.sessions.activeTokenHashes).toEqual([hashSessionToken(signedIn?.token ?? '')]);
    expect(access.sessions.activeTokenHashes).not.toContain(signedIn?.token);
  });

  it('gives a different token on each sign-in', async () => {
    const access = fakeDriverAccess();

    const first = await signInDriver(access, julie.id);
    const second = await signInDriver(access, julie.id);

    expect(first?.token).not.toBe(second?.token);
  });

  it('signs nobody in for an unknown driver', async () => {
    expect(await signInDriver(fakeDriverAccess(), '00000000-0000-4000-8000-000000000599')).toBeNull();
  });

  it('ends her oldest session when she signs in an eleventh time', async () => {
    const access = fakeDriverAccess();
    const tokens: string[] = [];
    for (let sign = 0; sign < 11; sign += 1) {
      tokens.push((await signInDriver(access, julie.id))?.token ?? '');
    }

    expect(await authenticateDriver(access.sessions, tokens[0] ?? '')).toBeNull();
    expect(await authenticateDriver(access.sessions, tokens[1] ?? '')).toEqual(julie);
    expect(await authenticateDriver(access.sessions, tokens[10] ?? '')).toEqual(julie);
  });

  it('does not end the sessions of another driver when Julie signs in past the limit', async () => {
    const access = fakeDriverAccess();
    const marcToken = (await signInDriver(access, marc.id))?.token ?? '';
    for (let sign = 0; sign < 11; sign += 1) {
      await signInDriver(access, julie.id);
    }

    expect(await authenticateDriver(access.sessions, marcToken)).toEqual(marc);
  });

  it('refuses the token once Julie signs out', async () => {
    const access = fakeDriverAccess();
    const signedIn = await signInDriver(access, julie.id);
    const token = signedIn?.token ?? '';

    await signOutDriver(access.sessions, token);

    expect(await authenticateDriver(access.sessions, token)).toBeNull();
  });

  it('purges tokens that expired more than seven days ago and keeps the others', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const access = fakeDriverAccess();
    const stale = await signInDriver(access, julie.id);
    vi.setSystemTime(new Date('2026-01-20T00:00:00Z'));
    const recent = await signInDriver(access, julie.id);
    vi.setSystemTime(new Date('2026-02-08T00:00:00Z'));

    expect(await purgeEndedSessionTokens(access.sessions, new Date())).toBe(1);
    expect(await authenticateDriver(access.sessions, stale?.token ?? '')).toBeNull();
    expect(await authenticateDriver(access.sessions, recent?.token ?? '')).toEqual(julie);
  });

  it('purges tokens revoked more than seven days ago', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const access = fakeDriverAccess();
    const signedIn = await signInDriver(access, julie.id);
    await signOutDriver(access.sessions, signedIn?.token ?? '');
    vi.setSystemTime(new Date('2026-01-09T00:00:00Z'));

    expect(await purgeEndedSessionTokens(access.sessions, new Date())).toBe(1);
  });

  it('keeps a token that ended exactly seven days ago', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const access = fakeDriverAccess();
    const signedIn = await signInDriver(access, julie.id);
    await signOutDriver(access.sessions, signedIn?.token ?? '');
    vi.setSystemTime(new Date(Date.parse('2026-01-01T00:00:00Z') + 7 * DAY));

    expect(await purgeEndedSessionTokens(access.sessions, new Date())).toBe(0);
  });

  it('keeps a token revoked less than seven days ago', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const access = fakeDriverAccess();
    const signedIn = await signInDriver(access, julie.id);
    await signOutDriver(access.sessions, signedIn?.token ?? '');
    vi.setSystemTime(new Date(Date.parse('2026-01-01T00:00:00Z') + 6 * DAY));

    expect(await purgeEndedSessionTokens(access.sessions, new Date())).toBe(0);
  });
});
