import { act, renderHook } from '@testing-library/react-native';
import type { SpotHold } from '@palier/shared-types';
import type { SpotHoldClient } from '../src/api/SpotHoldClient';
import { PalierStatusError } from '../src/api/LotsClient';
import { useSpotHold } from '../src/spotHolds/useSpotHold';
import { PARKING_DEMO_ID } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';

async function renderSpotHold(client: SpotHoldClient) {
  const rendered = await renderHook(() => useSpotHold(client));
  await act(async () => undefined);
  return rendered;
}

describe('useSpotHold', () => {
  it('sends one request for a double tap', async () => {
    const client = new FakeSpotHoldClient();
    client.holdsAnswer = true;
    const onHeld = jest.fn();
    const { result } = await renderSpotHold(client);

    await act(async () => {
      result.current.hold(PARKING_DEMO_ID, onHeld);
      result.current.hold(PARKING_DEMO_ID, onHeld);
    });
    expect(result.current.requestedLotId).toBe(PARKING_DEMO_ID);
    await act(async () => client.answer());

    expect(client.heldLots).toEqual([PARKING_DEMO_ID]);
    expect(onHeld).toHaveBeenCalledTimes(1);
    expect(result.current.held?.isFresh).toBe(true);
    expect(result.current.requestedLotId).toBeNull();
  });

  it('keeps the hold just taken when the launch read answers late with nothing', async () => {
    let answerLaunchRead: (spotHold: SpotHold | null) => void = () => undefined;
    const client: SpotHoldClient = {
      hold: () => Promise.resolve(julieHoldAtParkingDemo()),
      current: () => new Promise((resolve) => (answerLaunchRead = resolve)),
    };
    const { result } = await renderSpotHold(client);

    await act(async () => result.current.hold(PARKING_DEMO_ID, () => undefined));
    await act(async () => answerLaunchRead(null));

    expect(result.current.held?.spotHold.spotHoldId).toBe('hold-1');
    expect(result.current.held?.isFresh).toBe(true);
  });

  it('reads a hold already taken back when told one exists, without moving focus to it', async () => {
    const client = new FakeSpotHoldClient();
    const { result } = await renderSpotHold(client);
    client.activeHold = julieHoldAtParkingDemo();
    client.nextRejection = 'HOLD_ALREADY_EXISTS';
    const onHeld = jest.fn();

    await act(async () => result.current.hold(PARKING_DEMO_ID, onHeld));

    expect(result.current.failure).toEqual({ kind: 'refused', refusal: 'HOLD_ALREADY_EXISTS' });
    expect(result.current.held?.spotHold.lotName).toBe('Parking Démo');
    expect(result.current.held?.isFresh).toBe(false);
    expect(client.currentRequests).toBe(2);
    expect(onHeld).not.toHaveBeenCalled();
  });

  it.each([500, 503])('reads an HTTP %i answer as Palier not responding', async (status) => {
    const client = new FakeSpotHoldClient();
    client.nextFailure = new PalierStatusError(status);
    const { result } = await renderSpotHold(client);

    await act(async () => result.current.hold(PARKING_DEMO_ID, () => undefined));

    expect(result.current.failure).toEqual({ kind: 'notResponding' });
  });

  it('reads a code it does not know as Palier not responding', async () => {
    const client = new FakeSpotHoldClient();
    client.nextRejection = 'SOMETHING_NEW';
    const { result } = await renderSpotHold(client);

    await act(async () => result.current.hold(PARKING_DEMO_ID, () => undefined));

    expect(result.current.failure).toEqual({ kind: 'notResponding' });
  });

  it('says Palier is unreachable without network and clears it on the next try', async () => {
    const client = new FakeSpotHoldClient();
    const { result } = await renderSpotHold(client);
    client.isReachable = false;
    await act(async () => result.current.hold(PARKING_DEMO_ID, () => undefined));
    expect(result.current.failure).toEqual({ kind: 'unreachable' });

    client.isReachable = true;
    await act(async () => result.current.hold(PARKING_DEMO_ID, () => undefined));

    expect(result.current.failure).toBeNull();
    expect(result.current.held).not.toBeNull();
  });

  it('shows no hold and no problem when the launch read has no network', async () => {
    const client = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    client.isReachable = false;
    const { result } = await renderSpotHold(client);

    expect(result.current.held).toBeNull();
    expect(result.current.failure).toBeNull();
  });

  it('stops moving focus to a fresh hold once the banner has shown it', async () => {
    const client = new FakeSpotHoldClient();
    const { result } = await renderSpotHold(client);
    await act(async () => result.current.hold(PARKING_DEMO_ID, () => undefined));

    await act(async () => result.current.acknowledgeFreshHold());

    expect(result.current.held?.isFresh).toBe(false);
  });
});
