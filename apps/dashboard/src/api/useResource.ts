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
}

// Loads once per load function and again on reload; callers keep load stable with useCallback and remount with a key for another id.
export function useResource<T>(load: () => Promise<T>): LoadedResource<T> {
  const refreshSession = useSessionRefresh();
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    load().then(
      (value) => current && setResource({ status: 'ready', value }),
      (failure: unknown) => current && setResource(failedResource(failure, refreshSession)),
    );
    return () => {
      current = false;
    };
  }, [load, attempt, refreshSession]);
  const reload = useCallback(() => {
    setResource({ status: 'loading' });
    setAttempt((previous) => previous + 1);
  }, []);
  return { resource, reload };
}

function failedResource(failure: unknown, refreshSession: () => Promise<void>): Resource<never> {
  const error = asDashboardApiError(failure);
  if (endsSession(error)) {
    void refreshSession();
  }
  return { status: 'failed', error };
}
