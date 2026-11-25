export type IdentityProvider = 'APPLE' | 'GOOGLE';

// What a provider vouches for once its identity token has been verified: who the person is and an email it checked.
export interface VerifiedIdentity {
  readonly provider: IdentityProvider;
  readonly subject: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

export interface IdentityTokenVerifier {
  // False when the API has no audience for this provider, so it cannot sign anyone in with it.
  accepts(provider: IdentityProvider): boolean;
  // Null for any token Palier must not trust: forged, expired, meant for another app, or without a verified email.
  verify(provider: IdentityProvider, identityToken: string): Promise<VerifiedIdentity | null>;
}

export interface PersonName {
  readonly firstName: string;
  readonly lastName: string;
}

export interface IdentityRepository {
  // The account of this identity; else the account with its email, which the identity joins; else a new account. Returns its id.
  findOrCreateAccount(identity: VerifiedIdentity, name: PersonName): Promise<string>;
}
