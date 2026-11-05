import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { readDatabasePoolMax } from '../../src/config/databasePool.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { parseEntryLoadArguments } from '../../src/load/entryLoadArguments.ts';
import { fireEntries } from '../../src/load/fireEntries.ts';
import { configureServer } from './configureServer.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate, fakeSessionId } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

describe('replayed scans and the entry limit', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer();
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const enter = () => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr } });
    return { ...configured, enter };
  }

  it('still refuses a sixth fresh entry when every fresh entry was followed by replays', async () => {
    const { enter, entries } = await startWithJulieReady();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await enter();
      await enter();
      await enter();
      entries.sessions.cancelIfCreated(fakeSessionId(attempt));
    }

    const sixthFresh = await enter();

    expect(sixthFresh.statusCode).toBe(429);
    expect(entries.payments.authorized).toHaveLength(5);
  });

  it('admits a fresh entry after the replayed one was cancelled', async () => {
    const { enter, entries } = await startWithJulieReady();
    for (let scan = 0; scan < 6; scan += 1) {
      await enter();
    }
    entries.sessions.cancelIfCreated(fakeSessionId(1));

    const fresh = await enter();

    expect(fresh.statusCode).toBe(201);
    expect(entries.payments.authorized).toHaveLength(2);
  });
});

describe('the load script and database pool numbers', () => {
  it.each(['+5', '５', '٥', '5\n'])('refuses --drivers %j, which is not plain ASCII digits', (drivers) => {
    expect(() => parseEntryLoadArguments(['--drivers', drivers], {})).toThrow(/--drivers must be a whole number from 1 to 20/);
  });

  it('refuses a negative --drivers written with an equals sign', () => {
    expect(() => parseEntryLoadArguments(['--drivers=-1'], {})).toThrow(/--drivers must be a whole number from 1 to 20/);
  });

  it('accepts --drivers 5', () => {
    expect(parseEntryLoadArguments(['--drivers', '5'], {}).drivers).toBe(5);
  });

  it.each(['0x2', '+2', '2\n'])('refuses DATABASE_POOL_MAX=%j', (rawMax) => {
    expect(() => readDatabasePoolMax({ DATABASE_POOL_MAX: rawMax })).toThrow(/DATABASE_POOL_MAX must be a positive whole number/);
  });
});

describe('the load script against an API that never answers', () => {
  let silentApi: Server;

  afterEach(() => {
    silentApi.closeAllConnections();
    silentApi.close();
  });

  it('gives up within ten seconds, so the run ends and revokes its driver tokens', { timeout: 15_000 }, async () => {
    silentApi = createServer(() => undefined);
    await new Promise<void>((resolve) => silentApi.listen(0, '127.0.0.1', resolve));
    const { port } = silentApi.address() as AddressInfo;

    const outcomes = await fireEntries({ apiUrl: new URL(`http://127.0.0.1:${port}`), qrContent: entreeDemoQr, appVersion: '0.1.0' }, ['token-1']);

    expect(outcomes[0]?.answer).toMatch(/^UNREACHABLE/);
    expect(outcomes[0]?.latencyMilliseconds).toBeLessThan(10_000);
  });
});
