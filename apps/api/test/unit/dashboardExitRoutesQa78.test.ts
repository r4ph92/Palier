import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ExitCountsRead, ExitIdentificationReader } from '../../src/domain/dashboard/ExitIdentificationReader.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const EXITS_URL = `/v1/dashboard/lots/${PARKING_DEMO_ID}/exits`;
const NOW = new Date('2027-02-01T12:00:00Z');
const THIRTY_DAYS_BEFORE_NOW = new Date('2027-01-02T12:00:00Z');
const TWO_HOURS = 2 * 60 * 60 * 1000;

// Answers every lot of Parking Démo's operator with what it was given, and remembers each cutoff it was asked for.
class RecordingExitReader implements ExitIdentificationReader {
  readonly cutoffs: Date[] = [];
  readonly #read: ExitCountsRead;

  constructor(read: ExitCountsRead) {
    this.#read = read;
  }

  readExitCounts(_operatorId: string, lotId: string, since: Date): Promise<ExitCountsRead | null> {
    this.cutoffs.push(since);
    return Promise.resolve(lotId === PARKING_DEMO_ID ? this.#read : null);
  }
}

const demoExits: ExitCountsRead = { lotName: 'Parking Démo', counts: { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0 } };

describe('QA #78: the exit shares route, attacked', () => {
  let server: FastifyInstance | undefined;

  afterEach(() => server?.close());

  function serverReading(reader: ExitIdentificationReader) {
    const started = startDashboardServer({ testSignInEnabled: true }, { exitIdentifications: reader });
    server = started.server;
    return started;
  }

  async function sophieReads(url = EXITS_URL) {
    if (server === undefined) {
      throw new Error('start the server first');
    }
    return server.inject({ method: 'GET', url, cookies: await dashboardCookieFor(server, sophie) });
  }

  it('counts the 30 days back from the test clock, and moves the window when the clock moves', async () => {
    const reader = new RecordingExitReader(demoExits);
    const { testClock } = serverReading(reader);
    testClock?.setFixed(NOW);

    await sophieReads();
    testClock?.setFixed(new Date(NOW.getTime() + TWO_HOURS));
    await sophieReads();

    expect(reader.cutoffs).toEqual([THIRTY_DAYS_BEFORE_NOW, new Date(THIRTY_DAYS_BEFORE_NOW.getTime() + TWO_HOURS)]);
  });

  it('sends only the lot name and the counts, even when the reader carries a plate or a driver', async () => {
    const leakyRead = { ...demoExits, plate: 'ABC 123', userId: 'julie', capturedCents: 300 } as unknown as ExitCountsRead;
    serverReading(new RecordingExitReader(leakyRead));

    const response = await sophieReads();

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toMatch(/ABC 123|julie|plate|userId|captured/);
    expect(Object.keys(response.json())).toEqual(['lotName', 'totalExits', 'counts']);
    expect(Object.keys(response.json().counts).sort()).toEqual(['APP', 'BEACON', 'PLATE', 'STAFF', 'TRANSPONDER']);
  });

  it('keeps the window and the lot of the path whatever the query string asks for', async () => {
    const reader = new RecordingExitReader(demoExits);
    const { testClock } = serverReading(reader);
    testClock?.setFixed(NOW);

    const response = await sophieReads(`${EXITS_URL}?since=1970-01-01&days=99999&lotId=00000000-0000-4000-8000-000000000202`);

    expect(response.json()).toMatchObject({ lotName: 'Parking Démo', totalExits: 10 });
    expect(reader.cutoffs).toEqual([THIRTY_DAYS_BEFORE_NOW]);
  });

  it.each([
    ['an SQL fragment', "1'%20or%20'1'='1"],
    ['a script tag', '%3Cscript%3Ealert(1)%3C%2Fscript%3E'],
    ['a lot id with a NUL byte', `${PARKING_DEMO_ID}%00`],
    ['a lot id one digit short', PARKING_DEMO_ID.slice(0, -1)],
    ['emoji', '%F0%9F%9A%97'],
  ])('answers %s with the not found of an unknown lot, without reading any exit', async (_case, lotId) => {
    const reader = new RecordingExitReader(demoExits);
    serverReading(reader);

    const response = await sophieReads(`/v1/dashboard/lots/${lotId}/exits`);

    expect([response.statusCode, response.json()]).toEqual([404, LOT_NOT_FOUND]);
    expect(reader.cutoffs).toEqual([]);
  });
});
