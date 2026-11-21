import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { GATE_COMMAND_PAGE_SIZE } from '../../src/domain/gates/GateCommandFeed.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, FakeGateCommandFeed, FakeGateDeviceKeyRepository, FakePassageLedger, SORTIE_DEMO_KEY, sortieDemo } from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

const first = { id: '00000000-0000-4000-8000-000000000c01', kind: 'OPEN', issuedAt: '2026-10-27T22:02:00.000Z', sequence: 1 } as const;
const second = { id: '00000000-0000-4000-8000-000000000c02', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z', sequence: 2 } as const;
// Issued before second but committed after it: its sequence follows the commit, not the issue time.
const committedLate = { id: '00000000-0000-4000-8000-000000000c03', kind: 'OPEN', issuedAt: '2026-10-27T22:02:30.000Z', sequence: 3 } as const;
const sortieOpen = { id: '00000000-0000-4000-8000-000000000c51', kind: 'OPEN', issuedAt: '2026-10-27T22:04:00.000Z', sequence: 1 } as const;

describe('GET /v1/gates/me/commands', () => {
  let server: FastifyInstance;

  function startServer(commands: FakeGateCommandFeed) {
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger: new FakePassageLedger(), passageClock: () => NOW, commands, openingWindow: SIXTY_SECOND_WINDOW, equipment: new FakeEquipmentReports() };
    server = buildServer(serverDependencies({ gates }));
  }

  function listCommands(query = '', deviceKey = ENTREE_DEMO_KEY) {
    return server.inject({ method: 'GET', url: `/v1/gates/me/commands${query}`, headers: { authorization: `Bearer ${deviceKey}` } });
  }

  afterEach(() => server.close());

  it('lists the commands of the key gate only, oldest first by sequence', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, second).add(entreeDemo.id, first).add(sortieDemo.id, sortieOpen));

    const response = await listCommands();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([first, second]);
  });

  it("gives Sortie Démo's key only Sortie Démo's commands, with or without a cursor", async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, first).add(entreeDemo.id, second).add(sortieDemo.id, sortieOpen));

    expect((await listCommands('', SORTIE_DEMO_KEY)).json()).toEqual([sortieOpen]);
    expect((await listCommands('?afterSequence=0', SORTIE_DEMO_KEY)).json()).toEqual([sortieOpen]);
  });

  it('shows the latest page on reload, oldest first', async () => {
    const feed = new FakeGateCommandFeed();
    for (let sequence = 1; sequence <= GATE_COMMAND_PAGE_SIZE + 2; sequence += 1) {
      feed.add(entreeDemo.id, { ...first, id: `command-${sequence}`, sequence });
    }
    startServer(feed);

    const sequences = (await listCommands()).json<{ sequence: number }[]>().map((command) => command.sequence);

    expect(sequences).toHaveLength(GATE_COMMAND_PAGE_SIZE);
    expect(sequences[0]).toBe(3);
    expect(sequences.at(-1)).toBe(GATE_COMMAND_PAGE_SIZE + 2);
  });

  it('brings a command committed after the cursor even when it was issued earlier', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, first).add(entreeDemo.id, second).add(entreeDemo.id, committedLate));

    const response = await listCommands(`?afterSequence=${second.sequence}`);

    expect(response.json()).toEqual([committedLate]);
  });

  it('answers nothing new when the cursor is the last command', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, first));

    expect((await listCommands('?afterSequence=1')).json()).toEqual([]);
  });

  it('reads the largest sequence Postgres can store', async () => {
    const feed = new FakeGateCommandFeed();
    startServer(feed);

    expect((await listCommands('?afterSequence=2147483647')).statusCode).toBe(200);
    expect(feed.requestedSequences).toEqual([2_147_483_647]);
  });

  it('refuses a request without a valid device key', async () => {
    startServer(new FakeGateCommandFeed().add(entreeDemo.id, first));

    const response = await server.inject({ method: 'GET', url: '/v1/gates/me/commands' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'DEVICE_KEY_REFUSED' });
  });

  it.each([
    ['a negative number', '?afterSequence=-1'],
    ['a decimal', '?afterSequence=1.5'],
    ['a word', '?afterSequence=latest'],
    ['an exponent', '?afterSequence=1e3'],
    ['a signed number', '?afterSequence=%2B1'],
    ['an empty value', '?afterSequence='],
    ['a value past the Postgres integer', '?afterSequence=2147483648'],
    
    ['the cursor mixed with after', `?afterSequence=1&after=${first.issuedAt}`],
    ['the cursor mixed with afterId', `?afterSequence=1&afterId=${first.id}`],
    ['the old cursor alone', `?after=${first.issuedAt}&afterId=${first.id}`],
  ])('refuses %s with 400 and no commands', async (_case, query) => {
    const feed = new FakeGateCommandFeed().add(entreeDemo.id, first);
    startServer(feed);

    const response = await listCommands(query);

    expect(response.statusCode).toBe(400);
    expect(response.json()).not.toBeInstanceOf(Array);
    expect(response.json()).toHaveProperty('error');
    expect(feed.requestedSequences).toEqual([]);
  });

  it('refuses a repeated cursor at the schema with 400 and no commands', async () => {
    const feed = new FakeGateCommandFeed().add(entreeDemo.id, first);
    startServer(feed);

    const response = await listCommands('?afterSequence=1&afterSequence=2');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'FST_ERR_VALIDATION' });
    expect(feed.requestedSequences).toEqual([]);
  });

  it('names the refused cursor with CURSOR_INVALID', async () => {
    startServer(new FakeGateCommandFeed());

    expect((await listCommands('?afterSequence=-1')).json()).toMatchObject({ statusCode: 400, error: 'CURSOR_INVALID' });
  });
});
