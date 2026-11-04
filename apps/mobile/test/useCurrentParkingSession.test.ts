import { act, renderHook } from '@testing-library/react-native';
import { useCurrentParkingSession } from '../src/parkingSessions/useCurrentParkingSession';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';

describe('useCurrentParkingSession', () => {
  it('reads once and announces the first session once, though each render passes a new inline callback', async () => {
    const client = new FakeParkingSessionClient(julieAtParkingDemo());
    const announcedDuringRender: number[] = [];
    const { rerender } = await renderHook(({ renderNumber }: { readonly renderNumber: number }) =>
      useCurrentParkingSession(client, () => {
        announcedDuringRender.push(renderNumber);
      }), { initialProps: { renderNumber: 0 } });

    await rerender({ renderNumber: 1 });
    await rerender({ renderNumber: 2 });
    await act(async () => undefined);

    expect(client.requests).toBe(1);
    expect(announcedDuringRender).toEqual([0]);
  });
});
