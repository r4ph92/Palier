import { useCallback, useEffect, useReducer, useState } from 'react';
import { PalierUnreachableError, type LotsClient } from '../api/LotsClient';
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
  // An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
  const [, rethrowDuringRender] = useState<never>();

  useEffect(() => {
    let isLatestRequest = true;
    fetchLotsState(client).then(
      (state) => isLatestRequest && dispatch({ type: 'settled', state }),
      (error: unknown) =>
        rethrowDuringRender(() => {
          throw error;
        }),
    );
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
  } catch (error) {
    if (error instanceof PalierUnreachableError) {
      return { status: 'error' };
    }
    throw error;
  }
}
