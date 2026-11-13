import { useCallback, useEffect, useRef, useState } from 'react';
import { REQUEST_TIMEOUT_MILLISECONDS } from './dashboardClient.ts';
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
// Polling starts with the first value: a failed first load stays a failure with its retry. A lot that vanishes mid-poll is a failure too, and ends the polling.
export function usePolledResource<T>(load: () => Promise<T>, intervalMilliseconds: number): PolledResource<T> {
  const { resource, reload, isReloading } = useResource(load);
  const lastValue = useLastValue(resource);
  const isGone = resource.status === 'failed' && resource.error.code === 'LOT_NOT_FOUND';
  const hasHung = usePolling(lastValue !== null && !isGone ? reload : null, intervalMilliseconds, resource);
  if (resource.status === 'failed' && (lastValue === null || isGone)) {
    return { status: 'failed', error: resource.error, retry: reload, isRetrying: isReloading };
  }
  if (lastValue === null) {
    return { status: 'loading' };
  }
  return { status: 'ready', value: lastValue.value, isStale: resource.status === 'failed' || hasHung, updatedAt: lastValue.updatedAt };
}

function useLastValue<T>(resource: Resource<T>): LastValue<T> | null {
  const [lastValue, setLastValue] = useState<LastValue<T> | null>(null);
  if (resource.status === 'ready' && lastValue?.value !== resource.value) {
    setLastValue({ value: resource.value, updatedAt: new Date() });
  }
  return lastValue;
}

function usePolling(action: (() => void) | null, intervalMilliseconds: number, resource: Resource<unknown>): boolean {
  const { hasHung, startWatch } = useHangWatch(resource);
  const poll = useCallback(() => {
    if (!document.hidden) {
      startWatch();
      action?.();
    }
  }, [action, startWatch]);
  useTicks(action === null ? null : poll, intervalMilliseconds);
  return hasHung;
}

// The watch lives here, not in the request: a poll with no answer after the request timeout counts as failed even before the request is aborted.
// Any settled answer ends the watch; the flag belongs to the resource it was raised on, so a newer answer clears it.
function useHangWatch(resource: Resource<unknown>): { readonly hasHung: boolean; readonly startWatch: () => void } {
  const [hungOn, setHungOn] = useState<Resource<unknown> | null>(null);
  const current = useRef(resource);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    current.current = resource;
    clearTimeout(timer.current);
  }, [resource]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const startWatch = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHungOn(current.current), REQUEST_TIMEOUT_MILLISECONDS);
  }, []);
  return { hasHung: hungOn === resource, startWatch };
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
