import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateSessionToken, revokeSession, signInUser } from '../../src/domain/sessions/sessionTokens.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';

const HOUR = 60 * 60 * 1000;

function fakeSessionAccess() {
  const users = new FakeDriverRepository();
  return { users, sessions: users.sessions };
}

async function tokenFor(access: ReturnType<typeof fakeSessionAccess>, scope: 'APP' | 'DASHBOARD'): Promise<string> {
  return (await signInUser(access, julie.id, scope))?.token ?? '';
}

describe('session token scopes', () => {
  afterEach(() => vi.useRealTimers());

  it('accepts a dashboard token only in the dashboard scope', async () => {
    const access = fakeSessionAccess();
    const token = await tokenFor(access, 'DASHBOARD');

    expect(await authenticateSessionToken(access.sessions, token, 'DASHBOARD')).toEqual(julie);
    expect(await authenticateSessionToken(access.sessions, token, 'APP')).toBeNull();
  });

  it('accepts an app token only in the app scope', async () => {
    const access = fakeSessionAccess();
    const token = await tokenFor(access, 'APP');

    expect(await authenticateSessionToken(access.sessions, token, 'DASHBOARD')).toBeNull();
  });

  it('keeps Julie signed in to the app after ten dashboard sign-ins', async () => {
    const access = fakeSessionAccess();
    const appToken = await tokenFor(access, 'APP');
    for (let sign = 0; sign < 10; sign += 1) {
      await tokenFor(access, 'DASHBOARD');
    }

    expect(await authenticateSessionToken(access.sessions, appToken, 'APP')).toEqual(julie);
  });

  it('does not revoke a dashboard token when asked to revoke it as an app token', async () => {
    const access = fakeSessionAccess();
    const token = await tokenFor(access, 'DASHBOARD');

    await revokeSession(access.sessions, token, 'APP');

    expect(await authenticateSessionToken(access.sessions, token, 'DASHBOARD')).toEqual(julie);
  });

  it('ends a dashboard session after twelve hours and an app session after thirty days', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const access = fakeSessionAccess();
    const dashboardToken = await tokenFor(access, 'DASHBOARD');
    const appToken = await tokenFor(access, 'APP');
    vi.setSystemTime(new Date(Date.parse('2026-01-01T00:00:00Z') + 12 * HOUR + 1));

    expect(await authenticateSessionToken(access.sessions, dashboardToken, 'DASHBOARD')).toBeNull();
    expect(await authenticateSessionToken(access.sessions, appToken, 'APP')).toEqual(julie);
  });
});
