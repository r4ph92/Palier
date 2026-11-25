import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { VerifiedIdentity } from '../../src/domain/identity/Identity.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { julie, FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { FakeIdentityRepository, FakeIdentityTokenVerifier } from './fakes/fakeIdentities.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const hiddenEmailApple: VerifiedIdentity = { provider: 'APPLE', subject: 'apple-nouveau', email: 'x7f3k@privaterelay.appleid.com', firstName: null, lastName: null };
const marcGoogle: VerifiedIdentity = { provider: 'GOOGLE', subject: 'google-marc', email: 'marc.gagnon@gmail.com', firstName: 'Marc', lastName: 'Gagnon' };
const julieGoogle: VerifiedIdentity = { provider: 'GOOGLE', subject: 'google-julie', email: 'julie.tremblay@palier.test', firstName: 'Julie', lastName: 'Tremblay' };

interface Setup {
  readonly verifier?: FakeIdentityTokenVerifier;
  readonly withServices?: boolean;
}

describe('sign-in with Apple or Google', () => {
  let server: FastifyInstance;
  let drivers: FakeDriverRepository;
  let identities: FakeIdentityRepository;

  afterEach(() => server.close());

  function startServer({ verifier = trustedTokens(), withServices = true }: Setup = {}) {
    drivers = new FakeDriverRepository([julie]);
    identities = new FakeIdentityRepository(drivers, { 'julie.tremblay@palier.test': julie.id });
    server = buildServer({
      gates: fakeGateDependencies(),
      repositories: fakeRepositories({ driverRepository: drivers, vehicleRepository: new FakeVehicleRepository() }),
      ...(withServices ? { identitySignIn: { verifier, identities } } : {}),
    });
  }

  function trustedTokens() {
    return new FakeIdentityTokenVerifier()
      .trust('apple-hidden-email', hiddenEmailApple)
      .trust('google-marc-phone', marcGoogle)
      .trust('google-marc-tablet', marcGoogle)
      .trust('google-julie', julieGoogle);
  }

  function signIn(provider: 'apple' | 'google', payload: object) {
    return server.inject({ method: 'POST', url: `/v1/sign-in/${provider}`, payload });
  }

  it('creates an account for a new person on Apple with a hidden email, and the notice comes next', async () => {
    startServer();

    const response = await signIn('apple', { identityToken: 'apple-hidden-email' });
    const { token, driver } = response.json<{ token: string; driver: { id: string; firstName: string } }>();
    const me = await server.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });

    expect(response.statusCode).toBe(200);
    expect(driver.firstName).toBe('');
    expect(identities.accountCount).toBe(2);
    expect(me.json()).toEqual({ id: driver.id, firstName: '', acceptedNoticeVersion: null });
  });

  it('names the new account with the name Apple gave the app', async () => {
    startServer();

    const response = await signIn('apple', { identityToken: 'apple-hidden-email', firstName: ' Nadia ', lastName: 'Bouchard' });

    expect(response.json<{ driver: { firstName: string } }>().driver.firstName).toBe('Nadia');
  });

  it('opens the same account, vehicles included, when the same Google account signs in on another device', async () => {
    startServer();

    const phone = (await signIn('google', { identityToken: 'google-marc-phone' })).json<{ token: string; driver: { id: string } }>();
    const phoneHeaders = { authorization: `Bearer ${phone.token}` };
    await server.inject({ method: 'POST', url: '/v1/consent', headers: phoneHeaders, payload: { noticeVersion: PRIVACY_NOTICE_VERSION } });
    await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers: phoneHeaders, payload: { plate: 'ABC 123', province: 'QC' } });
    const tablet = (await signIn('google', { identityToken: 'google-marc-tablet' })).json<{ token: string; driver: { id: string } }>();
    const tabletVehicles = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers: { authorization: `Bearer ${tablet.token}` } });

    expect(tablet.driver.id).toBe(phone.driver.id);
    expect(tablet.token).not.toBe(phone.token);
    expect(identities.accountCount).toBe(2);
    expect(tabletVehicles.json<{ plate: string }[]>().map(({ plate }) => plate)).toEqual(['ABC 123']);
  });

  it('joins a Google identity to the account that already has its email', async () => {
    startServer();

    const response = await signIn('google', { identityToken: 'google-julie' });

    expect(response.json<{ driver: { id: string } }>().driver.id).toBe(julie.id);
    expect(identities.accountCount).toBe(1);
  });

  it.each([
    ['apple', 'a forged token'],
    ['google', 'an expired token'],
    ['google', 'apple-hidden-email'],
  ] as const)('answers 401 on %s to %s and creates no account and no session', async (provider, identityToken) => {
    startServer();

    const response = await signIn(provider, { identityToken });

    expect(response.statusCode).toBe(401);
    expect(identities.identityCount).toBe(0);
    expect(drivers.sessions.activeTokenHashes).toEqual([]);
  });

  it('answers 503 when the provider is not configured', async () => {
    startServer({ verifier: new FakeIdentityTokenVerifier(['APPLE']).trust('google-marc-phone', marcGoogle) });

    const response = await signIn('google', { identityToken: 'google-marc-phone' });

    expect(response.statusCode).toBe(503);
    expect(response.json<{ error: string }>().error).toBe('SIGN_IN_UNAVAILABLE');
  });

  it('answers 503 when the server has no identity services', async () => {
    startServer({ withServices: false });

    expect((await signIn('apple', { identityToken: 'apple-hidden-email' })).statusCode).toBe(503);
  });

  it.each([
    ['no token', {}],
    ['an empty token', { identityToken: '' }],
    ['a token too long to be one', { identityToken: 'x'.repeat(4097) }],
    ['a token that is not text', { identityToken: 42 }],
  ])('answers 400 for %s', async (_case, payload) => {
    startServer();

    expect((await signIn('google', payload)).statusCode).toBe(400);
  });

  it('answers 400 for a first name longer than 50 characters', async () => {
    startServer();

    expect((await signIn('apple', { identityToken: 'apple-hidden-email', firstName: 'N'.repeat(51) })).statusCode).toBe(400);
  });

  it('refuses the eleventh sign-in from one address within a minute, across both providers', async () => {
    startServer();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      statuses.push((await signIn(attempt % 2 === 0 ? 'apple' : 'google', { identityToken: 'a forged token' })).statusCode);
    }

    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
