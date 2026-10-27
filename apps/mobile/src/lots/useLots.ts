import { useCallback, useEffect, useReducer } from 'react';
import type { LotsClient } from '../api/LotsClient';
import { initialLotsModel, lotsReducer, type LotsState } from './lotsReducer';

export type { LotsState } from './lotsReducer';

export interface LotsController {
  readonly state: LotsState;
  readonly isRefreshing: boolean;
  refresh(): void;
  retry(): void;
}

export function useLots(client: LotsClient): LotsController {
  const [model, dispatch] = useReducer(lotsReducer, initialLotsModel);

  useEffect(() => {
    let isLatestRequest = true;
    void fetchLotsState(client).then((state) => {
      if (isLatestRequest) {
        dispatch({ type: 'settled', state });
      }
    });
    return () => {
      isLatestRequest = false;
    };
  }, [client, model.requestNumber]);

  const refresh = useCallback(() => dispatch({ type: 'refreshRequested' }), []);
  const retry = useCallback(() => dispatch({ type: 'retryRequested' }), []);
  return { state: model.state, isRefreshing: model.isRefreshing, refresh, retry };
}

async function fetchLotsState(client: LotsClient): Promise<LotsState> {
  try {
    const lots = await client.listLots();
    return { status: 'loaded', lots, updatedAt: new Date() };
  } catch {
    return { status: 'error' };
  }
}
