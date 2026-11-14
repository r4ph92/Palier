import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger, sortieDemo } from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

const firstOpen = { id: '00000000-0000-4000-8000-000000000c01', kind: 'OPEN', issuedAt: '2026-10-27T22:02:00.000Z' } as const;
const sameMillisecondA = { id: '00000000-0000-4000-8000-000000000c2a', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z' } as const;
const sameMillisecondB = { id: '00000000-0000-4000-8000-000000000c2b', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z' } as const;

function cursorAt(command: { readonly id: string; readonly issuedAt: string }): string {
  return `?after=${command.issuedAt}&afterId=${command.id}`;
}

describe('GET /v1/gates/me/commands', () => {
  let server: FastifyInstance;

  function startServer(commands: FakeGateCommandFeed) {
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger: new FakePassageLedger(), clock: () => NOW, commands, openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() };
    server = buildServer(serverDependencies({ gates }));
  }

  function listCommands(query = '', deviceKey = ENTREE_DEMO_KEY) {
    return server.inject({ method: 'GET', url: `/v1/gates/me/commands${query}`, headers: { authorization: `Bearer ${deviceKey}` } });
  }

  afterEach(() => server.close());

  it('lists the commands of the key gate only, oldest first', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, sameMillisecondA).add(entreeDemo.id, firstOpen).add(sortieDemo.id, sameMillisecondB));

    const response = await listCommands();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([firstOpen, sameMillisecondA]);
  });

  it('brings only commands issued after the cursor, both rows of one millisecond included', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, firstOpen).add(entreeDemo.id, sameMillisecondB).add(entreeDemo.id, sameMillisecondA));

    const response = await listCommands(cursorAt(firstOpen));

    expect(response.json()).toEqual([sameMillisecondA, sameMillisecondB]);
  });

  it('brings the second command of a millisecond when the cursor is the first one', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, firstOpen).add(entreeDemo.id, sameMillisecondB).add(entreeDemo.id, sameMillisecondA));

    const response = await listCommands(cursorAt(sameMillisecondA));

    expect(response.json()).toEqual([sameMillisecondB]);
  });

  it('answers nothing new when the cursor is the last command', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, firstOpen));

    expect((await listCommands(cursorAt(firstOpen))).json()).toEqual([]);
  });

  it('refuses a request without a valid device key', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, firstOpen));

    const response = await server.inject({ method: 'GET', url: '/v1/gates/me/commands' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'DEVICE_KEY_REFUSED' });
  });

  it.each(['yesterday', '2025-12-31T23:59:60Z', '0000-06-01T12:00:00Z'])('refuses the cursor %s with 400', async (after) => {
    startServer(new FakeGateCommandFeed());

    expect((await listCommands(`?after=${encodeURIComponent(after)}&afterId=${firstOpen.id}`)).statusCode).toBe(400);
  });

  it.each([
    ['a time without an id', `?after=${firstOpen.issuedAt}`],
    ['an id without a time', `?afterId=${firstOpen.id}`],
    ['an id that is not a UUID', `?after=${firstOpen.issuedAt}&afterId=command-1`],
  ])('refuses %s with 400', async (_case, query) => {
    startServer(new FakeGateCommandFeed());

    expect((await listCommands(query)).statusCode).toBe(400);
  });
});
