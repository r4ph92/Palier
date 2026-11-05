import { useCallback, useEffect, useReducer, useState, type ActionDispatch } from 'react';
import type { LotsClient } from '../api/LotsClient';
import type { DeviceLocationClient } from '../deviceLocation/DeviceLocationClient';
import { initialLotsModel, lotsReducer, type LotsAction, type LotsRequest, type LotsState } from './lotsReducer';
import { readLots, type LotSources } from './readLots';

export type { LotsState } from './lotsReducer';

export const LOTS_REFRESH_MILLISECONDS = 30_000;

export interface LotsController {
  readonly state: LotsState;
  readonly isRefreshing: boolean;
  refresh(): void;
  retry(): void;
}

type LotsDispatch = ActionDispatch<[action: LotsAction]>;

export function useLots(client: LotsClient, locationClient: DeviceLocationClient): LotsController {
  const [model, dispatch] = useReducer(lotsReducer, initialLotsModel);
  useLotsReads({ client, locationClient }, model.request, dispatch);
  useLotsPolling(model.state.status !== 'loading', dispatch);
  const refresh = useCallback(() => dispatch({ type: 'refreshRequested' }), []);
  const retry = useCallback(() => dispatch({ type: 'retryRequested' }), []);
  return { state: model.state, isRefreshing: model.inFlight === 'refresh', refresh, retry };
}

function useLotsReads({ client, locationClient }: LotSources, request: LotsRequest, dispatch: LotsDispatch): void {
  // An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
  const [, rethrowDuringRender] = useState<never>();
  useEffect(() => {
    let isLatestRequest = true;
    readLots({ client, locationClient }, request.knownLocation).then(
      (action) => isLatestRequest && dispatch(action),
      (error: unknown) =>
        rethrowDuringRender(() => {
          throw error;
        }),
    );
    return () => {
      isLatestRequest = false;
    };
  }, [client, locationClient, dispatch, request]);
}

// Counts from the moment a list or an error is on screen; a read still waiting on the permission prompt starts no timer.
function useLotsPolling(isShowingAnswer: boolean, dispatch: LotsDispatch): void {
  useEffect(() => {
    if (!isShowingAnswer) {
      return undefined;
    }
    const timer = setInterval(() => dispatch({ type: 'pollRequested' }), LOTS_REFRESH_MILLISECONDS);
    return () => clearInterval(timer);
  }, [isShowingAnswer, dispatch]);
}
