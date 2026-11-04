import { useState } from 'react';
import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';

export interface SignOutState {
  readonly pending: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly signOut: () => void;
}

export function useSignOut(onSignOut: () => Promise<void>): SignOutState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const signOut = () => {
    setPending(true);
    setError(null);
    onSignOut().catch((failure: unknown) => {
      setError(asDashboardApiError(failure).code);
      setPending(false);
    });
  };
  return { pending, error, signOut };
}
