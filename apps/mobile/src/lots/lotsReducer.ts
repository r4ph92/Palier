import type { DriverLocation } from '../deviceLocation/locateDriver';
import type { NearbyLot } from './nearbyLots';

export type LotsState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly lots: readonly NearbyLot[]; readonly location: DriverLocation; readonly updatedAt: Date }
  | { readonly status: 'error' };

// The read in flight, permission prompt included; 'none' once it settles.
export type ReadInFlight = 'none' | 'first' | 'refresh' | 'retry' | 'poll';

// knownLocation: the position a poll reuses; null asks the device again.
export interface LotsRequest {
  readonly number: number;
  readonly knownLocation: DriverLocation | null;
}

export interface LotsModel {
  readonly state: LotsState;
  readonly inFlight: ReadInFlight;
  readonly request: LotsRequest;
}

export type LotsAction =
  | { readonly type: 'refreshRequested' }
  | { readonly type: 'retryRequested' }
  | { readonly type: 'pollRequested' }
  | { readonly type: 'loaded'; readonly state: Extract<LotsState, { readonly status: 'loaded' }> }
  | { readonly type: 'unreachable' };

export const initialLotsModel: LotsModel = {
  state: { status: 'loading' },
  inFlight: 'first',
  request: { number: 0, knownLocation: null },
};

export function lotsReducer(model: LotsModel, action: LotsAction): LotsModel {
  switch (action.type) {
    case 'refreshRequested':
      return model.inFlight === 'refresh' ? model : nextRead(model, 'refresh');
    case 'retryRequested':
      return nextRead({ ...model, state: { status: 'loading' } }, 'retry');
    case 'pollRequested':
      return model.inFlight === 'none' ? nextRead(model, 'poll') : model;
    case 'loaded':
      return { ...model, state: action.state, inFlight: 'none' };
    case 'unreachable':
      return { ...model, state: model.inFlight === 'poll' ? model.state : { status: 'error' }, inFlight: 'none' };
  }
}

function nextRead(model: LotsModel, inFlight: ReadInFlight): LotsModel {
  const knownLocation = inFlight === 'poll' && model.state.status === 'loaded' ? model.state.location : null;
  return { ...model, inFlight, request: { number: model.request.number + 1, knownLocation } };
}
