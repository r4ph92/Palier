import { OfflineWalkQueue } from '../src/parkingSessions/OfflineWalkQueue';
import type { QueuedWalk } from '../src/parkingSessions/OfflineWalkStore';
import { MemoryOfflineWalkStore } from './fakeOfflineWalkStore';

const AT_18_05 = new Date(2026, 10, 4, 18, 5).getTime();
const firstWalk: QueuedWalk = { sessionId: 'session-1', detectedAt: AT_18_05, aisleMinor: 1 };

describe('the queue of walks Palier has not accepted yet', () => {
  it('keeps the earliest walk of a session, with the aisle seen then', async () => {
    const queue = new OfflineWalkQueue(new MemoryOfflineWalkStore());
    await queue.add({ ...firstWalk, detectedAt: AT_18_05 + 60_000, aisleMinor: 2 });

    await queue.add(firstWalk);

    await expect(queue.walks()).resolves.toEqual([firstWalk]);
  });

  it('ignores a later walk of a session already waiting', async () => {
    const queue = new OfflineWalkQueue(new MemoryOfflineWalkStore());
    await queue.add(firstWalk);

    await queue.add({ ...firstWalk, detectedAt: AT_18_05 + 60_000, aisleMinor: 2 });

    await expect(queue.walks()).resolves.toEqual([firstWalk]);
  });

  it('keeps one walk for each session', async () => {
    const queue = new OfflineWalkQueue(new MemoryOfflineWalkStore());
    await queue.add(firstWalk);

    await queue.add({ ...firstWalk, sessionId: 'session-2' });

    expect(queue.size).toBe(2);
    expect(queue.countFor('session-2')).toBe(1);
  });

  it('removes only the walk that was sent, not an earlier one merged in meanwhile', async () => {
    const queue = new OfflineWalkQueue(new MemoryOfflineWalkStore());
    const sent = { ...firstWalk, detectedAt: AT_18_05 + 60_000 };
    await queue.add(sent);
    await queue.add(firstWalk);

    const isRemoved = await queue.remove(sent);

    expect(isRemoved).toBe(false);
    await expect(queue.walks()).resolves.toEqual([firstWalk]);
  });

  it('saves every change to the store, and restores it in a new queue', async () => {
    const store = new MemoryOfflineWalkStore();
    await new OfflineWalkQueue(store).add(firstWalk);

    const restored = new OfflineWalkQueue(store);

    await expect(restored.holdsWalkFor('session-1')).resolves.toBe(true);
    expect(store.walks).toEqual([firstWalk]);
  });

  it('reads the store once, on first use rather than when built', async () => {
    const store = new MemoryOfflineWalkStore([firstWalk]);
    const queue = new OfflineWalkQueue(store);
    expect(store.loads).toBe(0);

    await Promise.all([queue.walks(), queue.holdsWalkFor('session-1'), queue.add({ ...firstWalk, sessionId: 'session-2' })]);

    expect(store.loads).toBe(1);
    expect(queue.size).toBe(2);
  });

  it('empties the store when cleared', async () => {
    const store = new MemoryOfflineWalkStore([firstWalk]);

    await new OfflineWalkQueue(store).clear();

    expect(store.walks).toEqual([]);
  });

  it('keeps the walk in memory and logs when the store cannot save it', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = new MemoryOfflineWalkStore();
    store.saveFailure = new Error('fake disk full');
    const queue = new OfflineWalkQueue(store);

    await queue.add(firstWalk);

    await expect(queue.walks()).resolves.toEqual([firstWalk]);
    expect(consoleError).toHaveBeenCalledWith('Saving the offline walks failed', store.saveFailure);
    consoleError.mockRestore();
  });

  it('starts empty and logs when the store cannot be read', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = new MemoryOfflineWalkStore();
    jest.spyOn(store, 'load').mockRejectedValue(new Error('fake read failure'));

    const walks = await new OfflineWalkQueue(store).walks();

    expect(walks).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith('Reading the offline walks failed', expect.any(Error));
    consoleError.mockRestore();
  });
});
