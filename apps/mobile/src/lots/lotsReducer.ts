import type { LotSummary } from '@palier/shared-types';

export type LotsState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly lots: readonly LotSummary[]; readonly updatedAt: Date }
  | { readonly status: 'error' };

export interface LotsModel {
  readonly state: LotsState;
  readonly isRefreshing: boolean;
  readonly requestNumber: number;
}

export type LotsAction =
  | { readonly type: 'refreshRequested' }
  | { readonly type: 'retryRequested' }
  | { readonly type: 'settled'; readonly state: LotsState };

export const initialLotsModel: LotsModel = { state: { status: 'loading' }, isRefreshing: false, requestNumber: 0 };

export function lotsReducer(model: LotsModel, action: LotsAction): LotsModel {
  switch (action.type) {
    case 'refreshRequested':
      return { ...model, isRefreshing: true, requestNumber: model.requestNumber + 1 };
    case 'retryRequested':
      return { ...model, state: { status: 'loading' }, requestNumber: model.requestNumber + 1 };
    case 'settled':
      return { ...model, state: action.state, isRefreshing: false };
  }
}
