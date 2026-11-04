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
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const settle = useCallback((settled: Resource<T>) => {
    setResource(settled);
    setIsReloading(false);
  }, []);
  useLoadAttempt(load, attempt, settle);
  const reload = useCallback(() => {
    setIsReloading(true);
    setAttempt((previous) => previous + 1);
  }, []);
  return { resource, reload, isReloading };
}

function useLoadAttempt<T>(load: () => Promise<T>, attempt: number, settle: (settled: Resource<T>) => void): void {
  const refreshSession = useSessionRefresh();
  useEffect(() => {
    let current = true;
    const onFailure = (failure: unknown) => {
      const error = asDashboardApiError(failure);
      if (current && endsSession(error)) {
        void refreshSession();
      }
      if (current) {
        settle({ status: 'failed', error });
      }
    };
    load().then((value) => current && settle({ status: 'ready', value }), onFailure);
    return () => {
      current = false;
    };
  }, [load, attempt, refreshSession, settle]);
}
