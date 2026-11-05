import { useCallback, useEffect, useReducer, useRef, useState, type ActionDispatch } from 'react';
import type { LotsClient } from '../api/LotsClient';
import type { DeviceLocationClient } from '../deviceLocation/DeviceLocationClient';
import type { DriverLocation } from '../deviceLocation/locateDriver';
import { initialLotsModel, lotsReducer, type LotsAction, type LotsModel, type LotsState } from './lotsReducer';
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
  const lastLocation = useRef<DriverLocation | null>(null);
  useLotsReads({ client, locationClient, lastLocation }, model, dispatch);
  useLotsPolling(model.hasSettled, dispatch);
  const refresh = useCallback(() => dispatch({ type: 'refreshRequested' }), []);
  const retry = useCallback(() => dispatch({ type: 'retryRequested' }), []);
  return { state: model.state, isRefreshing: model.isRefreshing, refresh, retry };
}

function useLotsReads({ client, locationClient, lastLocation }: LotSources, model: LotsModel, dispatch: LotsDispatch): void {
  // An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
  const [, rethrowDuringRender] = useState<never>();
  const { requestNumber, readKind } = model;
  useEffect(() => {
    let isLatestRequest = true;
    readLots({ client, locationClient, lastLocation }, readKind).then(
      (action) => isLatestRequest && dispatch(action),
      (error: unknown) =>
        rethrowDuringRender(() => {
          throw error;
        }),
    );
    return () => {
      isLatestRequest = false;
    };
  }, [client, locationClient, lastLocation, dispatch, requestNumber, readKind]);
}

// Starts once the first read settles, so a permission prompt left open never stacks polls behind it.
function useLotsPolling(hasSettled: boolean, dispatch: LotsDispatch): void {
  useEffect(() => {
    if (!hasSettled) {
      return undefined;
    }
    const timer = setInterval(() => dispatch({ type: 'pollRequested' }), LOTS_REFRESH_MILLISECONDS);
    return () => clearInterval(timer);
  }, [hasSettled, dispatch]);
}
