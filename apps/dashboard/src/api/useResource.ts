import { useCallback, useEffect, useState } from 'react';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { asDashboardApiError, endsSession, type DashboardApiError } from './DashboardApiError.ts';

export type Resource<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'failed'; readonly error: DashboardApiError };

export interface LoadedResource<T> {
  readonly resource: Resource<T>;
  readonly reload: () => void;
  readonly isReloading: boolean;
}

// A reload keeps a failed resource in place with isReloading set, so the failure block does not unmount under the user's focus.
// Loads once per load function and again on reload; callers keep load stable with useCallback and remount with a key for another id.
export function useResource<T>(load: () => Promise<T>): LoadedResource<T> {
  const refreshSession = useSessionRefresh();
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  useEffect(() => {
    let current = true;
    load().then(
      (value) => {
        if (current) {
          setResource({ status: 'ready', value });
          setIsReloading(false);
        }
      },
      (failure: unknown) => {
        if (!current) {
          return;
        }
        const error = asDashboardApiError(failure);
        if (endsSession(error)) {
          void refreshSession();
        }
        setResource({ status: 'failed', error });
        setIsReloading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [load, attempt, refreshSession]);
  const reload = useCallback(() => {
    setIsReloading(true);
    setAttempt((previous) => previous + 1);
  }, []);
  return { resource, reload, isReloading };
}
