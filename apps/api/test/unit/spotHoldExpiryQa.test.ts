import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expireSpotHolds, type HoldExpiryJob } from '../../src/domain/spotHolds/expireSpotHolds.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { startHoldExpiry } from '../../src/scheduler/startHoldExpiry.ts';
import { configureServer } from './configureServer.ts';
import { julie, marc } from './fakeDriverRepository.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';
import { fakeSpotHoldId, FakeSpotHoldRepository } from './fakes/fakeSpotHolds.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const AT_14_16_50 = new Date('2026-11-04T19:16:50Z');
const AT_14_17 = new Date('2026-11-04T19:17:00Z');
const AT_14_30 = new Date('2026-11-04T19:30:00Z');

function logSpy() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('QA hold expiry: through the routes, on the shared test clock', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieHoldingAt1402() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const placed = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    expect(placed.statusCode).toBe(201);
    const job: HoldExpiryJob = { spotHolds: configured.spotHolds, clock: configured.testClock.now };
    const readHold = async () => (await server.inject({ method: 'GET', url: '/v1/me/hold', headers })).json<{ spotHold: unknown }>().spotHold;
    return { ...configured, headers, job, readHold };
  }

  it('keeps Julie’s hold readable after a check at 14:16:50, then reads none after the check at 14:17', async () => {
    const { testClock, job, readHold } = await julieHoldingAt1402();

    testClock.setFixed(AT_14_16_50);
    await expireSpotHolds(job, logSpy());
    expect(await readHold()).toMatchObject({ spotHoldId: fakeSpotHoldId(1) });

    testClock.setFixed(AT_14_17);
    await expireSpotHolds(job, logSpy());
    expect(await readHold()).toBeNull();
  });

  it('lets Julie take a new hold once hers has expired, and refuses it before', async () => {
    const { testClock, job, headers } = await julieHoldingAt1402();
    testClock.setFixed(AT_14_17);

    const beforeCheck = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    await expireSpotHolds(job, logSpy());
    const afterCheck = await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    expect(beforeCheck.statusCode).toBe(409);
    expect(beforeCheck.json()).toMatchObject({ error: 'HOLD_ALREADY_EXISTS' });
    expect(afterCheck.statusCode).toBe(201);
    expect(afterCheck.json()).toMatchObject({ expiresAt: '2026-11-04T19:32:00.000Z' });
  });

  it('leaves a hold taken on a clock set ahead alone once the clock is back on real time', async () => {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(new Date('2099-01-01T00:00:00Z'));
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });

    configured.testClock.useRealTime();
    await expireSpotHolds({ spotHolds: configured.spotHolds, clock: configured.testClock.now }, logSpy());

    expect(configured.spotHolds.expiries).toEqual([]);
    expect(await configured.spotHolds.findActiveSpotHold(julie.id)).toMatchObject({ expiresAt: new Date('2099-01-01T00:15:00Z') });
  });
});

describe('QA hold expiry: several lots, several holds, and what the logs carry', () => {
  async function holdsAcrossTwoLots(): Promise<FakeSpotHoldRepository> {
    const spotHolds = new FakeSpotHoldRepository();
    const hold = (driverId: string, lotId: string, expiresAt: Date) =>
      spotHolds.placeSpotHold({ driverId, lotId, needs: standardNeeds, createdAt: AT_14_02, expiresAt });
    await hold(julie.id, PARKING_DEMO_ID, AT_14_17);
    await hold(marc.id, PARKING_DEMO_ID, AT_14_17);
    await hold('00000000-0000-4000-8000-000000000504', GARAGE_ROY_ID, AT_14_17);
    await hold('00000000-0000-4000-8000-000000000505', GARAGE_ROY_ID, AT_14_30);
    return spotHolds;
  }

  it('expires each lot once with its own count and leaves the hold that has time left', async () => {
    const spotHolds = await holdsAcrossTwoLots();
    const log = logSpy();

    await expireSpotHolds({ spotHolds, clock: () => AT_14_17 }, log);

    expect(spotHolds.expiries.map(({ lotId }) => lotId).sort()).toEqual([PARKING_DEMO_ID, GARAGE_ROY_ID].sort());
    expect(log.info).toHaveBeenCalledWith({ lotId: PARKING_DEMO_ID, expired: 2 }, 'expired spot holds nobody used');
    expect(log.info).toHaveBeenCalledWith({ lotId: GARAGE_ROY_ID, expired: 1 }, 'expired spot holds nobody used');
    expect(spotHolds.freedSpots).toBe(3);
    expect(await spotHolds.findActiveSpotHold('00000000-0000-4000-8000-000000000505')).not.toBeNull();
  });

  it('writes no driver id and no hold id in any log line', async () => {
    const spotHolds = await holdsAcrossTwoLots();
    const log = logSpy();

    await expireSpotHolds({ spotHolds, clock: () => AT_14_30 }, log);

    const written = JSON.stringify([log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls]);
    expect(written).not.toContain(julie.id);
    expect(written).not.toContain(marc.id);
    expect(written).not.toContain(fakeSpotHoldId(1));
  });

  it('logs nothing for a lot whose holds a concurrent run ended between the lookup and the lock', async () => {
    const spotHolds: HoldExpiryJob['spotHolds'] = {
      findLotsWithExpiredHolds: () => Promise.resolve([PARKING_DEMO_ID]),
      expireLotSpotHolds: () => Promise.resolve({ expired: 0, freed: 0 }),
    };
    const log = logSpy();

    await expireSpotHolds({ spotHolds, clock: () => AT_14_17 }, log);

    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe('QA hold expiry: a lookup that fails', () => {
  afterEach(() => vi.useRealTimers());

  it('is logged by the schedule and the next period expires the hold', async () => {
    vi.useFakeTimers();
    const spotHolds = new FakeSpotHoldRepository();
    await spotHolds.placeSpotHold({ driverId: julie.id, lotId: PARKING_DEMO_ID, needs: standardNeeds, createdAt: AT_14_02, expiresAt: AT_14_17 });
    const findLots = spotHolds.findLotsWithExpiredHolds.bind(spotHolds);
    const outage = new Error('connection terminated');
    spotHolds.findLotsWithExpiredHolds = vi.fn().mockRejectedValueOnce(outage).mockImplementation(findLots);
    const logger = { ...logSpy(), error: vi.fn() };
    const stop = startHoldExpiry(() => expireSpotHolds({ spotHolds, clock: () => AT_14_17 }, logger), logger, 30_000);

    await vi.advanceTimersByTimeAsync(60_000);
    await stop();

    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ err: outage }, 'Expiring spot holds failed');
    expect(await spotHolds.findActiveSpotHold(julie.id)).toBeNull();
  });
});
