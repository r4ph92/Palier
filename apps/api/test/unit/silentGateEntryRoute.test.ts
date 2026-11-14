import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { EntryGate } from '../../src/domain/entries/EntryGateRepository.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { configureServer } from './configureServer.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate, FakeEntryGateRepository, SORTIE_DEMO_SECRET, sortieDemoGate } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const NOW = new Date('2026-11-13T19:05:00Z');
const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

function beatSecondsBefore(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

describe('POST /v1/entries at a gate whose controller stopped beating', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWith(gate: EntryGate) {
    const configured = configureServer({ entryClock: () => NOW, entryGates: new FakeEntryGateRepository([gate]) });
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const enter = (qrContent: string) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent } });
    return { ...configured, enter };
  }

  it('refuses Julie at Entrée Démo silent for more than 2 minutes: 503 GATE_SILENT, no spot, no authorization, no barrier', async () => {
    const { enter, entries } = await startWith({ ...entreeDemoGate, lastHeartbeatAt: beatSecondsBefore(121) });

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ statusCode: 503, error: 'GATE_SILENT', message: 'This terminal stopped answering; entry is not possible.' });
    expect(entries.journal).toEqual([]);
    expect(entries.payments.authorized).toEqual([]);
    expect(entries.gateCommander.opened).toEqual([]);
  });

  it.each([
    ['beat exactly 2 minutes ago', beatSecondsBefore(120)],
    ['never beat at all', null],
  ])('admits Julie at a gate that %s', async (_case, lastHeartbeatAt) => {
    const { enter, entries } = await startWith({ ...entreeDemoGate, lastHeartbeatAt });

    expect((await enter(entreeDemoQr)).statusCode).toBe(201);
    expect(entries.payments.authorized).toHaveLength(1);
  });

  it('names the silent gate before the room: a full lot still answers GATE_SILENT', async () => {
    const { enter } = await startWith({ ...entreeDemoGate, lastHeartbeatAt: beatSecondsBefore(600), lot: { ...entreeDemoGate.lot, vehicleCount: 10 } });

    expect((await enter(entreeDemoQr)).json()).toMatchObject({ error: 'GATE_SILENT' });
  });

  it('still names a silent exit gate as not an entry', async () => {
    const { enter } = await startWith({ ...sortieDemoGate, lastHeartbeatAt: beatSecondsBefore(600) });

    expect((await enter(gateQrLink(sortieDemoGate.id, SORTIE_DEMO_SECRET))).json()).toMatchObject({ error: 'NOT_AN_ENTRY_GATE' });
  });
});
