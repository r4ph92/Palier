import { useEffect, useState } from 'react';
import type { DashboardApiError } from './DashboardApiError.ts';
import { useResource, type Resource } from './useResource.ts';

export type PolledResource<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: DashboardApiError; readonly retry: () => void; readonly isRetrying: boolean }
  | { readonly status: 'ready'; readonly value: T; readonly isStale: boolean };

// After a first value, a failed poll keeps that value on screen and flags it stale; the next successful poll clears the flag.
// Polling starts with the first value: a failed first load stays a failure with its retry.
export function usePolledResource<T>(load: () => Promise<T>, intervalMilliseconds: number): PolledResource<T> {
  const { resource, reload, isReloading } = useResource(load);
  const lastValue = useLastValue(resource);
  useInterval(lastValue !== null ? reload : null, intervalMilliseconds);
  if (resource.status === 'ready') {
    return { status: 'ready', value: resource.value, isStale: false };
  }
  if (resource.status === 'failed' && lastValue !== null) {
    return { status: 'ready', value: lastValue.value, isStale: true };
  }
  return resource.status === 'failed' ? { status: 'failed', error: resource.error, retry: reload, isRetrying: isReloading } : { status: 'loading' };
}

function useLastValue<T>(resource: Resource<T>): { readonly value: T } | null {
  const [lastValue, setLastValue] = useState<{ readonly value: T } | null>(null);
  if (resource.status === 'ready' && lastValue?.value !== resource.value) {
    setLastValue({ value: resource.value });
  }
  return lastValue;
}

function useInterval(action: (() => void) | null, milliseconds: number): void {
  useEffect(() => {
    if (action === null) {
      return undefined;
    }
    const timer = setInterval(action, milliseconds);
    return () => clearInterval(timer);
  }, [action, milliseconds]);
}
