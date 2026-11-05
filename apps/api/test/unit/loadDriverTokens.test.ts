import { describe, expect, it } from 'vitest';
import { authenticateDriver } from '../../src/domain/drivers/driverSessions.ts';
import { LoadDriverTokens } from '../../src/load/loadDriverTokens.ts';
import { FakeDriverRepository, julie, marc } from './fakeDriverRepository.ts';

function loadTokensFor(drivers: FakeDriverRepository): LoadDriverTokens {
  return new LoadDriverTokens({ users: drivers, sessions: drivers.sessions });
}

describe('LoadDriverTokens', () => {
  it('revokes every token it signed in once the run is over', async () => {
    const drivers = new FakeDriverRepository();
    const tokens = loadTokensFor(drivers);
    const signedIn = await tokens.signIn([julie.id, marc.id]);

    await tokens.revokeAll();

    expect(await Promise.all(signedIn.map((token) => authenticateDriver(drivers.sessions, token)))).toEqual([null, null]);
  });

  it('still revokes the tokens signed in before an unknown driver stopped the sign-in', async () => {
    const drivers = new FakeDriverRepository();
    const tokens = loadTokensFor(drivers);

    await expect(tokens.signIn([julie.id, 'unknown-driver'])).rejects.toThrow(/reseed first/);
    expect(drivers.sessions.activeTokenHashes).toHaveLength(1);
    await tokens.revokeAll();

    expect(drivers.sessions.activeTokenHashes).toEqual([]);
  });
});
