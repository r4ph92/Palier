import { describe, expect, it } from 'vitest';
import { authenticateDriver, hashSessionToken, signInDriver, signOutDriver } from '../../src/domain/drivers/driverSessions.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';

describe('driver sessions', () => {
  it('signs Julie in with a fresh token that authenticates her', async () => {
    const repository = new FakeDriverRepository();

    const signedIn = await signInDriver(repository, julie.id);

    expect(signedIn?.driver).toEqual(julie);
    expect(await authenticateDriver(repository, signedIn?.token ?? '')).toEqual(julie);
  });

  it('stores only the hash of the token', async () => {
    const repository = new FakeDriverRepository();

    const signedIn = await signInDriver(repository, julie.id);

    expect(repository.activeTokenHashes).toEqual([hashSessionToken(signedIn?.token ?? '')]);
    expect(repository.activeTokenHashes).not.toContain(signedIn?.token);
  });

  it('gives a different token on each sign-in', async () => {
    const repository = new FakeDriverRepository();

    const first = await signInDriver(repository, julie.id);
    const second = await signInDriver(repository, julie.id);

    expect(first?.token).not.toBe(second?.token);
  });

  it('signs nobody in for an unknown driver', async () => {
    expect(await signInDriver(new FakeDriverRepository(), '00000000-0000-4000-8000-000000000599')).toBeNull();
  });

  it('refuses the token once Julie signs out', async () => {
    const repository = new FakeDriverRepository();
    const signedIn = await signInDriver(repository, julie.id);
    const token = signedIn?.token ?? '';

    await signOutDriver(repository, token);

    expect(await authenticateDriver(repository, token)).toBeNull();
  });
});
