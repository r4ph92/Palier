import type { DashboardSessionDetail } from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { usePolledResource, type PolledResource } from './usePolledResource.ts';

const POLL_INTERVAL_MILLISECONDS = 15_000;

export const isSessionGone = (error: { readonly code: string }): boolean => error.code === 'LOT_NOT_FOUND' || error.code === 'SESSION_NOT_FOUND';

const isEnded = ({ summary }: DashboardSessionDetail): boolean => !(ACTIVE_ENTRY_SESSION_STATES as readonly string[]).includes(summary.state);

// A session inside is read again for its next steps; one that ended, or that vanished, is read no more.
export function usePolledSession(load: () => Promise<DashboardSessionDetail>): PolledResource<DashboardSessionDetail> {
  return usePolledResource(load, POLL_INTERVAL_MILLISECONDS, { onError: isSessionGone, onValue: isEnded });
}
