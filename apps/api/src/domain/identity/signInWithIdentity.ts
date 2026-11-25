import { signInDriver, type SignedInDriver } from '../drivers/driverSessions.ts';
import type { SessionAccess } from '../sessions/sessionTokens.ts';
import type { IdentityProvider, IdentityRepository, IdentityTokenVerifier, PersonName, VerifiedIdentity } from './Identity.ts';

export const NAME_MAX_LENGTH = 50;

export interface IdentitySignInDependencies {
  readonly verifier: IdentityTokenVerifier;
  readonly identities: IdentityRepository;
  readonly access: SessionAccess;
}

export interface SuppliedName {
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
}

export interface IdentitySignIn {
  readonly provider: IdentityProvider;
  readonly identityToken: string;
  // Apple gives the name to the app only, on the first sign-in; it names a new account and is ignored afterwards.
  readonly name?: SuppliedName | undefined;
}

// Null when the token is not trusted: nothing is created and no session is opened.
export async function signInWithIdentity({ verifier, identities, access }: IdentitySignInDependencies, signIn: IdentitySignIn): Promise<SignedInDriver | null> {
  const identity = await verifier.verify(signIn.provider, signIn.identityToken);
  if (identity === null) {
    return null;
  }
  const userId = await identities.findOrCreateAccount(identity, newAccountName(identity, signIn.name));
  return signInDriver(access, userId);
}

// The provider's name first, then the one the app passed; empty when neither has one, and the app then asks for it.
function newAccountName(identity: VerifiedIdentity, supplied: SuppliedName | undefined): PersonName {
  return {
    firstName: cleanName(identity.firstName ?? supplied?.firstName),
    lastName: cleanName(identity.lastName ?? supplied?.lastName),
  };
}

const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

export function cleanName(name: string | null | undefined): string {
  return withoutControlCharacters(name ?? '').trim().slice(0, NAME_MAX_LENGTH);
}

// Postgres refuses NUL in text, and no control character belongs in a name.
function withoutControlCharacters(text: string): string {
  return [...text].filter((character) => character.charCodeAt(0) >= FIRST_PRINTABLE && character.charCodeAt(0) !== DELETE).join('');
}
