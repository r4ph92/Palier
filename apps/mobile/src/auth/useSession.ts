import type { CurrentDriver } from '@palier/shared-types';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError, type AuthClient } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import type { TokenStore } from './TokenStore';

export type SessionState =
  | { readonly status: 'restoring' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly token: string; readonly driver: CurrentDriver };

export interface SessionController {
  readonly state: SessionState;
  signIn(driverId: string): Promise<void>;
  acceptNotice(): Promise<void>;
  signOut(): void;
  expire(): void;
  retry(): void;
}

const SIGNED_OUT: SessionState = { status: 'signedOut' };

export function useSession(authClient: AuthClient, tokenStore: TokenStore): SessionController {
  const [state, setState, retry] = useRestoredSession(authClient, tokenStore);
  const signIn = useSignIn(authClient, tokenStore, setState);
  const expire = useCallback(() => {
    setState(SIGNED_OUT);
    void tokenStore.clear();
  }, [tokenStore, setState]);
  const signOut = useCallback(() => {
    if (state.status === 'signedIn') {
      // Best effort: the driver is signed out on the device even if the API cannot be reached.
      authClient.signOut(state.token).catch(() => undefined);
    }
    expire();
  }, [authClient, state, expire]);
  const acceptNotice = useAcceptNotice(authClient, state, setState);
  return { state, signIn, acceptNotice, signOut, expire, retry };
}

function useAcceptNotice(authClient: AuthClient, state: SessionState, setState: Dispatch<SetStateAction<SessionState>>) {
  return useCallback(async () => {
    if (state.status !== 'signedIn') {
      return;
    }
    await authClient.acceptNotice(state.token, PRIVACY_NOTICE_VERSION);
    setState({ ...state, driver: { ...state.driver, acceptedNoticeVersion: PRIVACY_NOTICE_VERSION } });
  }, [authClient, state, setState]);
}

function useSignIn(authClient: AuthClient, tokenStore: TokenStore, setState: Dispatch<SetStateAction<SessionState>>) {
  return useCallback(
    async (driverId: string) => {
      const { token } = await authClient.signInAsTestDriver(driverId);
      await tokenStore.save(token);
      const driver = await authClient.fetchMe(token);
      setState({ status: 'signedIn', token, driver });
    },
    [authClient, tokenStore, setState],
  );
}

function useRestoredSession(authClient: AuthClient, tokenStore: TokenStore) {
  const [state, setState] = useState<SessionState>({ status: 'restoring' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let isLatestAttempt = true;
    restoreSession(authClient, tokenStore).then((restored) => isLatestAttempt && setState(restored), rethrowDuringRender(setState));
    return () => {
      isLatestAttempt = false;
    };
  }, [authClient, tokenStore, attempt]);
  const retry = useCallback(() => {
    setState({ status: 'restoring' });
    setAttempt((previous) => previous + 1);
  }, []);
  return [state, setState, retry] as const;
}

// An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
function rethrowDuringRender(setState: Dispatch<SetStateAction<SessionState>>) {
  return (error: unknown) =>
    setState(() => {
      throw error;
    });
}

async function restoreSession(authClient: AuthClient, tokenStore: TokenStore): Promise<SessionState> {
  const token = await tokenStore.read();
  if (token === null) {
    return SIGNED_OUT;
  }
  try {
    return { status: 'signedIn', token, driver: await authClient.fetchMe(token) };
  } catch (error) {
    return sessionAfterFailedRestore(error, tokenStore);
  }
}

async function sessionAfterFailedRestore(error: unknown, tokenStore: TokenStore): Promise<SessionState> {
  if (error instanceof PalierUnauthorizedError) {
    await tokenStore.clear();
    return SIGNED_OUT;
  }
  if (error instanceof PalierUnreachableError) {
    return { status: 'unreachable' };
  }
  throw error;
}
