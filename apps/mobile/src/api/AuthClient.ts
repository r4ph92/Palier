import type { CurrentDriver } from '@palier/shared-types';

// What Apple hands the app: its token, and the name only on the person's first sign-in.
export interface AppleIdentity {
  readonly identityToken: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

export interface AuthClient {
  fetchMe(token: string): Promise<CurrentDriver>;
  // Each answers the Palier session token for the account the provider's identity opens.
  signInWithApple(identity: AppleIdentity): Promise<string>;
  signInWithGoogle(identityToken: string): Promise<string>;
  saveName(token: string, firstName: string, lastName: string): Promise<void>;
  acceptNotice(token: string, noticeVersion: string): Promise<void>;
  signOut(token: string): Promise<void>;
}

export class PalierUnauthorizedError extends Error {
  constructor() {
    super('Palier refused the session token');
    this.name = 'PalierUnauthorizedError';
  }
}
