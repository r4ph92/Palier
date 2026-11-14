import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger, SORTIE_DEMO_KEY, sortieDemo } from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

const PASSAGE_ID = 'abcdef12-3456-4789-8abc-def123456789';
const MINUTE = 60 * 1000;

describe('POST /v1/gates/:id/passages/replay, batch rules', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;

  function startServer(vehicleCount: number): void {
    ledger = new FakePassageLedger(vehicleCount);
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger, clock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() };
    server = buildServer(serverDependencies({ gates }));
  }

  function replay(gateId: string, deviceKey: string, passages: object[]) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/passages/replay`, headers: { authorization: `Bearer ${deviceKey}` }, payload: { passages } });
  }

  const oneMinuteAgo = new Date(NOW.getTime() - MINUTE).toISOString();

  afterEach(() => server.close());

  // Postgres reads both spellings as one uuid, so the batch carries the same passage twice.
  it('refuses an id repeated in another letter case inside the batch, and counts nothing', async () => {
    startServer(5);

    const response = await replay(sortieDemo.id, SORTIE_DEMO_KEY, [
      { id: PASSAGE_ID, kind: 'EXIT', closedAt: oneMinuteAgo },
      { id: PASSAGE_ID.toUpperCase(), kind: 'EXIT', closedAt: oneMinuteAgo },
    ]);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'REPLAY_IDS_REPEATED' });
    expect(ledger.vehicleCount).toBe(5);
  });

  it('counts a passage id only once even when replayed again in another letter case', async () => {
    startServer(5);
    await replay(sortieDemo.id, SORTIE_DEMO_KEY, [{ id: PASSAGE_ID, kind: 'EXIT', closedAt: oneMinuteAgo }]);

    const response = await replay(sortieDemo.id, SORTIE_DEMO_KEY, [{ id: PASSAGE_ID.toUpperCase(), kind: 'EXIT', closedAt: oneMinuteAgo }]);

    expect(response.json()).toEqual({ counted: 0, duplicates: 1, vehicleCount: 4 });
  });

  it('counts the same passage id again at another gate, since ids are unique per gate', async () => {
    startServer(5);
    await replay(sortieDemo.id, SORTIE_DEMO_KEY, [{ id: PASSAGE_ID, kind: 'EXIT', closedAt: oneMinuteAgo }]);

    const response = await replay(entreeDemo.id, ENTREE_DEMO_KEY, [{ id: PASSAGE_ID, kind: 'ENTRY', closedAt: oneMinuteAgo }]);

    expect(response.json()).toEqual({ counted: 1, duplicates: 0, vehicleCount: 5 });
  });

  it('refuses the whole batch when one passage is too old, counting none of the recent ones', async () => {
    startServer(5);
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * MINUTE).toISOString();

    const response = await replay(sortieDemo.id, SORTIE_DEMO_KEY, [
      { id: PASSAGE_ID, kind: 'EXIT', closedAt: oneMinuteAgo },
      { id: '11111111-1111-4111-8111-111111111111', kind: 'EXIT', closedAt: eightDaysAgo },
    ]);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'CLOSED_AT_TOO_OLD' });
    expect(ledger.replayed).toEqual([]);
  });
});
