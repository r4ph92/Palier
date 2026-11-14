import type { DashboardLotMap, DashboardMapLevel, LevelOrderRequest } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { followUpRefusal } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
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
  // The levels changed under the page: it reads the map again before the operator retries; false when that read failed.
  readonly onStale: () => Promise<boolean>;
}

export interface LevelOrder {
  readonly saving: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly lastMove: LevelMove | null;
  readonly move: (move: LevelMove) => Promise<void>;
}

const STEP: Readonly<Record<MoveDirection, number>> = { up: -1, down: 1 };

// The list shows the order the API answers, never a guess: a refused move leaves the levels where they were.
export function useLevelOrder(target: LevelOrderTarget): LevelOrder {
  const request = useGuardedRequest();
  const [lastMove, setLastMove] = useState<LevelMove | null>(null);
  const { error, save } = useOrderSaver(target, setLastMove);
  const move = async (levelMove: LevelMove) => {
    const order = orderAfter(target.levels, levelMove);
    if (order === null) {
      return;
    }
    await request.run(() => save(order, levelMove));
  };
  return { saving: request.busy, error, lastMove, move };
}

function useOrderSaver({ lotId, onSaved, onStale }: LevelOrderTarget, onMoved: (move: LevelMove) => void) {
  const refreshSession = useSessionRefresh();
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const save = async (order: LevelOrderRequest, levelMove: LevelMove) => {
    try {
      onSaved(await dashboardClient.reorderLevels(lotId, order));
      onMoved(levelMove);
      setError(null);
    } catch (failure) {
      const refreshOn = (code: DisplayedErrorCode) => (code === 'LEVEL_ORDER_INVALID' ? onStale() : null);
      setError((await followUpRefusal(failure, { refreshSession, refreshOn, reloadFailedCode: 'MAP_RELOAD_FAILED' })).code);
    }
  };
  return { error, save };
}

// The level swapped with its neighbour; null for a level already at that end, which has nowhere to go.
function orderAfter(levels: readonly DashboardMapLevel[], { levelId, direction }: LevelMove): LevelOrderRequest | null {
  const fromLevelIds = levels.map(({ id }) => id);
  const levelIds = [...fromLevelIds];
  const from = levelIds.indexOf(levelId);
  const to = from + STEP[direction];
  const neighbour = levelIds[to];
  if (from < 0 || neighbour === undefined) {
    return null;
  }
  levelIds[from] = neighbour;
  levelIds[to] = levelId;
  return { levelIds, fromLevelIds };
}
