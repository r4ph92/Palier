import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { AppleIdentity } from '../api/AuthClient';
import type { ProviderSignIn } from './ProviderSignIn';

const APPLE_CANCELLED = 'ERR_REQUEST_CANCELED';

// The sheets iOS and Google show. They need the development build: Expo Go has neither module for Palier.
export function nativeProviderSignIn(googleIosClientId: string): ProviderSignIn {
  GoogleSignin.configure({ iosClientId: googleIosClientId });
  return { apple: signInWithApple, google: signInWithGoogle };
}

async function signInWithApple(): Promise<AppleIdentity | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (credential.identityToken === null) {
      throw new Error('Apple returned no identity token');
    }
    return { identityToken: credential.identityToken, firstName: credential.fullName?.givenName ?? null, lastName: credential.fullName?.familyName ?? null };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === APPLE_CANCELLED) {
      return null;
    }
    throw error;
  }
}

async function signInWithGoogle(): Promise<string | null> {
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    return null;
  }
  if (response.data.idToken === null) {
    throw new Error('Google returned no identity token');
  }
  return response.data.idToken;
}
