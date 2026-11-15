import type { DashboardSessionList, DashboardSessionRow } from '@palier/shared-types';
import type { SessionListStatus } from '@palier/shared-types/sessionTimeline';
import { useCallback, useState } from 'react';
import { asDashboardApiError, type DashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { dashboardClient, type SessionListRequest } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';

interface FirstPage {
  readonly status: SessionListStatus;
  readonly list: DashboardSessionList;
}

interface OlderPages {
  readonly status: SessionListStatus;
  readonly rows: readonly DashboardSessionRow[];
  readonly nextCursor: string | null;
}

export interface OlderSessions {
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly failure: DisplayedErrorCode | null;
  readonly load: () => void;
}

export type SessionListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly error: DashboardApiError; readonly retry: () => void; readonly isRetrying: boolean }
  | { readonly kind: 'ready'; readonly lotName: string; readonly sessions: readonly DashboardSessionRow[]; readonly isSwitching: boolean; readonly older: OlderSessions };

// The first page follows the filter; the older pages are appended to it on request, and a change of filter drops them.
// Changing the filter keeps the previous page on screen (isSwitching) until the new one arrives, so the filter buttons never unmount under the user's focus.
export function useSessionList(lotId: string, status: SessionListStatus): SessionListState {
  const load = useCallback(() => dashboardClient.sessions(lotId, { status, before: null }).then((list): FirstPage => ({ status, list })), [lotId, status]);
  const { resource, reload, isReloading } = useResource(load);
  const olderPages = useOlderPages(lotId, status, resource.status === 'ready' ? resource.value.list.nextCursor : null);
  if (resource.status === 'loading') {
    return { kind: 'loading' };
  }
  if (resource.status === 'failed') {
    return { kind: 'failed', error: resource.error, retry: reload, isRetrying: isReloading };
  }
  const { list } = resource.value;
  const isSwitching = resource.value.status !== status;
  return { kind: 'ready', lotName: list.lotName, sessions: [...list.sessions, ...olderPages.rows], isSwitching, older: olderPages.older };
}

interface UsedOlderPages {
  readonly rows: readonly DashboardSessionRow[];
  readonly older: OlderSessions;
}

interface OlderRequest {
  readonly isLoading: boolean;
  readonly failure: DisplayedErrorCode | null;
}

const IDLE: OlderRequest = { isLoading: false, failure: null };

// A page, or the code of the refusal that kept it from coming.
async function readOlderPage(lotId: string, request: SessionListRequest): Promise<DashboardSessionList | DisplayedErrorCode> {
  try {
    return await dashboardClient.sessions(lotId, request);
  } catch (error) {
    return asDashboardApiError(error).code;
  }
}

interface OlderState {
  readonly pages: OlderPages | null;
  readonly request: OlderRequest;
}

// A refusal keeps the pages already read and says why the next one did not come.
function stateAfter(outcome: DashboardSessionList | DisplayedErrorCode, status: SessionListStatus, pages: OlderPages | null): OlderState {
  if (typeof outcome === 'string') {
    return { pages, request: { isLoading: false, failure: outcome } };
  }
  return { pages: { status, rows: [...(pages?.rows ?? []), ...outcome.sessions], nextCursor: outcome.nextCursor }, request: IDLE };
}

function useOlderPages(lotId: string, status: SessionListStatus, firstCursor: string | null): UsedOlderPages {
  const [state, setState] = useState<OlderState>({ pages: null, request: IDLE });
  const { pages, request } = state;
  if (pages !== null && pages.status !== status) {
    setState({ pages: null, request });
  }
  const cursor = pages === null ? firstCursor : pages.nextCursor;
  const load = () => {
    if (cursor === null || request.isLoading) {
      return;
    }
    setState({ pages, request: { isLoading: true, failure: null } });
    void readOlderPage(lotId, { status, before: cursor }).then((outcome) => setState(stateAfter(outcome, status, pages)));
  };
  return { rows: pages?.rows ?? [], older: { hasMore: cursor !== null, ...request, load } };
}
