import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import {
  ENTREE_DEMO_KEY,
  entreeDemo,
  FakeEquipmentReports,
  FakeGateCommandFeed,
  FakeGateDeviceKeyRepository,
  FakePassageLedger,
  REVOKED_KEY,
  SORTIE_DEMO_KEY,
  sortieDemo,
  UNKNOWN_KEY,
} from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function exitAt(id: string, closedAt: Date) {
  return { id, kind: 'EXIT', closedAt: closedAt.toISOString() };
}

describe('POST /v1/gates/:id/passages/replay', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;

  function startServer(vehicleCount: number): void {
    ledger = new FakePassageLedger(vehicleCount);
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger, passageClock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() };
    server = buildServer(serverDependencies({ gates }));
  }

  function replay(gateId: string, deviceKey: string, payload: unknown) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/passages/replay`, headers: { authorization: `Bearer ${deviceKey}` }, payload: payload as object });
  }

  function replayExits(passages: object[], deviceKey = SORTIE_DEMO_KEY) {
    return replay(sortieDemo.id, deviceKey, { passages });
  }

  afterEach(() => server.close());

  describe('replaying what a controller counted offline (C3)', () => {
    it('counts every passage out and answers the new vehicle count', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, new Date(NOW.getTime() - 3 * MINUTE)), exitAt(SECOND_ID, new Date(NOW.getTime() - MINUTE))]);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ counted: 2, duplicates: 0, vehicleCount: 3 });
    });

    it('keeps the original times the controller counted', async () => {
      startServer(5);
      const firstClosedAt = new Date(NOW.getTime() - 3 * MINUTE);

      await replayExits([exitAt(FIRST_ID, firstClosedAt)]);

      expect(ledger.replayed.map((entry) => entry.passage)).toEqual([{ id: FIRST_ID, closedAt: firstClosedAt }]);
    });

    it('counts entries in at an entry gate', async () => {
      startServer(0);

      const response = await replay(entreeDemo.id, ENTREE_DEMO_KEY, { passages: [{ id: FIRST_ID, kind: 'ENTRY', closedAt: NOW.toISOString() }] });

      expect(response.json()).toEqual({ counted: 1, duplicates: 0, vehicleCount: 1 });
    });

    it('confirms no session and attaches no exit', async () => {
      startServer(5);
      ledger.pendingExits.push('session-julie');

      await replayExits([exitAt(FIRST_ID, NOW)]);

      expect(ledger.pendingExits).toEqual(['session-julie']);
      expect(ledger.entries).toEqual([]);
    });
  });

  describe('the same batch sent twice (C4)', () => {
    it('counts the batch once', async () => {
      startServer(5);
      const batch = [exitAt(FIRST_ID, NOW), exitAt(SECOND_ID, NOW)];

      await replayExits(batch);
      const second = await replayExits(batch);

      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual({ counted: 0, duplicates: 2, vehicleCount: 3 });
    });

    it('counts only the passages the first batch did not carry', async () => {
      startServer(5);
      await replayExits([exitAt(FIRST_ID, NOW)]);

      const response = await replayExits([exitAt(FIRST_ID, NOW), exitAt(SECOND_ID, NOW)]);

      expect(response.json()).toEqual({ counted: 1, duplicates: 1, vehicleCount: 3 });
    });
  });

  describe('a replay signed with another gate key (C5)', () => {
    it('forbids the entry key from replaying at the exit gate and counts nothing', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, NOW)], ENTREE_DEMO_KEY);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'GATE_FORBIDDEN' });
      expect(ledger.replayed).toEqual([]);
      expect(ledger.vehicleCount).toBe(5);
    });

    it.each([
      ['an unknown key', UNKNOWN_KEY],
      ['a revoked key', REVOKED_KEY],
    ])('refuses %s with 401 and counts nothing', async (_case, deviceKey) => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, NOW)], deviceKey);

      expect(response.statusCode).toBe(401);
      expect(ledger.replayed).toEqual([]);
    });
  });

  describe('a batch the server refuses', () => {
    it('refuses a passage of another kind than the gate, 409, and counts nothing', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, NOW), { id: SECOND_ID, kind: 'ENTRY', closedAt: NOW.toISOString() }]);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'REPLAY_KIND_MISMATCH' });
      expect(ledger.replayed).toEqual([]);
    });

    it('refuses an id repeated inside the batch, 400, and counts nothing', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, NOW), exitAt(FIRST_ID, NOW)]);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'REPLAY_IDS_REPEATED' });
      expect(ledger.replayed).toEqual([]);
    });

    it('refuses a closedAt more than 5 minutes ahead and counts none of the batch', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, NOW), exitAt(SECOND_ID, new Date(NOW.getTime() + 6 * MINUTE))]);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'CLOSED_AT_IN_FUTURE' });
      expect(ledger.replayed).toEqual([]);
    });

    it('refuses a closedAt older than 7 days', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, new Date(NOW.getTime() - 7 * DAY - MINUTE))]);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'CLOSED_AT_TOO_OLD' });
      expect(ledger.replayed).toEqual([]);
    });

    it('accepts a closedAt just inside 7 days', async () => {
      startServer(5);

      const response = await replayExits([exitAt(FIRST_ID, new Date(NOW.getTime() - 7 * DAY + MINUTE))]);

      expect(response.statusCode).toBe(200);
    });

    it('answers 409 for a gate without loops', async () => {
      const key = 'noLoopsKey000000000000000000000000000000000';
      ledger = new FakePassageLedger(5);
      const deviceKeys = new FakeGateDeviceKeyRepository().withGate(key, { ...sortieDemo, hasLoops: false });
      server = buildServer(serverDependencies({ gates: { deviceKeys, ledger, passageClock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() } }));

      const response = await replayExits([exitAt(FIRST_ID, NOW)], key);

      expect(response.statusCode).toBe(409);
    });

    it.each([
      ['an empty batch', { passages: [] }],
      ['a missing passages list', {}],
      ['a passage id that is not a uuid', { passages: [{ id: 'one', kind: 'EXIT', closedAt: NOW.toISOString() }] }],
      ['a urn:uuid id', { passages: [{ id: `urn:uuid:${FIRST_ID}`, kind: 'EXIT', closedAt: NOW.toISOString() }] }],
      ['a closedAt that is not a date', { passages: [{ id: FIRST_ID, kind: 'EXIT', closedAt: 'yesterday' }] }],
      ['an unknown kind', { passages: [{ id: FIRST_ID, kind: 'SIDE', closedAt: NOW.toISOString() }] }],
    ])('answers 400 for %s', async (_case, payload) => {
      startServer(5);

      const response = await replay(sortieDemo.id, SORTIE_DEMO_KEY, payload);

      expect(response.statusCode).toBe(400);
      expect(ledger.replayed).toEqual([]);
    });

    it('answers 400 for more than 500 passages', async () => {
      startServer(900);
      const passages = Array.from({ length: 501 }, (_, index) => exitAt(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, NOW));

      const response = await replayExits(passages);

      expect(response.statusCode).toBe(400);
      expect(ledger.replayed).toEqual([]);
    });

    it('accepts exactly 500 passages', async () => {
      startServer(900);
      const passages = Array.from({ length: 500 }, (_, index) => exitAt(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, NOW));

      const response = await replayExits(passages);

      expect(response.json()).toEqual({ counted: 500, duplicates: 0, vehicleCount: 400 });
    });
  });

  it('leaves the single passage route accepting an old closedAt', async () => {
    startServer(5);

    const response = await server.inject({
      method: 'POST',
      url: `/v1/gates/${sortieDemo.id}/passage`,
      headers: { authorization: `Bearer ${SORTIE_DEMO_KEY}` },
      payload: { closedAt: new Date(NOW.getTime() - 30 * DAY).toISOString() },
    });

    expect(response.statusCode).toBe(200);
  });
});
