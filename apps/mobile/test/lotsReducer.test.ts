import { initialLotsModel, lotsReducer } from '../src/lots/lotsReducer';

const loadedModel = lotsReducer(initialLotsModel, { type: 'settled', state: { status: 'loaded', lots: [], updatedAt: new Date() } });

describe('lotsReducer', () => {
  it('keeps the current list visible while refreshing', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(refreshing).toEqual({ state: loadedModel.state, isRefreshing: true, requestNumber: 1 });
  });

  it('ignores a refresh while another one is in flight', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(lotsReducer(refreshing, { type: 'refreshRequested' })).toBe(refreshing);
  });

  it('goes back to loading on retry', () => {
    const errorModel = lotsReducer(initialLotsModel, { type: 'settled', state: { status: 'error' } });

    expect(lotsReducer(errorModel, { type: 'retryRequested' }).state).toEqual({ status: 'loading' });
  });

  it('ends the refresh when the request settles', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    const settled = lotsReducer(refreshing, { type: 'settled', state: { status: 'error' } });

    expect(settled).toEqual({ state: { status: 'error' }, isRefreshing: false, requestNumber: 1 });
  });
});
