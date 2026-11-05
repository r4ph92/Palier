import { initialLotsModel, lotsReducer, type LotsModel } from '../src/lots/lotsReducer';

const loadedModel = lotsReducer(initialLotsModel, {
  type: 'settled',
  state: { status: 'loaded', lots: [], location: { status: 'denied' }, updatedAt: new Date() },
});

function pollingModel(): LotsModel {
  return lotsReducer(loadedModel, { type: 'pollRequested' });
}

describe('lotsReducer', () => {
  it('counts the first read as in flight', () => {
    expect(initialLotsModel).toMatchObject({ isReading: true, hasSettled: false });
  });

  it('keeps the current list visible while refreshing', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(refreshing).toMatchObject({ state: loadedModel.state, isRefreshing: true, isReading: true, requestNumber: 1, readKind: 'full' });
  });

  it('ignores a refresh while another one is in flight', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(lotsReducer(refreshing, { type: 'refreshRequested' })).toBe(refreshing);
  });

  it('goes back to loading on retry', () => {
    const errorModel = lotsReducer(initialLotsModel, { type: 'settled', state: { status: 'error' } });

    expect(lotsReducer(errorModel, { type: 'retryRequested' })).toMatchObject({ state: { status: 'loading' }, readKind: 'full' });
  });

  it('ends the refresh when the request settles', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    const settled = lotsReducer(refreshing, { type: 'settled', state: { status: 'error' } });

    expect(settled).toMatchObject({ state: { status: 'error' }, isRefreshing: false, isReading: false, hasSettled: true, requestNumber: 1 });
  });
});

describe('lotsReducer polling', () => {
  it('starts a poll that reuses the position and shows no spinner', () => {
    expect(pollingModel()).toMatchObject({ isReading: true, isRefreshing: false, readKind: 'poll', requestNumber: 1 });
  });

  it('skips a poll while a read is in flight', () => {
    expect(lotsReducer(initialLotsModel, { type: 'pollRequested' })).toBe(initialLotsModel);
    const polling = pollingModel();

    expect(lotsReducer(polling, { type: 'pollRequested' })).toBe(polling);
  });

  it('keeps the last list when a poll is missed', () => {
    const missed = lotsReducer(pollingModel(), { type: 'pollMissed' });

    expect(missed).toMatchObject({ state: loadedModel.state, isReading: false });
  });

  it('lets a pull to refresh start while a poll is in flight', () => {
    expect(lotsReducer(pollingModel(), { type: 'refreshRequested' })).toMatchObject({ isRefreshing: true, readKind: 'full', requestNumber: 2 });
  });
});
