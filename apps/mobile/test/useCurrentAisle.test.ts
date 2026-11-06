import type { CurrentParkingSession } from '@palier/shared-types';
import { act, renderHook } from '@testing-library/react-native';
import { useCurrentAisle } from '../src/positioning/useCurrentAisle';
import { julieAtB3 } from './fakeParkingSessionClient';
import { positioningRig } from './positioningRig';

async function followAisles(session: CurrentParkingSession | null) {
  const rig = positioningRig();
  const hook = await renderHook(({ current }: { readonly current: CurrentParkingSession | null }) => useCurrentAisle(rig.core, current), { initialProps: { current: session } });
  const enterAisle = (minor: number) => act(async () => rig.simulator.enterAisle(minor));
  return { ...hook, enterAisle, aisleCode: () => hook.result.current?.code ?? null };
}

describe('useCurrentAisle', () => {
  it('knows no aisle before the first signal', async () => {
    expect((await followAisles(julieAtB3())).aisleCode()).toBeNull();
  });

  it('follows the aisle of the last minor received', async () => {
    const { enterAisle, aisleCode } = await followAisles(julieAtB3());

    await enterAisle(1);
    expect(aisleCode()).toBe('A');
    await enterAisle(2);
    expect(aisleCode()).toBe('B');
  });

  it.each([9, 0])('ignores minor %d, which matches no aisle of the plan', async (minor) => {
    const { enterAisle, aisleCode } = await followAisles(julieAtB3());

    await enterAisle(minor);
    expect(aisleCode()).toBeNull();
    await enterAisle(1);
    await enterAisle(minor);
    expect(aisleCode()).toBe('A');
  });

  it('keeps the aisle across a new read of the same session', async () => {
    const { enterAisle, aisleCode, rerender } = await followAisles(julieAtB3());
    await enterAisle(1);

    await rerender({ current: julieAtB3({ elapsedMinutes: 196 }) });

    expect(aisleCode()).toBe('A');
  });

  it('forgets the aisle when another session starts', async () => {
    const { enterAisle, aisleCode, rerender } = await followAisles(julieAtB3());
    await enterAisle(1);

    await rerender({ current: julieAtB3({ sessionId: 'session-2' }) });

    expect(aisleCode()).toBeNull();
  });

  it('drops a signal received without a session', async () => {
    const { enterAisle, aisleCode, rerender } = await followAisles(null);

    await enterAisle(1);
    await rerender({ current: julieAtB3() });

    expect(aisleCode()).toBeNull();
  });

  it('matches nothing when the session has no plan', async () => {
    const { enterAisle, aisleCode } = await followAisles(julieAtB3({ levelPlan: null }));

    await enterAisle(1);

    expect(aisleCode()).toBeNull();
  });
});
