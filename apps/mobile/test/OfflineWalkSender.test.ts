import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { RETRY_MILLISECONDS } from '../src/parkingSessions/OfflineWalkSender';
import { julieAtParkingDemo, type FakeParkingSessionClient } from './fakeParkingSessionClient';
import { AT_18_05, julieWalk, offlineWalkRig, stopOfflineWalkRigs } from './offlineWalkRig';

const ONE_MINUTE = 60_000;

afterEach(stopOfflineWalkRigs);

async function untilReported(client: FakeParkingSessionClient, count: number): Promise<void> {
  while (client.parkedReports.length < count) {
    await Promise.resolve();
  }
}

describe('sending a walk as it happens', () => {
  it('sends it at once when the network is there, and keeps nothing', async () => {
    const { sender, client, store } = offlineWalkRig();

    await expect(sender.submit(julieWalk)).resolves.toBe('sent');

    expect(client.parkedReports).toEqual([julieWalk]);
    expect(store.walks).toEqual([]);
  });

  it('keeps it without sending while the network is cut', async () => {
    const { sender, client, connectivity, store } = offlineWalkRig();
    connectivity.set('offline');

    await expect(sender.submit(julieWalk)).resolves.toBe('queued');

    expect(client.parkedReports).toEqual([]);
    expect(store.walks).toEqual([julieWalk]);
    expect(sender.pendingFor('session-1')).toBe(1);
  });

  it.each([
    ['Palier cannot be reached', new PalierUnreachableError('offline')],
    ['the lot is busy (503)', new PalierStatusError(503)],
    ['the token was refused', new PalierUnauthorizedError()],
  ])('keeps it when %s', async (_case, failure) => {
    const { sender, client, store } = offlineWalkRig();
    client.parkedFailure = failure;

    await expect(sender.submit(julieWalk)).resolves.toBe('queued');

    expect(store.walks).toEqual([julieWalk]);
  });

  it('drops it when Palier refuses it', async () => {
    const { sender, client, store } = offlineWalkRig();
    client.parkedFailure = new PalierRejectedError('SESSION_CLOSED');

    await expect(sender.submit(julieWalk)).resolves.toBe('dropped');

    expect(store.walks).toEqual([]);
  });

  it('logs and drops a failure nobody expected', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sender, client, store } = offlineWalkRig();
    client.parkedFailure = new TypeError('boom');

    await expect(sender.submit(julieWalk)).resolves.toBe('dropped');

    expect(store.walks).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith('Reporting the walk away from the car failed', client.parkedFailure);
    consoleError.mockRestore();
  });

  it('merges a later walk into the one waiting and sends only the first instant, once', async () => {
    const { sender, client, connectivity } = offlineWalkRig();
    connectivity.set('offline');
    await sender.submit(julieWalk);
    connectivity.set('online');
    client.parkedReports.length = 0;
    client.holdsParkedAnswer = true;

    const later = await sender.submit({ ...julieWalk, detectedAt: AT_18_05 + ONE_MINUTE, aisleMinor: 2 });
    client.answerParked();
    await sender.flush();

    expect(later).toBe('queued');
    expect(client.parkedReports).toEqual([julieWalk]);
  });
});

describe('sending the kept walks again', () => {
  it('sends them when the network comes back, with their first instant and aisle, after the native buffer', async () => {
    const { sender, client, connectivity, store, commands, replayed } = offlineWalkRig();
    connectivity.set('offline');
    await sender.submit(julieWalk);

    connectivity.set('online');
    await sender.flush();

    expect(client.parkedReports).toEqual([julieWalk]);
    expect(store.walks).toEqual([]);
    expect(replayed).toEqual([julieWalk]);
    expect(commands()).toEqual(['flushOfflineQueue']);
  });

  it('sends them when the app returns to the front', async () => {
    const { client, comeToFront, sender } = offlineWalkRig([julieWalk]);

    comeToFront();
    await sender.flush();

    expect(client.parkedReports).toEqual([julieWalk]);
  });

  it('sends nothing while the network is still cut', async () => {
    const { sender, client, connectivity } = offlineWalkRig([julieWalk]);
    connectivity.set('offline');

    await sender.flush();

    expect(client.parkedReports).toEqual([]);
  });

  it('sends each walk once when two flushes start together', async () => {
    const { sender, client, replayed } = offlineWalkRig([julieWalk]);

    await Promise.all([sender.flush(), sender.flush()]);

    expect(client.parkedReports).toHaveLength(1);
    expect(replayed).toHaveLength(1);
  });

  it('counts a walk Palier already had as accepted', async () => {
    const { sender, client, replayed, store } = offlineWalkRig([julieWalk]);
    client.session = julieAtParkingDemo({ state: 'PARKED_PRESUMED' });

    await sender.flush();

    expect(replayed).toEqual([julieWalk]);
    expect(store.walks).toEqual([]);
  });

  it('sends the walks of every session, and drops the one of a session Palier does not know', async () => {
    const otherSession = { ...julieWalk, sessionId: 'session-of-marc' };
    const { sender, client, store } = offlineWalkRig([otherSession, julieWalk]);
    client.parkedFailure = new PalierRejectedError('SESSION_NOT_FOUND');

    await sender.flush();

    expect(client.parkedReports.map((report) => report.sessionId)).toEqual(['session-of-marc', 'session-1']);
    expect(store.walks).toEqual([]);
  });

  it('stops at the first walk Palier cannot be reached for, and keeps the rest', async () => {
    const otherSession = { ...julieWalk, sessionId: 'session-2' };
    const { sender, client, store } = offlineWalkRig([julieWalk, otherSession]);
    client.parkedFailure = new PalierUnreachableError('offline');

    await sender.flush();

    expect(client.parkedReports).toHaveLength(1);
    expect(store.walks).toEqual([julieWalk, otherSession]);
  });

  it('keeps an earlier walk merged in while the later one was on its way', async () => {
    const later = { ...julieWalk, detectedAt: AT_18_05 + ONE_MINUTE };
    const { sender, client, store, replayed } = offlineWalkRig([later]);
    client.holdsParkedAnswer = true;
    const flight = sender.flush();
    await untilReported(client, 1);

    await sender.submit(julieWalk);
    client.answerParked();
    await flight;

    expect(store.walks).toEqual([julieWalk]);
    expect(replayed).toEqual([]);
  });
});

describe('the retry every 10 s', () => {
  beforeEach(() => jest.useFakeTimers({ now: AT_18_05 }));
  afterEach(() => jest.useRealTimers());

  it('sends a kept walk again 10 s later, then stops once it went through', async () => {
    const { sender, client, store } = offlineWalkRig();
    client.parkedFailure = new PalierUnreachableError('offline');
    await sender.submit(julieWalk);
    client.parkedFailure = null;

    await jest.advanceTimersByTimeAsync(RETRY_MILLISECONDS);
    await jest.advanceTimersByTimeAsync(3 * RETRY_MILLISECONDS);

    expect(client.parkedReports).toHaveLength(2);
    expect(store.walks).toEqual([]);
  });

  it('tries nothing more after Palier refused the walk', async () => {
    const { sender, client } = offlineWalkRig();
    client.parkedFailure = new PalierRejectedError('ENTRY_NOT_CONFIRMED');
    await sender.submit(julieWalk);

    await jest.advanceTimersByTimeAsync(3 * RETRY_MILLISECONDS);

    expect(client.parkedReports).toHaveLength(1);
  });

  it('tries nothing more once stopped, though a walk still waits', async () => {
    const { sender, client, stop, store } = offlineWalkRig();
    client.parkedFailure = new PalierUnreachableError('offline');
    await sender.submit(julieWalk);

    stop();
    await jest.advanceTimersByTimeAsync(3 * RETRY_MILLISECONDS);

    expect(client.parkedReports).toHaveLength(1);
    expect(store.walks).toEqual([julieWalk]);
  });
});

describe('signing out', () => {
  it('forgets the kept walks', async () => {
    const { sender, store } = offlineWalkRig([julieWalk]);

    await sender.clear();

    expect(store.walks).toEqual([]);
    expect(sender.pendingFor('session-1')).toBe(0);
  });
});
