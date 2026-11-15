import { afterEach, describe, expect, it } from 'vitest';
import type { CreatedGate, DashboardLotGates } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotGateRepository } from './fakes/fakeLotGateRepository.ts';
import { entreePrincipale, lotGateRoutesOf, settingsOf, type LotGateRoutes } from './fakes/lotGateRoutes.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';

// QA round 1 of #67: what an operator can type into the gate form, or send around it.
describe('gate names and endpoints under attack (QA #67)', () => {
  let server: FastifyInstance;
  let gates: FakeLotGateRepository;
  let routes: LotGateRoutes;

  afterEach(() => server.close());

  async function pierreOnGarageRoy(): Promise<Cookies> {
    ({ server, lotGates: gates } = startDashboardServer());
    routes = lotGateRoutesOf(server);
    return dashboardCookieFor(server, pierre);
  }

  function garageRoyGateCount(): number {
    return gates.gates.filter(({ lotId }) => lotId === GARAGE_ROY_ID).length;
  }

  // Found live: the dashboard listed three gates all reading « Entrée principale », and printed a QR for each.
  it.each([
    ['its accent spelled as a combining mark (NFD)', 'Entrée principale'.normalize('NFD')],
    ['two spaces between its words', 'Entrée  principale'],
    ['a no-break space between its words', 'Entrée principale'],
  ])('refuses a gate whose name reads the same as one already in the lot, with %s, as 409 GATE_NAME_TAKEN', async (_case, lookalike) => {
    const cookies = await pierreOnGarageRoy();
    await routes.addGate(cookies, entreePrincipale);

    const refused = await routes.addGate(cookies, { ...entreePrincipale, name: lookalike });

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'GATE_NAME_TAKEN' });
  });

  // Found live: « https:controle.garageroy.ca » was stored and listed exactly as typed.
  it.each(['https:controle.garageroy.ca', 'https:/controle.garageroy.ca'])('never lists %s as the controller address: refused, or kept as https://', async (typed) => {
    const cookies = await pierreOnGarageRoy();

    const answered = await routes.addGate(cookies, { ...entreePrincipale, endpoint: typed });

    if (answered.statusCode === 400) {
      expect(answered.json()).toMatchObject({ error: 'GATE_ENDPOINT_NOT_HTTPS' });
      return;
    }
    const listed = answered.json<CreatedGate>().lotGates?.gates.find(({ name }) => name === entreePrincipale.name);
    expect(listed?.endpoint?.startsWith('https://')).toBe(true);
  });

  it.each([
    ['a javascript: address', 'javascript:alert(1)'],
    ['a data: address', 'data:text/html,<script>alert(1)</script>'],
    ['an address holding a user name only', 'https://pierre@controle.garageroy.ca'],
    ['an https scheme with no host', 'https://'],
    ['an address hiding a zero-width space', 'https://controle​.garageroy.ca'],
  ])('refuses %s with 400 GATE_ENDPOINT_NOT_HTTPS and adds nothing', async (_case, endpoint) => {
    const cookies = await pierreOnGarageRoy();
    const before = garageRoyGateCount();

    const refused = await routes.addGate(cookies, { ...entreePrincipale, endpoint });

    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ error: 'GATE_ENDPOINT_NOT_HTTPS' });
    expect(garageRoyGateCount()).toBe(before);
  });

  it.each([
    ['loops sent as the text "false"', { reportsLoops: 'false' }],
    ['loops sent as 0', { reportsLoops: 0 }],
    ['a name sent as a number', { name: 12345 }],
    ['a direction in lower case', { kind: 'entry' }],
    ['the reader column name instead of the dashboard word', { kind: 'EXIT', exitIdentification: 'ANPR' }],
  ])('refuses %s with 400 and adds nothing', async (_case, change) => {
    const cookies = await pierreOnGarageRoy();
    const before = garageRoyGateCount();

    const refused = await routes.addGate(cookies, { ...entreePrincipale, ...change });

    expect(refused.statusCode).toBe(400);
    expect(garageRoyGateCount()).toBe(before);
  });

  it('keeps a name with emoji, quotes and markup as typed, and lists it as text', async () => {
    const cookies = await pierreOnGarageRoy();
    const name = `Entrée 🚗 ' OR 1=1 -- <b>`;

    const added = await routes.addGate(cookies, { ...entreePrincipale, name });

    expect(added.statusCode).toBe(201);
    const listed = (await routes.readGates(cookies)).json<DashboardLotGates>();
    expect(listed.gates.some((gate) => gate.name === name)).toBe(true);
  });

  it('changes a gate addressed by its id in upper case, as Postgres reads it', async () => {
    const cookies = await pierreOnGarageRoy();
    const { gateId } = (await routes.addGate(cookies, entreePrincipale)).json<CreatedGate>();

    const changed = await routes.changeGate(cookies, gateId.toUpperCase(), { ...settingsOf(entreePrincipale), name: 'Entrée Est' });

    expect(changed.statusCode).toBe(200);
    expect(changed.json<DashboardLotGates>().gates.find(({ id }) => id === gateId)?.name).toBe('Entrée Est');
  });
});
