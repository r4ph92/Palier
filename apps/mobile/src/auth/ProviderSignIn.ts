import type { AppleIdentity } from '../api/AuthClient';

export type IdentityProviderName = 'apple' | 'google';

// The provider's own sign-in sheet. Each answers null when the person closes the sheet without signing in.
export interface ProviderSignIn {
  apple(): Promise<AppleIdentity | null>;
  google(): Promise<string | null>;
}
