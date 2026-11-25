import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { IdentityProvider, IdentityTokenVerifier, VerifiedIdentity } from '../../domain/identity/Identity.ts';

export interface ProviderTrust {
  readonly issuers: readonly string[];
  // The app's own id at the provider: a token made for another app is refused.
  readonly audience: string;
  readonly keys: JWTVerifyGetKey;
}

export type ProviderTrusts = Partial<Readonly<Record<IdentityProvider, ProviderTrust>>>;

const APPLE_ISSUERS = ['https://appleid.apple.com'];
const APPLE_KEYS_URL = new URL('https://appleid.apple.com/auth/keys');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_KEYS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

// The errors a token itself causes. Any other one (key set unreachable, unreadable) is rethrown.
const TOKEN_REFUSALS = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  // A token with no kid matches several of the provider's keys.
  errors.JWKSMultipleMatchingKeys,
];

// Only a provider with an audience is trusted; the other one answers as not configured.
export function providerTrustsFor(audiences: { readonly apple: string | undefined; readonly google: string | undefined }): ProviderTrusts {
  return {
    ...(audiences.apple === undefined ? {} : { APPLE: { issuers: APPLE_ISSUERS, audience: audiences.apple, keys: createRemoteJWKSet(APPLE_KEYS_URL) } }),
    ...(audiences.google === undefined ? {} : { GOOGLE: { issuers: GOOGLE_ISSUERS, audience: audiences.google, keys: createRemoteJWKSet(GOOGLE_KEYS_URL) } }),
  };
}

export class JoseIdentityTokenVerifier implements IdentityTokenVerifier {
  readonly #trusts: ProviderTrusts;

  constructor(trusts: ProviderTrusts) {
    this.#trusts = trusts;
  }

  accepts(provider: IdentityProvider): boolean {
    return this.#trusts[provider] !== undefined;
  }

  async verify(provider: IdentityProvider, identityToken: string): Promise<VerifiedIdentity | null> {
    const trust = this.#trusts[provider];
    if (trust === undefined) {
      return null;
    }
    try {
      const { payload } = await jwtVerify(identityToken, trust.keys, {
        issuer: [...trust.issuers],
        audience: trust.audience,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      return identityOf(provider, payload);
    } catch (error) {
      // A token that fails a check is untrusted; a key set Palier could not fetch or read is an outage, not a refusal.
      if (TOKEN_REFUSALS.some((refusal) => error instanceof refusal)) {
        return null;
      }
      throw error;
    }
  }
}

function identityOf(provider: IdentityProvider, payload: JWTPayload): VerifiedIdentity | null {
  const { sub, email } = payload;
  // Apple writes email_verified as the string "true", Google as a boolean.
  const emailVerified = payload['email_verified'] === true || payload['email_verified'] === 'true';
  if (typeof sub !== 'string' || sub === '' || typeof email !== 'string' || email === '' || !emailVerified) {
    return null;
  }
  const normalizedEmail = lowercaseAscii(email);
  return {
    provider,
    subject: sub,
    email: normalizedEmail,
    emailVouched: provider === 'APPLE' || normalizedEmail.endsWith('@gmail.com') || textClaim(payload['hd']) !== null,
    firstName: textClaim(payload['given_name']),
    lastName: textClaim(payload['family_name']),
  };
}

// Only A to Z: a full Unicode lowercase folds look-alikes (the Kelvin sign becomes k) onto another person's email.
function lowercaseAscii(email: string): string {
  return email.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function textClaim(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
