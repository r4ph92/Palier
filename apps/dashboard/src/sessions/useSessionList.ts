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

interface LoadedOlderPage {
  readonly firstSessionId: string;
  readonly count: number;
}

interface OlderPages {
  readonly rows: readonly DashboardSessionRow[];
  readonly nextCursor: string | null;
  readonly lastLoad: LoadedOlderPage | null;
}

export interface OlderSessions {
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly failure: DisplayedErrorCode | null;
  readonly lastLoad: LoadedOlderPage | null;
  readonly load: () => void;
}

export type SessionListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly error: DashboardApiError; readonly retry: () => void; readonly isRetrying: boolean }
  | { readonly kind: 'ready'; readonly lotName: string; readonly sessions: readonly DashboardSessionRow[]; readonly isSwitching: boolean; readonly older: OlderSessions };

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
const LOADING: OlderRequest = { isLoading: true, failure: null };

async function readOlderPage(lotId: string, request: SessionListRequest): Promise<DashboardSessionList | DisplayedErrorCode> {
  try {
    return await dashboardClient.sessions(lotId, request);
  } catch (error) {
    return asDashboardApiError(error).code;
  }
}

interface OlderState {
  readonly status: SessionListStatus;
  readonly pages: OlderPages | null;
  readonly request: OlderRequest;
}

function stateAfter(outcome: DashboardSessionList | DisplayedErrorCode, previous: OlderState): OlderState {
  if (typeof outcome === 'string') {
    return { ...previous, request: { isLoading: false, failure: outcome } };
  }
  const first = outcome.sessions[0];
  const lastLoad = first === undefined ? (previous.pages?.lastLoad ?? null) : { firstSessionId: first.id, count: outcome.sessions.length };
  const rows = [...(previous.pages?.rows ?? []), ...outcome.sessions];
  return { status: previous.status, pages: { rows, nextCursor: outcome.nextCursor, lastLoad }, request: IDLE };
}

function useOlderPages(lotId: string, status: SessionListStatus, firstCursor: string | null): UsedOlderPages {
  const [state, setState] = useState<OlderState>({ status, pages: null, request: IDLE });
  if (state.status !== status) {
    setState({ status, pages: null, request: IDLE });
  }
  const { pages, request } = state;
  const cursor = pages === null ? firstCursor : pages.nextCursor;
  const load = () => {
    if (cursor === null || request.isLoading) {
      return;
    }
    setState({ ...state, request: LOADING });
    void readOlderPage(lotId, { status, before: cursor }).then((outcome) => setState((previous) => (previous.status === status ? stateAfter(outcome, previous) : previous)));
  };
  return { rows: pages?.rows ?? [], older: { hasMore: cursor !== null, ...request, lastLoad: pages?.lastLoad ?? null, load } };
}
