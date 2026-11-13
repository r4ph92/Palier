import type { DashboardLotMap, DashboardMapLevel } from '@palier/shared-types';
import { useRef, useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { asDashboardApiError, endsSession, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export type MoveDirection = 'up' | 'down';

export interface LevelMove {
  readonly levelId: string;
  readonly direction: MoveDirection;
}

export interface LevelOrderTarget {
  readonly lotId: string;
  readonly levels: readonly DashboardMapLevel[];
  readonly onSaved: (map: DashboardLotMap) => void;
  // The levels changed under the page: it reads the map again before the operator retries.
  readonly onStale: () => Promise<void>;
}

export interface LevelOrder {
  readonly saving: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly lastMove: LevelMove | null;
  readonly move: (move: LevelMove) => Promise<void>;
}

// The ids in their new order, with the moved level swapped with its neighbour.
function idsAfter(levels: readonly DashboardMapLevel[], { levelId, direction }: LevelMove): string[] {
  const ids = levels.map(({ id }) => id);
  const from = ids.indexOf(levelId);
  const to = direction === 'up' ? from - 1 : from + 1;
  [ids[from], ids[to]] = [ids[to] ?? levelId, levelId];
  return ids;
}

// The list shows the order the API answers, never a guess: a refused move leaves the levels where they were.
export function useLevelOrder({ lotId, levels, onSaved, onStale }: LevelOrderTarget): LevelOrder {
  const followUps = { refreshSession: useSessionRefresh(), onStale };
  const request = useGuardedRequest();
  const [lastMove, setLastMove] = useState<LevelMove | null>(null);
  const move = (levelMove: LevelMove) =>
    request.run(async () => {
      onSaved(await dashboardClient.reorderLevels(lotId, { levelIds: idsAfter(levels, levelMove) }));
      setLastMove(levelMove);
    }, (failure) => refusalOf(failure, followUps));
  return { saving: request.saving, error: request.error, lastMove, move };
}

// A ref, not state, guards the request: clicks in the same instant all see the state of the render before the first one.
function useGuardedRequest() {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const run = async (action: () => Promise<void>, refusal: (failure: unknown) => Promise<DisplayedErrorCode>) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSaving(true);
    const failure = await action().then(() => null, refusal);
    inFlight.current = false;
    setSaving(false);
    setError(failure);
  };
  return { saving, error, run };
}

interface RefusalFollowUps {
  readonly refreshSession: () => Promise<void>;
  readonly onStale: () => Promise<void>;
}

async function refusalOf(failure: unknown, { refreshSession, onStale }: RefusalFollowUps): Promise<DisplayedErrorCode> {
  const error = asDashboardApiError(failure);
  if (endsSession(error)) {
    void refreshSession();
  }
  if (error.code === 'LEVEL_ORDER_INVALID') {
    await onStale();
  }
  return error.code;
}
