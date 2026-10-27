import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeGateDeviceKeyRepository, FakePassageLedger } from './fakes/gateFixtures.ts';
import { NOW, serverDependencies } from './fakes/serverDependencies.ts';

describe('POST /v1/gates/:id/passage with a closedAt JavaScript cannot represent', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;

  afterEach(() => server.close());

  it.each(['2025-12-31T23:59:60Z', '2016-12-31T23:59:60Z', '0000-06-01T12:00:00Z'])(
    'refuses %s with 400 and counts nothing instead of answering 500',
    async (closedAt) => {
      ledger = new FakePassageLedger(0);
      const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger, clock: () => NOW };
      server = buildServer(serverDependencies({ gates }));

      const response = await server.inject({
        method: 'POST',
        url: `/v1/gates/${entreeDemo.id}/passage`,
        headers: { authorization: `Bearer ${ENTREE_DEMO_KEY}` },
        payload: { closedAt },
      });

      expect(response.statusCode).toBe(400);
      expect(ledger.entries).toHaveLength(0);
    },
  );
});
