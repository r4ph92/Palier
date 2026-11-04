import { useState } from 'react';
import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';

export interface SignOutState {
  readonly pending: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly signOut: () => void;
}

export function useSignOut(onSignOut: (() => Promise<void>) | null): SignOutState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const signOut = () => {
    if (pending || onSignOut === null) {
      return;
    }
    setPending(true);
    setError(null);
    onSignOut().catch((failure: unknown) => {
      setError(asDashboardApiError(failure).code);
      setPending(false);
    });
  };
  return { pending, error, signOut };
}
