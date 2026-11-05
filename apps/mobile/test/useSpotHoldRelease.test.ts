import { act, renderHook } from '@testing-library/react-native';
import { PalierStatusError } from '../src/api/LotsClient';
import type { SpotHoldClient } from '../src/api/SpotHoldClient';
import { BANNER_TARGET } from '../src/spotHolds/spotHoldFailure';
import { useSpotHold } from '../src/spotHolds/useSpotHold';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';

async function renderHolding(client: SpotHoldClient) {
  const rendered = await renderHook(() => useSpotHold(client));
  await act(async () => undefined);
  return rendered;
}

describe('useSpotHold release', () => {
  it('clears the hold and calls back once when the release goes through', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const onReleased = jest.fn();
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(onReleased));

    expect(client.releasedIds).toEqual(['hold-1']);
    expect(result.current.held).toBeNull();
    expect(onReleased).toHaveBeenCalledTimes(1);
    expect(result.current.isReleasing).toBe(false);
  });

  it('sends one request for a double tap', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.releasesAnswer = true;
    const onReleased = jest.fn();
    const { result } = await renderHolding(client);

    await act(async () => {
      result.current.release(onReleased);
      result.current.release(onReleased);
    });
    expect(result.current.isReleasing).toBe(true);
    await act(async () => client.answer());

    expect(client.releasedIds).toEqual(['hold-1']);
    expect(onReleased).toHaveBeenCalledTimes(1);
    expect(result.current.isReleasing).toBe(false);
  });

  it('sends nothing when there is no hold to release', async () => {
    const client = new FakeSpotHoldClient();
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(jest.fn()));

    expect(client.releasedIds).toEqual([]);
  });

  it('keeps the hold and shows an expired guarantee under the banner', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.nextRejection = 'HOLD_EXPIRED';
    const onReleased = jest.fn();
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(onReleased));

    expect(result.current.held?.spotHold.spotHoldId).toBe('hold-1');
    expect(result.current.failure).toEqual({ target: BANNER_TARGET, reason: { kind: 'refused', refusal: 'HOLD_EXPIRED' }, isFresh: true });
    expect(onReleased).not.toHaveBeenCalled();
  });

  it('reads the hold again, with no message, when it was already released elsewhere', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    client.activeHold = null;
    client.nextRejection = 'HOLD_NOT_FOUND';

    await act(async () => result.current.release(jest.fn()));

    expect(result.current.held).toBeNull();
    expect(result.current.failure).toBeNull();
    expect(client.currentRequests).toBe(2);
  });

  it('says Palier is not responding on an HTTP 503 and keeps the hold', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.nextFailure = new PalierStatusError(503);
    const { result } = await renderHolding(client);

    await act(async () => result.current.release(jest.fn()));

    expect(result.current.failure).toMatchObject({ target: BANNER_TARGET, reason: { kind: 'notResponding' } });
    expect(result.current.held).not.toBeNull();
  });

  it('says Palier is unreachable without network, then clears it on the next try', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    client.isReachable = false;
    await act(async () => result.current.release(jest.fn()));
    expect(result.current.failure?.reason).toEqual({ kind: 'unreachable' });
    client.isReachable = true;

    await act(async () => result.current.release(jest.fn()));

    expect(result.current.failure).toBeNull();
    expect(result.current.held).toBeNull();
  });

  it('ignores a read that started before the release and answers with the old hold', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { result } = await renderHolding(client);
    let answerRead: (value: ReturnType<typeof julieHoldAtParkingDemo> | null) => void = () => undefined;
    client.current = () => new Promise((resolve) => (answerRead = resolve));
    await act(async () => result.current.refreshHold());

    await act(async () => result.current.release(jest.fn()));
    await act(async () => answerRead(julieHoldAtParkingDemo()));

    expect(result.current.held).toBeNull();
  });
});
