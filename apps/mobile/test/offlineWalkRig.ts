import { AppState, type AppStateStatus } from 'react-native';
import { SimulatedConnectivity } from '../src/dev/SimulatedConnectivity';
import { OfflineWalkQueue } from '../src/parkingSessions/OfflineWalkQueue';
import { OfflineWalkSender } from '../src/parkingSessions/OfflineWalkSender';
import type { QueuedWalk } from '../src/parkingSessions/OfflineWalkStore';
import { MemoryOfflineWalkStore } from './fakeOfflineWalkStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { positioningRig } from './positioningRig';

export const AT_18_05 = new Date(2026, 10, 4, 18, 5).getTime();
export const julieWalk: QueuedWalk = { sessionId: 'session-1', detectedAt: AT_18_05, aisleMinor: 1 };

const runningSenders: (() => void)[] = [];

// Each test's sender retries every 10 s while a walk waits: stop them all in afterEach.
export function stopOfflineWalkRigs(): void {
  runningSenders.splice(0).forEach((stop) => stop());
}

// A sender over fakes, started, with the app's return to the front at hand.
export function offlineWalkRig(walks: readonly QueuedWalk[] = []) {
  const appStateListeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  const store = new MemoryOfflineWalkStore(walks);
  const client = new FakeParkingSessionClient(julieAtParkingDemo());
  const connectivity = new SimulatedConnectivity();
  const positioning = positioningRig();
  const sender = new OfflineWalkSender({ client, queue: new OfflineWalkQueue(store), connectivity, positioning: positioning.core });
  const stop = sender.start();
  runningSenders.push(stop);
  const replayed: QueuedWalk[] = [];
  sender.subscribe({ onReplayed: (walk) => replayed.push(walk) });
  const comeToFront = () => appStateListeners.forEach((listener) => listener('active'));
  return { sender, stop, store, client, connectivity, commands: positioning.commands, replayed, comeToFront };
}
