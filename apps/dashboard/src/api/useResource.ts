import { useEffect, useState } from 'react';
import { asDashboardApiError, type DashboardApiError } from './DashboardApiError.ts';

export type Resource<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'failed'; readonly error: DashboardApiError };

// Loads once per load function; callers keep it stable with useCallback and remount with a key to load another id.
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    load().then(
      (value) => current && setResource({ status: 'ready', value }),
      (error: unknown) => current && setResource({ status: 'failed', error: asDashboardApiError(error) }),
    );
    return () => {
      current = false;
    };
  }, [load]);
  return resource;
}
