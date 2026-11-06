import { memoryQueueStorage, ParkedSignalQueue, type PendingWalk, type QueueStorage } from '../src/parkingSessions/ParkedSignalQueue';

const walk: PendingWalk = { sessionId: 'session-1', detectedAt: 1000, aisleMinor: 1 };

describe('the queue of walks waiting for the network (story #26)', () => {
  it('keeps a walk with the instant it happened', async () => {
    const queue = new ParkedSignalQueue(memoryQueueStorage());

    await queue.add(walk);

    expect(queue.count).toBe(1);
    expect(queue.walkFor('session-1')).toEqual(walk);
  });

  it('keeps the first walk of a session when a second one arrives', async () => {
    const queue = new ParkedSignalQueue(memoryQueueStorage());
    await queue.add(walk);

    await queue.add({ ...walk, detectedAt: 2000 });

    expect(queue.count).toBe(1);
    expect(queue.walkFor('session-1')?.detectedAt).toBe(1000);
  });

  it('forgets a walk once removed', async () => {
    const queue = new ParkedSignalQueue(memoryQueueStorage());
    await queue.add(walk);

    await queue.remove('session-1');

    expect(queue.count).toBe(0);
  });

  it('gives a new queue over the same storage the walks kept before a relaunch', async () => {
    const storage = memoryQueueStorage();
    await new ParkedSignalQueue(storage).add({ ...walk, aisleMinor: null });

    const relaunched = new ParkedSignalQueue(storage);
    await relaunched.ready();

    expect(relaunched.walkFor('session-1')).toEqual({ ...walk, aisleMinor: null });
  });

  it('tells its listeners when a walk is added or removed', async () => {
    const queue = new ParkedSignalQueue(memoryQueueStorage());
    await queue.ready();
    const listener = jest.fn();
    queue.subscribe(listener);

    await queue.add(walk);
    await queue.remove('session-1');

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it.each([['not json'], ['{"sessionId":"x"}'], ['[{"sessionId":"x"}]']])('starts empty from saved data it cannot read (%s)', async (saved) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage: QueueStorage = { read: () => Promise.resolve(saved), write: () => Promise.resolve() };

    const queue = new ParkedSignalQueue(storage);
    await queue.ready();

    expect(queue.count).toBe(0);
  });

  it('keeps the walk in memory when the storage refuses to save it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage: QueueStorage = { read: () => Promise.resolve(null), write: () => Promise.reject(new Error('keychain locked')) };
    const queue = new ParkedSignalQueue(storage);

    await queue.add(walk);

    expect(queue.count).toBe(1);
  });

  it('forgets every walk when cleared, and the storage too', async () => {
    const storage = memoryQueueStorage();
    const queue = new ParkedSignalQueue(storage);
    await queue.add(walk);

    await queue.clear();

    expect(queue.count).toBe(0);
    const relaunched = new ParkedSignalQueue(storage);
    await relaunched.ready();
    expect(relaunched.count).toBe(0);
  });

  it('writes the newest snapshot last even when the storage is slow', async () => {
    let saved = '';
    const storage: QueueStorage = {
      read: () => Promise.resolve(null),
      write: (value) => new Promise((resolve) => setTimeout(() => resolve(void (saved = value)), value === '[]' ? 0 : 20)),
    };
    const queue = new ParkedSignalQueue(storage);

    await Promise.all([queue.add(walk), queue.add({ ...walk, sessionId: 'session-2' }).then(() => queue.remove('session-1'))]);

    expect(JSON.parse(saved)).toEqual([{ ...walk, sessionId: 'session-2' }]);
  });
});
