import { act, renderHook } from '@testing-library/react-native';
import { PalierRejectedError } from '../src/api/VehicleClient';
import type { SpotHoldClient } from '../src/api/SpotHoldClient';
import { useSpotHold } from '../src/spotHolds/useSpotHold';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';

async function renderHolding(client: SpotHoldClient) {
  const rendered = await renderHook(() => useSpotHold(client));
  await act(async () => undefined);
  return rendered;
}

const HELD_SPOT_TARGET = { kind: 'heldSpot' };

function callbacks() {
  return { onReleased: jest.fn(), onGone: jest.fn() };
}

describe('useSpotHold release', () => {
  it('clears the hold and calls back once when the release goes through', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const release = callbacks();
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(release));

    expect(client.releasedIds).toEqual(['hold-1']);
    expect(result.current.held).toBeNull();
    expect(release.onReleased).toHaveBeenCalledTimes(1);
    expect(result.current.isReleasing).toBe(false);
  });

  it('sends one request for a double tap', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.releasesAnswer = true;
    const release = callbacks();
    const { result } = await renderHolding(client);

    await act(async () => {
      result.current.release(release);
      result.current.release(release);
    });
    expect(result.current.isReleasing).toBe(true);
    await act(async () => client.answer());

    expect(client.releasedIds).toEqual(['hold-1']);
    expect(release.onReleased).toHaveBeenCalledTimes(1);
    expect(result.current.isReleasing).toBe(false);
  });

  it('sends nothing when there is no hold to release', async () => {
    const client = new FakeSpotHoldClient();
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(callbacks()));

    expect(client.releasedIds).toHaveLength(0);
  });

  it('keeps the hold and shows an expired guarantee under the banner', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.nextRejection = 'HOLD_EXPIRED';
    const release = callbacks();
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(release));

    expect(result.current.held?.spotHold.spotHoldId).toBe('hold-1');
    expect(result.current.failure).toEqual({ target: HELD_SPOT_TARGET, reason: { kind: 'refused', refusal: 'HOLD_EXPIRED' }, isFresh: true });
    expect(release.onReleased).not.toHaveBeenCalled();
  });

  it('reads the hold again, with no message, when it was already released elsewhere', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    client.activeHold = null;
    client.nextRejection = 'HOLD_NOT_FOUND';
    const release = callbacks();

    await act(async () => result.current.release(release));

    expect(result.current.held).toBeNull();
    expect(result.current.failure).toBeNull();
    expect(client.currentRequests).toBe(2);
    expect(release.onGone).toHaveBeenCalledTimes(1);
    expect(release.onReleased).not.toHaveBeenCalled();
  });

  it('says the guarantee no longer exists when it was released elsewhere and the hold cannot be read again', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    client.nextFailure = new PalierRejectedError('HOLD_NOT_FOUND');
    client.isReachable = false;
    const release = callbacks();

    await act(async () => result.current.release(release));

    expect(result.current.failure).toEqual({ target: HELD_SPOT_TARGET, reason: { kind: 'refused', refusal: 'HOLD_NOT_FOUND' }, isFresh: true });
    expect(release.onGone).not.toHaveBeenCalled();
  });

  it('keeps the hold and reports a busy lot as HOLD_UNAVAILABLE under the banner', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.nextRejection = 'HOLD_UNAVAILABLE';
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(callbacks()));

    expect(result.current.failure).toMatchObject({ target: HELD_SPOT_TARGET, reason: { kind: 'refused', refusal: 'HOLD_UNAVAILABLE' } });
    expect(result.current.held).not.toBeNull();
  });

  it('says Palier is unreachable without network, then clears it on the next try', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    client.isReachable = false;
    await act(async () => result.current.release(callbacks()));
    expect(result.current.failure?.reason).toEqual({ kind: 'unreachable' });
    client.isReachable = true;

    await act(async () => result.current.release(callbacks()));

    expect(result.current.failure).toBeNull();
    expect(result.current.held).toBeNull();
  });

  it('ignores a read that started before the release and answers with the old hold', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    let answerRead: (value: ReturnType<typeof julieHoldAtParkingDemo> | null) => void = () => undefined;
    client.current = () => new Promise((resolve) => (answerRead = resolve));
    await act(async () => result.current.refreshHold());

    await act(async () => result.current.release(callbacks()));
    await act(async () => answerRead(julieHoldAtParkingDemo()));

    expect(result.current.held).toBeNull();
  });
});
