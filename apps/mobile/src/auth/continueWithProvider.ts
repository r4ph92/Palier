import type { AuthClient } from '../api/AuthClient';
import type { IdentityProviderName, ProviderSignIn } from './ProviderSignIn';

// The provider's sheet, then Palier: answers the Palier session token, or null when the person closed the sheet.
export async function continueWithProvider(provider: IdentityProviderName, providerSignIn: ProviderSignIn, authClient: AuthClient): Promise<string | null> {
  if (provider === 'apple') {
    const identity = await providerSignIn.apple();
    return identity === null ? null : authClient.signInWithApple(identity);
  }
  const identityToken = await providerSignIn.google();
  return identityToken === null ? null : authClient.signInWithGoogle(identityToken);
}
