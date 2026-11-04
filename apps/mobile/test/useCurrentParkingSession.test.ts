import { act, renderHook } from '@testing-library/react-native';
import { useCurrentParkingSession } from '../src/parkingSessions/useCurrentParkingSession';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';

describe('useCurrentParkingSession', () => {
  it('reads once and announces the first session once, though each render passes a new inline callback', async () => {
    const client = new FakeParkingSessionClient(julieAtParkingDemo());
    let firstSessions = 0;
    const { rerender } = await renderHook(({ round }: { readonly round: number }) =>
      useCurrentParkingSession(client, () => {
        firstSessions += round >= 0 ? 1 : 0;
      }), { initialProps: { round: 0 } });

    await rerender({ round: 1 });
    await rerender({ round: 2 });
    await act(async () => undefined);

    expect(client.requests).toBe(1);
    expect(firstSessions).toBe(1);
  });
});
