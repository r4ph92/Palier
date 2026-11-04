import type { DashboardMeResponse } from '@palier/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { asDashboardApiError } from '../api/DashboardApiError.ts';

const UNAUTHORIZED = 401;

export type Session =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'signedIn'; readonly me: DashboardMeResponse };

export interface SessionControls {
  readonly session: Session;
  readonly refresh: () => Promise<void>;
  readonly signOut: () => Promise<void>;
}

async function currentSession(): Promise<Session> {
  try {
    return { status: 'signedIn', me: await dashboardClient.me() };
  } catch (error) {
    return asDashboardApiError(error).status === UNAUTHORIZED ? { status: 'signedOut' } : { status: 'unreachable' };
  }
}

// The cookie is invisible to the page, so GET /me is the only way to learn who is signed in.
export function useDashboardSession(): SessionControls {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const refresh = useCallback(async () => setSession(await currentSession()), []);
  const signOut = useCallback(async () => {
    await dashboardClient.signOut().catch(() => undefined);
    setSession({ status: 'signedOut' });
  }, []);
  useEffect(() => {
    let current = true;
    void currentSession().then((loaded) => current && setSession(loaded));
    return () => {
      current = false;
    };
  }, []);
  return { session, refresh, signOut };
}
