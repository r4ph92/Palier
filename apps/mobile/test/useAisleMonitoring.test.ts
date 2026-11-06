import type { CurrentParkingSession } from '@palier/shared-types';
import { renderHook } from '@testing-library/react-native';
import { useAisleMonitoring } from '../src/positioning/useAisleMonitoring';
import { julieAtB3 } from './fakeParkingSessionClient';
import { positioningRig } from './positioningRig';

const START_MAJOR_1 = 'startMonitoring uuid=B9407F30 major=1';

async function monitor(session: CurrentParkingSession | null) {
  const rig = positioningRig();
  const hook = await renderHook(({ current }: { readonly current: CurrentParkingSession | null }) => useAisleMonitoring(rig.core, current), { initialProps: { current: session } });
  return { ...rig, ...hook };
}

describe('useAisleMonitoring', () => {
  it('starts monitoring the lot major once a session is current', async () => {
    const { commands } = await monitor(julieAtB3());

    expect(commands()).toEqual([START_MAJOR_1]);
  });

  it('does not restart when a later read brings the same session', async () => {
    const { commands, rerender } = await monitor(julieAtB3());

    await rerender({ current: julieAtB3({ elapsedMinutes: 196, amountCents: 1050 }) });
    await rerender({ current: julieAtB3({ state: 'ENTRY_CONFIRMED' }) });

    expect(commands()).toEqual([START_MAJOR_1]);
  });

  it('stops once the session is gone', async () => {
    const { commands, rerender } = await monitor(julieAtB3());

    await rerender({ current: null });

    expect(commands()).toEqual([START_MAJOR_1, 'stopMonitoring']);
  });

  it('stops on sign-out, when the tabs unmount', async () => {
    const { commands, unmount } = await monitor(julieAtB3());

    await unmount();

    expect(commands()).toEqual([START_MAJOR_1, 'stopMonitoring']);
  });

  it('restarts for a new session', async () => {
    const { commands, rerender } = await monitor(julieAtB3());

    await rerender({ current: julieAtB3({ sessionId: 'session-2', beaconMajor: 3 }) });

    expect(commands()).toEqual([START_MAJOR_1, 'stopMonitoring', 'startMonitoring uuid=B9407F30 major=3']);
  });

  it('restarts for the next session at the same lot', async () => {
    const { commands, rerender } = await monitor(julieAtB3());

    await rerender({ current: julieAtB3({ sessionId: 'next-visit' }) });

    expect(commands()).toEqual([START_MAJOR_1, 'stopMonitoring', START_MAJOR_1]);
  });

  it('never monitors a lot without beacons, nor stops what it never started', async () => {
    const { commands, rerender, unmount } = await monitor(julieAtB3({ beaconMajor: null }));

    await rerender({ current: null });
    await unmount();

    expect(commands()).toEqual([]);
  });

  it('sends nothing without a session', async () => {
    const { commands, unmount } = await monitor(null);

    await unmount();

    expect(commands()).toEqual([]);
  });
});
