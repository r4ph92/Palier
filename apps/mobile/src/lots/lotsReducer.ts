import type { DriverLocation } from '../deviceLocation/locateDriver';
import type { NearbyLot } from './nearbyLots';

export type LotsState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly lots: readonly NearbyLot[]; readonly location: DriverLocation; readonly updatedAt: Date }
  | { readonly status: 'error' };

// full: the position is read again before the lots. poll: the 30 s refresh reuses the last position.
export type ReadKind = 'full' | 'poll';

// isReading covers the whole read, permission prompt included, so a poll never starts beside it.
export interface LotsModel {
  readonly state: LotsState;
  readonly isRefreshing: boolean;
  readonly isReading: boolean;
  readonly hasSettled: boolean;
  readonly requestNumber: number;
  readonly readKind: ReadKind;
}

export type LotsAction =
  | { readonly type: 'refreshRequested' }
  | { readonly type: 'retryRequested' }
  | { readonly type: 'pollRequested' }
  | { readonly type: 'settled'; readonly state: LotsState }
  | { readonly type: 'pollMissed' };

export const initialLotsModel: LotsModel = {
  state: { status: 'loading' },
  isRefreshing: false,
  isReading: true,
  hasSettled: false,
  requestNumber: 0,
  readKind: 'full',
};

export function lotsReducer(model: LotsModel, action: LotsAction): LotsModel {
  switch (action.type) {
    case 'refreshRequested':
      return model.isRefreshing ? model : nextRead({ ...model, isRefreshing: true }, 'full');
    case 'retryRequested':
      return nextRead({ ...model, state: { status: 'loading' } }, 'full');
    case 'pollRequested':
      return model.isReading ? model : nextRead(model, 'poll');
    case 'settled':
      return { ...model, state: action.state, isRefreshing: false, isReading: false, hasSettled: true };
    case 'pollMissed':
      return { ...model, isReading: false };
  }
}

function nextRead(model: LotsModel, readKind: ReadKind): LotsModel {
  return { ...model, isReading: true, readKind, requestNumber: model.requestNumber + 1 };
}
