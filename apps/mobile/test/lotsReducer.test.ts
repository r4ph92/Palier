import type { DriverLocation } from '../src/deviceLocation/locateDriver';
import { initialLotsModel, lotsReducer, type LotsModel } from '../src/lots/lotsReducer';

const DENIED: DriverLocation = { status: 'denied' };
const loadedModel = lotsReducer(initialLotsModel, {
  type: 'loaded',
  state: { status: 'loaded', lots: [], location: DENIED, updatedAt: new Date() },
});

function pollingModel(): LotsModel {
  return lotsReducer(loadedModel, { type: 'pollRequested' });
}

describe('lotsReducer', () => {
  it('starts with the first read in flight, asking the device for its position', () => {
    expect(initialLotsModel).toMatchObject({ inFlight: 'first', request: { number: 0, knownLocation: null } });
  });

  it('keeps the current list visible while refreshing and asks for the position again', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(refreshing).toEqual({ state: loadedModel.state, inFlight: 'refresh', request: { number: 1, knownLocation: null } });
  });

  it('ignores a refresh while another one is in flight', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(lotsReducer(refreshing, { type: 'refreshRequested' })).toBe(refreshing);
  });

  it('goes back to loading on retry', () => {
    const errorModel = lotsReducer(initialLotsModel, { type: 'unreachable' });

    expect(lotsReducer(errorModel, { type: 'retryRequested' })).toEqual({ state: { status: 'loading' }, inFlight: 'retry', request: { number: 1, knownLocation: null } });
  });

  it('shows the error when a refresh misses', () => {
    const refreshing = lotsReducer(loadedModel, { type: 'refreshRequested' });

    expect(lotsReducer(refreshing, { type: 'unreachable' })).toMatchObject({ state: { status: 'error' }, inFlight: 'none' });
  });
});

describe('lotsReducer polling', () => {
  it('starts a poll that reuses the position on screen', () => {
    expect(pollingModel()).toEqual({ state: loadedModel.state, inFlight: 'poll', request: { number: 1, knownLocation: DENIED } });
  });

  it('asks the device again when a poll follows an error', () => {
    const errorModel = lotsReducer(initialLotsModel, { type: 'unreachable' });

    expect(lotsReducer(errorModel, { type: 'pollRequested' }).request.knownLocation).toBeNull();
  });

  it.each(['first', 'refresh', 'retry', 'poll'] as const)('skips a poll while the %s read is in flight', (inFlight) => {
    const busy: LotsModel = { ...loadedModel, inFlight };

    expect(lotsReducer(busy, { type: 'pollRequested' })).toBe(busy);
  });

  it('keeps the last list when a poll misses', () => {
    expect(lotsReducer(pollingModel(), { type: 'unreachable' })).toEqual({ ...pollingModel(), inFlight: 'none' });
  });

  it('lets a pull to refresh start while a poll is in flight', () => {
    expect(lotsReducer(pollingModel(), { type: 'refreshRequested' })).toMatchObject({ inFlight: 'refresh', request: { number: 2, knownLocation: null } });
  });
});
