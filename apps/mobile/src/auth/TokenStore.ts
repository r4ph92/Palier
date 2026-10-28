import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'palier.sessionToken';

export interface TokenStore {
  read(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

// The iOS keychain keeps the token encrypted on the device and across app restarts.
export const secureTokenStore: TokenStore = {
  read: () => SecureStore.getItemAsync(SESSION_TOKEN_KEY),
  save: (token) => SecureStore.setItemAsync(SESSION_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
};
