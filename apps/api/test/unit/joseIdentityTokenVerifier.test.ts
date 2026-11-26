import { createLocalJWKSet, errors, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { JoseIdentityTokenVerifier, type ProviderTrusts } from '../../src/infrastructure/identity/JoseIdentityTokenVerifier.ts';

const APPLE_AUDIENCE = 'ca.palier.app';
const GOOGLE_AUDIENCE = '29475020077-test.apps.googleusercontent.com';
const KEY_ID = 'provider-key';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

let providerKeys: KeyPair;
let attackerKeys: KeyPair;
let verifier: JoseIdentityTokenVerifier;

beforeAll(async () => {
  providerKeys = await generateKeyPair('RS256');
  attackerKeys = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(providerKeys.publicKey)), kid: KEY_ID, alg: 'RS256' }] });
  const trusts: ProviderTrusts = {
    APPLE: { issuers: ['https://appleid.apple.com'], audience: APPLE_AUDIENCE, keys },
    GOOGLE: { issuers: ['https://accounts.google.com', 'accounts.google.com'], audience: GOOGLE_AUDIENCE, keys },
  };
  verifier = new JoseIdentityTokenVerifier(trusts);
});

interface TokenOptions {
  readonly claims?: JWTPayload;
  readonly issuer?: string;
  readonly audience?: string;
  readonly expiresIn?: string | number;
  readonly signedBy?: KeyPair;
  readonly subject?: string;
}

function appleToken({ claims = {}, issuer = 'https://appleid.apple.com', audience = APPLE_AUDIENCE, expiresIn = '10m', signedBy = providerKeys }: TokenOptions = {}) {
  return new SignJWT({ email: 'julie@privaterelay.appleid.com', email_verified: 'true', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setSubject('001234.apple-julie')
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(signedBy.privateKey);
}

function googleToken({ claims = {}, issuer = 'https://accounts.google.com', audience = GOOGLE_AUDIENCE, subject = 'google-marc' }: TokenOptions = {}) {
  return new SignJWT({ email: 'Marc.Gagnon@gmail.com', email_verified: true, given_name: 'Marc', family_name: 'Gagnon', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setSubject(subject)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(providerKeys.privateKey);
}

describe('JoseIdentityTokenVerifier', () => {
  it('trusts an Apple token for Palier, with a hidden email and no name', async () => {
    const identity = await verifier.verify('APPLE', await appleToken());

    expect(identity).toEqual({ provider: 'APPLE', subject: '001234.apple-julie', email: 'julie@privaterelay.appleid.com', emailVouched: true, firstName: null, lastName: null });
  });

  it('trusts a Google token, keeps its name and lowercases its email', async () => {
    const identity = await verifier.verify('GOOGLE', await googleToken());

    expect(identity).toEqual({ provider: 'GOOGLE', subject: 'google-marc', email: 'marc.gagnon@gmail.com', emailVouched: true, firstName: 'Marc', lastName: 'Gagnon' });
  });

  it.each([
    ['a Gmail address', { email: 'marc@gmail.com' }, true],
    ['a domain Google manages (hd claim)', { email: 'marc@cegep.qc.ca', hd: 'cegep.qc.ca' }, true],
    ['any other address', { email: 'marc@old-employer.example' }, false],
  ])('says whether Google owns the mailbox for %s', async (_case, claims, vouched) => {
    const identity = await verifier.verify('GOOGLE', await googleToken({ claims }));

    expect(identity?.emailVouched).toBe(vouched);
  });

  it('lowercases only A to Z, so a look-alike letter does not become another email', async () => {
    const identity = await verifier.verify('GOOGLE', await googleToken({ claims: { email: '\u212Aate@Kel.test' } }));

    expect(identity?.email).toBe('\u212Aate@kel.test');
  });

  it('refuses a token signed with a key the provider does not publish', async () => {
    expect(await verifier.verify('APPLE', await appleToken({ signedBy: attackerKeys }))).toBeNull();
  });

  it('refuses an expired token', async () => {
    const expired = await appleToken({ expiresIn: Math.floor(Date.now() / 1000) - 60 });

    expect(await verifier.verify('APPLE', expired)).toBeNull();
  });

  it('refuses a token meant for another app', async () => {
    expect(await verifier.verify('APPLE', await appleToken({ audience: 'host.exp.Exponent' }))).toBeNull();
  });

  it('refuses a token from another issuer', async () => {
    expect(await verifier.verify('APPLE', await appleToken({ issuer: 'https://evil.example' }))).toBeNull();
  });

  it('refuses an Apple token presented as a Google one', async () => {
    expect(await verifier.verify('GOOGLE', await appleToken())).toBeNull();
  });

  it('refuses a token whose email the provider has not verified', async () => {
    expect(await verifier.verify('GOOGLE', await googleToken({ claims: { email_verified: false } }))).toBeNull();
  });

  it('refuses a token without an email', async () => {
    expect(await verifier.verify('GOOGLE', await googleToken({ claims: { email: undefined } }))).toBeNull();
  });

  it.each(['', 'not-a-token', 'a.b.c'])('refuses the malformed token "%s"', async (token) => {
    expect(await verifier.verify('APPLE', token)).toBeNull();
  });

  it('refuses an unsigned token', async () => {
    const [, payload] = (await appleToken()).split('.');
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${payload}.`;

    expect(await verifier.verify('APPLE', unsigned)).toBeNull();
  });

  it('refuses a token without a key id when the provider publishes several keys', async () => {
    const otherKeys = await generateKeyPair('RS256');
    const twoKeys = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(providerKeys.publicKey)), kid: KEY_ID, alg: 'RS256' },
        { ...(await exportJWK(otherKeys.publicKey)), kid: 'other-key', alg: 'RS256' },
      ],
    });
    const twoKeyVerifier = new JoseIdentityTokenVerifier({ APPLE: { issuers: ['https://appleid.apple.com'], audience: APPLE_AUDIENCE, keys: twoKeys } });
    const withoutKid = await new SignJWT({ email: 'julie@privaterelay.appleid.com', email_verified: 'true' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('001234.apple-julie')
      .setIssuer('https://appleid.apple.com')
      .setAudience(APPLE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(attackerKeys.privateKey);

    expect(await twoKeyVerifier.verify('APPLE', withoutKid)).toBeNull();
  });

  it('refuses a token with an empty subject', async () => {
    expect(await verifier.verify('GOOGLE', await googleToken({ subject: '' }))).toBeNull();
  });

  it('rethrows a key set it could not fetch, so an outage is not read as a refused token', async () => {
    const unreachable = new JoseIdentityTokenVerifier({
      APPLE: { issuers: ['https://appleid.apple.com'], audience: APPLE_AUDIENCE, keys: () => Promise.reject(new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response')) },
    });

    await expect(unreachable.verify('APPLE', await appleToken())).rejects.toBeInstanceOf(errors.JOSEError);
  });

  it('accepts only the providers it has an audience for', async () => {
    const appleOnly = new JoseIdentityTokenVerifier({ APPLE: { issuers: ['https://appleid.apple.com'], audience: APPLE_AUDIENCE, keys: () => Promise.reject(new Error('unused')) } });

    expect(appleOnly.accepts('APPLE')).toBe(true);
    expect(appleOnly.accepts('GOOGLE')).toBe(false);
    expect(await appleOnly.verify('GOOGLE', await googleToken())).toBeNull();
  });
});
