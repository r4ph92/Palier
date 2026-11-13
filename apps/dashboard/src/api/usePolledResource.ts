import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { DashboardApiError } from './DashboardApiError.ts';
import { useResource, type Resource } from './useResource.ts';

export type PolledResource<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: DashboardApiError; readonly retry: () => void; readonly isRetrying: boolean }
  | { readonly status: 'ready'; readonly value: T; readonly isStale: boolean; readonly updatedAt: Date };

interface LastValue<T> {
  readonly value: T;
  readonly updatedAt: Date;
}

// After a first value, a failed poll keeps that value on screen and flags it stale; the next successful poll clears the flag.
// Polling starts with the first value: a failed first load stays a failure with its retry. An error the caller says ends the polling (a lot that vanished) is a failure too.
export function usePolledResource<T>(load: () => Promise<T>, intervalMilliseconds: number, endsPolling: (error: DashboardApiError) => boolean): PolledResource<T> {
  const { resource, reload, isReloading } = useResource(load);
  const lastValue = useLastValue(resource);
  const isOver = resource.status === 'failed' && endsPolling(resource.error);
  usePolling(lastValue !== null && !isOver ? reload : null, intervalMilliseconds);
  if (resource.status === 'failed' && (lastValue === null || isOver)) {
    return { status: 'failed', error: resource.error, retry: reload, isRetrying: isReloading };
  }
  if (lastValue === null) {
    return { status: 'loading' };
  }
  return { status: 'ready', value: lastValue.value, isStale: resource.status === 'failed', updatedAt: lastValue.updatedAt };
}

function useLastValue<T>(resource: Resource<T>): LastValue<T> | null {
  const [lastValue, setLastValue] = useState<LastValue<T> | null>(null);
  if (resource.status === 'ready' && lastValue?.value !== resource.value) {
    setLastValue({ value: resource.value, updatedAt: new Date() });
  }
  return lastValue;
}

// flushSync starts the request within the tick, so its timeout counts from the tick and not from a later render.
function usePolling(action: (() => void) | null, intervalMilliseconds: number): void {
  const poll = useCallback(() => {
    if (!document.hidden) {
      flushSync(() => action?.());
    }
  }, [action]);
  useTicks(action === null ? null : poll, intervalMilliseconds);
}

// Ticks are skipped while the tab is hidden, and one runs as soon as it shows again.
function useTicks(poll: (() => void) | null, intervalMilliseconds: number): void {
  useEffect(() => {
    if (poll === null) {
      return undefined;
    }
    const timer = setInterval(poll, intervalMilliseconds);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [poll, intervalMilliseconds]);
}
