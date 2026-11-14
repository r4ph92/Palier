import type { DashboardApiError } from './DashboardApiError.ts';
import { usePolledResource, type PolledResource } from './usePolledResource.ts';

// A gate is silent after 2 minutes, so a lot page read every 30 s shows it within 2 and a half.
const POLL_INTERVAL_MILLISECONDS = 30_000;

const isLotGone = (error: DashboardApiError): boolean => error.code === 'LOT_NOT_FOUND';

// The figures of one lot, read again while the page is open; a lot that vanished ends the polling.
export function usePolledLotResource<T>(load: () => Promise<T>): PolledResource<T> {
  return usePolledResource(load, POLL_INTERVAL_MILLISECONDS, isLotGone);
}
