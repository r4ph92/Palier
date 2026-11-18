import type { DashboardStaleSession, DashboardStaleSessions } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { followUpRefusal, type Refusal, type RefusalFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useFocusAfterRender } from '../lotMap/useFocusAfterRender.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { presenceButtonId, PRESENCE_STATUS_ID } from './staleSessionIds.ts';

// After these refusals the flagged list on the page is out of date: it is read again before the operator retries.
const LIST_OUT_OF_DATE: readonly DisplayedErrorCode[] = ['LOT_BUSY', 'SESSION_NOT_FOUND'];

export interface RowRefusal extends Refusal {
  readonly sessionId: string;
  readonly plate: string;
}

interface ConfirmationStatus {
  // The session being confirmed; its row shows the busy state and no other row accepts a click meanwhile.
  readonly confirmingId: string | null;
  // Its plate, for the status line while the request runs.
  readonly confirmingPlate: string | null;
  readonly refusal: RowRefusal | null;
  // The plate confirmed last, for the status line; any later click forgets it.
  readonly confirmedPlate: string | null;
}

export interface PresenceConfirmation extends ConfirmationStatus {
  readonly sessions: readonly DashboardStaleSession[];
  // A refusal whose row the reloaded list no longer has, such as a session that left meanwhile: the page says it in the status line instead.
  readonly listRefusal: Refusal | null;
  readonly confirm: (session: DashboardStaleSession) => Promise<void>;
}

type ConfirmOutcome = { readonly answer: DashboardStaleSessions } | { readonly refusal: Refusal };

const IDLE: ConfirmationStatus = { confirmingId: null, confirmingPlate: null, refusal: null, confirmedPlate: null };

async function attemptConfirm(lotId: string, session: DashboardStaleSession, followUps: RefusalFollowUps): Promise<ConfirmOutcome> {
  try {
    return { answer: await dashboardClient.confirmPresence(lotId, session.id) };
  } catch (failure) {
    return { refusal: await followUpRefusal(failure, followUps) };
  }
}

// Focus stays in the list the API answered: on the row now at the confirmed one's place, or the last row, or the status line once the list is empty.
function focusIdAfterConfirming(shown: readonly DashboardStaleSession[], remaining: readonly DashboardStaleSession[], confirmed: DashboardStaleSession): string {
  const confirmedIndex = shown.findIndex(({ id }) => id === confirmed.id);
  const neighbour = remaining[Math.min(confirmedIndex, remaining.length - 1)];
  return neighbour === undefined ? PRESENCE_STATUS_ID : presenceButtonId(neighbour.id);
}

// The row is gone, so the sentence names the vehicle it was about.
function listRefusalOf(refusal: RowRefusal | null, sessions: readonly DashboardStaleSession[]): Refusal | null {
  if (refusal === null || sessions.some(({ id }) => id === refusal.sessionId)) {
    return null;
  }
  if (refusal.code !== 'SESSION_NOT_FOUND') {
    return refusal;
  }
  return { code: 'STALE_SESSION_GONE', values: { ...refusal.values, plate: refusal.plate } };
}

// The list shows only what the API answered: a confirmed session leaves it, a refused one stays with the reason beside its row.
export function usePresenceConfirmation(lotId: string, initial: DashboardStaleSessions): PresenceConfirmation {
  const request = useGuardedRequest();
  const list = useFlaggedList(initial.sessions);
  const [status, setStatus] = useState<ConfirmationStatus>(IDLE);
  const followUps = useRefusalFollowUps(lotId, list.show);
  const confirm = (session: DashboardStaleSession) =>
    request.run(async () => {
      setStatus({ ...IDLE, confirmingId: session.id, confirmingPlate: session.plate });
      const outcome = await attemptConfirm(lotId, session, followUps);
      if ('refusal' in outcome) {
        setStatus({ ...IDLE, refusal: { ...outcome.refusal, sessionId: session.id, plate: session.plate } });
        return;
      }
      list.showAfterConfirming(outcome.answer.sessions, session);
      setStatus({ ...IDLE, confirmedPlate: session.plate });
    });
  return { ...status, sessions: list.sessions, listRefusal: listRefusalOf(status.refusal, list.sessions), confirm };
}

function useFlaggedList(initial: readonly DashboardStaleSession[]) {
  const focusAfterRender = useFocusAfterRender();
  const [sessions, setSessions] = useState(initial);
  const showAfterConfirming = (remaining: readonly DashboardStaleSession[], confirmed: DashboardStaleSession) => {
    focusAfterRender(focusIdAfterConfirming(sessions, remaining, confirmed));
    setSessions(remaining);
  };
  return { sessions, show: setSessions, showAfterConfirming };
}

function useRefusalFollowUps(lotId: string, show: (sessions: readonly DashboardStaleSession[]) => void): RefusalFollowUps {
  const refreshSession = useSessionRefresh();
  const reloadList = async (): Promise<boolean> => {
    try {
      show((await dashboardClient.staleSessions(lotId)).sessions);
      return true;
    } catch {
      return false;
    }
  };
  const refreshOn = (code: DisplayedErrorCode) => (LIST_OUT_OF_DATE.includes(code) ? reloadList() : null);
  return { refreshSession, refreshOn, reloadFailedCode: 'SPOT_RELOAD_FAILED' };
}
