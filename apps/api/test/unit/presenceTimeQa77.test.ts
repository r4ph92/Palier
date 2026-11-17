import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { readLotEquipmentOfMember } from '../../src/domain/dashboard/lotEquipment.ts';
import type { LotEquipmentReader, LotGates } from '../../src/domain/dashboard/LotEquipmentReader.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger } from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

const CLOSED_AT = new Date(NOW.getTime() - 1000);
const SEVEN_DAYS_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

describe('QA #77: the arming time a gate reports with its passage', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;

  afterEach(() => server.close());

  async function postPassage(payload: Record<string, unknown>) {
    ledger = new FakePassageLedger(0);
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger, passageClock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() };
    server = buildServer(serverDependencies({ gates }));
    return server.inject({ method: 'POST', url: `/v1/gates/${entreeDemo.id}/passage`, headers: { authorization: `Bearer ${ENTREE_DEMO_KEY}` }, payload });
  }

  it('reads an arming time given with a UTC offset as the same instant', async () => {
    const response = await postPassage({ closedAt: '2026-10-27T22:01:59Z', armedAt: '2026-10-27T23:01:50+01:00' });

    expect(response.statusCode).toBe(200);
    expect(ledger.entries[0]?.armedAt).toEqual(new Date('2026-10-27T22:01:50Z'));
  });

  it('keeps an arming time equal to the closing time, a zero-second presence', async () => {
    await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt: CLOSED_AT.toISOString() });

    expect(ledger.entries[0]?.armedAt).toEqual(CLOSED_AT);
  });

  it.each([null, 12345, ['2026-10-27T22:01:50Z']])('refuses an arming time of the wrong type (%j) without counting', async (armedAt) => {
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt });

    expect(response.statusCode).toBe(400);
    expect(ledger.entries).toHaveLength(0);
  });

  it('keeps an arming time exactly 7 days before the closing', async () => {
    const armedAt = new Date(CLOSED_AT.getTime() - SEVEN_DAYS_MILLISECONDS);
    await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt: armedAt.toISOString() });

    expect(ledger.entries[0]?.armedAt).toEqual(armedAt);
  });

  it('forgets an arming time 7 days and 1 ms before the closing, the passage still recorded', async () => {
    const armedAt = new Date(CLOSED_AT.getTime() - SEVEN_DAYS_MILLISECONDS - 1);
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt: armedAt.toISOString() });

    expect(response.statusCode).toBe(200);
    expect(ledger.vehicleCount).toBe(1);
    expect(ledger.entries[0]?.armedAt).toBeNull();
  });

  it.each(['0001-01-01T00:00:00Z', '2026-09-27T22:01:59Z'])('forgets an arming time that cannot be right (%s) but still counts the vehicle', async (armedAt) => {
    const response = await postPassage({ closedAt: CLOSED_AT.toISOString(), armedAt });

    expect(response.statusCode).toBe(200);
    expect(ledger.vehicleCount).toBe(1);
    expect(ledger.entries[0]?.armedAt).toBeNull();
  });
});

describe('QA #77: the 7-day window of the average presence time', () => {
  const lotGates: LotGates = { lotName: 'Parking Démo', gates: [{ id: 'sortie', name: 'Sortie Démo', kind: 'EXIT', lastHeartbeatAt: null }] };

  function spyReader(owned: boolean) {
    const sinceAsked: Date[] = [];
    const reader: LotEquipmentReader = {
      readLotGates: () => Promise.resolve(owned ? lotGates : null),
      readGatePresence: (_operatorId, _lotId, since) => {
        sinceAsked.push(since);
        return Promise.resolve(new Map([['sortie', 9]]));
      },
    };
    return { reader, sinceAsked };
  }

  const operators = { findOperatorOfMember: () => Promise.resolve({ id: 'operator-lavoie', name: 'Stationnements Lavoie inc.' }) } as never;

  it('starts the window exactly 7 days before the clock of the page', async () => {
    const { reader, sinceAsked } = spyReader(true);

    const equipment = await readLotEquipmentOfMember({ operators, equipment: reader, clock: () => NOW }, { userId: 'sophie', lotId: 'lot' });

    expect(sinceAsked).toEqual([new Date(NOW.getTime() - SEVEN_DAYS_MILLISECONDS)]);
    expect(equipment.gates[0]?.averagePresenceSeconds).toBe(9);
  });

  it('never reads the presence of a lot the operator does not own', async () => {
    const { reader, sinceAsked } = spyReader(false);

    await expect(readLotEquipmentOfMember({ operators, equipment: reader, clock: () => NOW }, { userId: 'pierre', lotId: 'lot' })).rejects.toThrow();
    expect(sinceAsked).toEqual([]);
  });
});
