import { createContext, useContext } from 'react';

type RefreshSession = () => Promise<void>;

export const SessionRefreshContext = createContext<RefreshSession | null>(null);

// Reads GET /me again: any page that meets a 401 calls it, and the shell falls back to the sign-in page.
export function useSessionRefresh(): RefreshSession {
  const refresh = useContext(SessionRefreshContext);
  if (refresh === null) {
    throw new Error('useSessionRefresh must be used inside SessionRefreshContext.');
  }
  return refresh;
}
