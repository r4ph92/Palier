import { describe, expect, it } from 'vitest';
import { authenticateSessionToken, signInUser } from '../../src/domain/sessions/sessionTokens.ts';
import type { SessionScope } from '../../src/domain/sessions/SessionTokenRepository.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';

function fakeSessionAccess() {
  const users = new FakeDriverRepository();
  return { users, sessions: users.sessions };
}

async function signInTimes(access: ReturnType<typeof fakeSessionAccess>, scope: SessionScope, times: number): Promise<string[]> {
  const tokens: string[] = [];
  for (let sign = 0; sign < times; sign += 1) {
    tokens.push((await signInUser(access, julie.id, scope))?.token ?? '');
  }
  return tokens;
}

describe('ten active sessions per scope', () => {
  it('ends Julie\'s oldest dashboard session on her eleventh dashboard sign-in and keeps her app session', async () => {
    const access = fakeSessionAccess();
    const [appToken = ''] = await signInTimes(access, 'APP', 1);
    const [oldest = '', second = ''] = await signInTimes(access, 'DASHBOARD', 11);

    expect(await authenticateSessionToken(access.sessions, oldest, 'DASHBOARD')).toBeNull();
    expect(await authenticateSessionToken(access.sessions, second, 'DASHBOARD')).toEqual(julie);
    expect(await authenticateSessionToken(access.sessions, appToken, 'APP')).toEqual(julie);
  });

  it('ends Julie\'s oldest app session on her eleventh app sign-in and keeps her dashboard session', async () => {
    const access = fakeSessionAccess();
    const [dashboardToken = ''] = await signInTimes(access, 'DASHBOARD', 1);
    const [oldest = ''] = await signInTimes(access, 'APP', 11);

    expect(await authenticateSessionToken(access.sessions, oldest, 'APP')).toBeNull();
    expect(await authenticateSessionToken(access.sessions, dashboardToken, 'DASHBOARD')).toEqual(julie);
  });
});
