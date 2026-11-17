import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger } from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

const CLOSED_AT = new Date(NOW.getTime() - 1000);

function secondsBeforeClosing(seconds: number): string {
  return new Date(CLOSED_AT.getTime() - seconds * 1000).toISOString();
}

describe('POST /v1/gates/:id/passage with an arming time', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;

  afterEach(() => server.close());

  async function postPassage(payload: Record<string, unknown>) {
    ledger = new FakePassageLedger(0);
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger, passageClock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() };
    server = buildServer(serverDependencies({ gates }));
    return server.inject({ method: 'POST', url: `/v1/gates/${entreeDemo.id}/passage`, headers: { authorization: `Bearer ${ENTREE_DEMO_KEY}` }, payload });
  }

  it('records the arming time reported 9 seconds before the closing', async () => {
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt: secondsBeforeClosing(9) });

    expect(response.statusCode).toBe(200);
    expect(ledger.entries[0]?.armedAt).toEqual(new Date(secondsBeforeClosing(9)));
  });

  it('records no arming time when the controller reports none', async () => {
    await postPassage({ closedAt: CLOSED_AT.toISOString() });

    expect(ledger.entries[0]?.armedAt).toBeNull();
  });

  it('still counts the vehicle but forgets an arming time after the closing', async () => {
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt: secondsBeforeClosing(-5) });

    expect(response.statusCode).toBe(200);
    expect(ledger.entries[0]?.armedAt).toBeNull();
    expect(ledger.vehicleCount).toBe(1);
  });

  it.each(['2025-12-31T23:59:60Z', '0000-06-01T12:00:00Z'])('still counts the vehicle when the arming time %s cannot be stored', async (armedAt) => {
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt });

    expect(response.statusCode).toBe(200);
    expect(ledger.entries[0]?.armedAt).toBeNull();
  });

  it('refuses a malformed arming time with 400', async () => {
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt: 'yesterday' });

    expect(response.statusCode).toBe(400);
    expect(ledger.entries).toHaveLength(0);
  });
});
