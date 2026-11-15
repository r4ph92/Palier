import { writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LotPublication } from '@palier/shared-types';
import { connectToDatabase, type DatabaseConnection } from '../../src/infrastructure/postgres/database.ts';
import { PostgresSessionTokenRepository } from '../../src/infrastructure/postgres/PostgresSessionTokenRepository.ts';
import { PostgresUserDirectory } from '../../src/infrastructure/postgres/PostgresUserDirectory.ts';
import { LoadDriverTokens } from '../../src/load/loadDriverTokens.ts';
import { callerOf, type Answer, type Gate } from './fakes/liveLaneQa68.ts';

// QA #68 against the running lane: QA68_API_URL=http://127.0.0.1:3066 QA68_DATABASE_URL=postgres://…/palier_l66 npx vitest run test/unit/goLiveLiveQa68.test.ts
// It needs Garage Roy Nord set up as the QA brief says (Pierre's lot, pricing, 4 spots, Entrée Nord and Sortie Nord, Garages Roy VERIFIED).
// It rotates both gates' device keys and writes the last ones to QA68_KEYS_FILE; it leaves the lot offline with every prerequisite met.
const API = process.env['QA68_API_URL'] ?? '';
const DATABASE_URL = process.env['QA68_DATABASE_URL'] ?? '';
const KEYS_FILE = process.env['QA68_KEYS_FILE'];
const PIERRE_ID = '00000000-0000-4000-8000-000000000602';
const SOPHIE_ID = '00000000-0000-4000-8000-000000000601';
const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const GARAGE_ROY_ID = '00000000-0000-4000-8000-000000000202';
// Load drivers with a plate and a card; the test sign-in route only knows the personas.
const HOLDER_ID = '00000000-0000-4000-8000-000000000536';
const ENTRANT_ID = '00000000-0000-4000-8000-000000000537';

describe.skipIf(API === '' || DATABASE_URL === '')('go-live on the running lane (QA #68)', () => {
  let connection: DatabaseConnection;
  let tokens: LoadDriverTokens;
  let pierre: string;
  let sophie: string;
  let julie: string;
  let holder: string;
  let entrant: string;
  let lotId: string;
  const entree: Gate = { id: '', key: '' };
  const sortie: Gate = { id: '', key: '' };

  const lane = callerOf(API);
  const asPierre = (method: string, path: string, body?: unknown) => lane.dashboard(pierre)(method, path, body);
  const asSophie = (method: string, path: string, body?: unknown) => lane.dashboard(sophie)(method, path, body);
  const asGate = (gate: Gate, action: string, body?: unknown) => lane.gate(gate, action, body);
  const publication = async () => (await asPierre('GET', `/lots/${lotId}/publication`)).body as unknown as LotPublication;
  const setOnline = (online: boolean) => asPierre('PUT', `/lots/${lotId}/online`, { online });
  const attestWifi = (body: unknown) => asPierre('PUT', `/lots/${lotId}/attestations/wifi`, body);
  const rows = async <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) => connection.database.execute<T>(query);
  const verifiedAtOf = async (gate: Gate) => (await rows<{ verified_at: string | null }>(sql`select verified_at::text from gate where id = ${gate.id}`))[0]?.verified_at ?? null;
  const isOnline = async () => (await rows<{ is_online: boolean }>(sql`select is_online from parking_lot where id = ${lotId}`))[0]?.is_online;

  async function rotate(gate: Gate): Promise<Answer> {
    const answer = await asPierre('POST', `/lots/${lotId}/gates/${gate.id}/device-key`);
    gate.key = String(answer.body['deviceKey']);
    return answer;
  }

  async function verify(gate: Gate): Promise<void> {
    expect((await asGate(gate, 'heartbeat')).status).toBe(204);
    expect((await asGate(gate, 'test-passage')).status).toBe(200);
  }

  beforeAll(async () => {
    connection = connectToDatabase(DATABASE_URL, 2);
    tokens = new LoadDriverTokens({ users: new PostgresUserDirectory(connection.database), sessions: new PostgresSessionTokenRepository(connection.database) });
    [holder, entrant] = (await tokens.signIn([HOLDER_ID, ENTRANT_ID])) as [string, string];
    [pierre, sophie] = [await lane.dashboardCookieOf(PIERRE_ID), await lane.dashboardCookieOf(SOPHIE_ID)];
    julie = String((await lane.call('/v1/test/sign-in', { method: 'POST', body: { driverId: JULIE_ID } })).body['token']);
    const lots = (await asPierre('GET', '/lots')).body as unknown as { id: string; name: string }[];
    lotId = lots.find(({ name }) => name === 'Garage Roy Nord')?.id ?? '';
    const gates = (await publication()).gates;
    entree.id = gates.find(({ kind }) => kind === 'ENTRY')?.id ?? '';
    sortie.id = gates.find(({ kind }) => kind === 'EXIT')?.id ?? '';
    await rotate(entree);
    await rotate(sortie);
    await setOnline(false);
  });

  afterAll(async () => {
    await setOnline(false);
    await verify(entree);
    await verify(sortie);
    if (KEYS_FILE !== undefined) {
      writeFileSync(KEYS_FILE, `GARAGE_ROY_NORD=${lotId}\nENTREE_NORD=${entree.id}\nENTREE_NORD_KEY=${entree.key}\nSORTIE_NORD=${sortie.id}\nSORTIE_NORD_KEY=${sortie.key}\n`);
    }
    await tokens.revokeAll();
    await connection.close();
  });

  it('shows Pierre every prerequisite of Garage Roy Nord, each gate with its verified date', async () => {
    const checklist = await publication();

    expect(checklist).toMatchObject({ lotName: 'Garage Roy Nord', stripe: { kycStatus: 'VERIFIED' }, pricing: { dailyCapCents: 2500 }, spots: { inServiceCount: 4, capacity: 4 } });
    expect(checklist.gates.map(({ kind }) => kind)).toEqual(['ENTRY', 'EXIT']);
  });

  it('verifies a gate from its own heartbeat and test passage, with the date, and counts no vehicle', async () => {
    const [before] = await rows<{ vehicle_count: number; passages: number }>(
      sql`select vehicle_count, (select count(*)::int from gate_passage where lot_id = ${lotId}) as passages from parking_lot where id = ${lotId}`,
    );

    expect((await asGate(entree, 'heartbeat')).status).toBe(204);
    const passed = await asGate(entree, 'test-passage');

    expect(passed.status).toBe(200);
    expect((await publication()).gates.find(({ id }) => id === entree.id)?.verifiedAt).toBe(passed.body['verifiedAt']);
    const [after] = await rows<{ vehicle_count: number; passages: number }>(
      sql`select vehicle_count, (select count(*)::int from gate_passage where lot_id = ${lotId}) as passages from parking_lot where id = ${lotId}`,
    );
    expect(after).toEqual(before);
  });

  it('refuses the test passage of a gate last heard more than two minutes ago, and leaves it unverified', async () => {
    await rotate(sortie);
    await rows(sql`update gate set last_heartbeat_at = now() - interval '121 seconds' where id = ${sortie.id}`);

    const refused = await asGate(sortie, 'test-passage');

    expect([refused.status, refused.body['error']]).toEqual([409, 'GATE_NOT_HEARD']);
    expect(await verifiedAtOf(sortie)).toBeNull();
  });

  it('clears the verification when the device key is rotated, and the old key is refused', async () => {
    await verify(entree);
    const oldKey = entree.key;

    await rotate(entree);

    expect(await verifiedAtOf(entree)).toBeNull();
    expect((await asGate({ id: entree.id, key: oldKey }, 'test-passage')).status).toBe(401);
  });

  it('makes the controller behind a rotated key send its own heartbeat before its test passage verifies the gate', async () => {
    expect((await asGate(entree, 'heartbeat')).status).toBe(204);
    await rotate(entree);

    const passed = await asGate(entree, 'test-passage');

    expect([passed.status, passed.body['error']]).toEqual([409, 'GATE_NOT_HEARD']);
    expect(await verifiedAtOf(entree)).toBeNull();
  });

  it('keeps the verification on a rename and clears it when the loops change', async () => {
    await verify(entree);
    const settings = { name: 'Entrée Nord', integrationKind: 'SIMULATED', endpoint: null, reportsLoops: true, exitIdentification: 'NONE' };

    await asPierre('PUT', `/lots/${lotId}/gates/${entree.id}`, { ...settings, name: 'Entrée Nord QA68' });
    const afterRename = await verifiedAtOf(entree);
    await asPierre('PUT', `/lots/${lotId}/gates/${entree.id}`, { ...settings, reportsLoops: false });
    const afterLoops = await verifiedAtOf(entree);
    await asPierre('PUT', `/lots/${lotId}/gates/${entree.id}`, settings);

    expect(afterRename).not.toBeNull();
    expect(afterLoops).toBeNull();
  });

  it('refuses to publish with 409 LOT_NOT_READY while a gate is unverified, names it, and the lot stays offline', async () => {
    await verify(sortie);

    const refused = await setOnline(true);

    expect([refused.status, refused.body['error']]).toEqual([409, 'LOT_NOT_READY']);
    expect((await publication()).missing).toEqual([{ code: 'GATE_UNVERIFIED', gateId: entree.id }]);
    expect(await isOnline()).toBe(false);
  });

  it('refuses a Wi-Fi measure from tomorrow, blank, invisible or over 300 characters, and stores a valid day at Montréal’s midnight', async () => {
    const answers = await Promise.all(
      [
        { measuredOn: '2026-12-31', note: 'Trois barres' },
        { measuredOn: '2026-11-14', note: ' \t ' },
        { measuredOn: '2026-11-14', note: '​ㅤ⠀' },
        { measuredOn: '2026-11-14', note: 'é'.repeat(301) },
      ].map(attestWifi),
    );
    const accepted = await attestWifi({ measuredOn: '2026-11-14', note: 'é'.repeat(300) });
    const [stored] = await rows<{ day: string }>(sql`select (wifi_verified_at at time zone 'America/Toronto')::text as day from parking_lot where id = ${lotId}`);
    await attestWifi({ measuredOn: '2026-11-14', note: 'Trois barres aux niveaux P1 et P2.' });

    expect(answers.map(({ body }) => body['error'])).toEqual(['ATTESTATION_DAY_IN_FUTURE', 'ATTESTATION_NOTE_INVALID', 'ATTESTATION_NOTE_INVALID', 'ATTESTATION_NOTE_INVALID']);
    expect(accepted.status).toBe(200);
    expect(stored?.day).toBe('2026-11-14 00:00:00');
  });

  it('gives Sophie not found on Pierre’s lot for every go-live route, and nothing changes', async () => {
    const before = await publication();

    const answers = [
      await asSophie('GET', `/lots/${lotId}/publication`),
      await asSophie('PUT', `/lots/${lotId}/online`, { online: true }),
      await asSophie('PUT', `/lots/${lotId}/online`, { online: false }),
      await asSophie('PUT', `/lots/${lotId}/attestations/wifi`, { measuredOn: '2026-11-14', note: 'Sophie' }),
      await asSophie('PUT', `/lots/${lotId}/attestations/cellular`, { measuredOn: '2026-11-14', note: 'Sophie' }),
    ];

    expect(answers.map(({ status, body }) => `${status} ${String(body['error'])}`)).toEqual(Array(5).fill('404 LOT_NOT_FOUND'));
    expect(await publication()).toEqual(before);
  });

  it('keeps the capacity-0 Garage Roy unpublishable, naming its capacity', async () => {
    const checklist = (await asPierre('GET', `/lots/${GARAGE_ROY_ID}/publication`)).body as unknown as LotPublication;

    const refused = await asPierre('PUT', `/lots/${GARAGE_ROY_ID}/online`, { online: true });

    expect(checklist.missing.map(({ code }) => code)).toContain('CAPACITY_ZERO');
    expect(refused.status).toBe(409);
  });

  it('lists the lot for Julie once published; unpublished, it leaves her list, frees the hold, refuses new entries and holds, and an exit still counts', async () => {
    await verify(entree);
    await verify(sortie);

    expect((await setOnline(true)).status).toBe(200);
    const listedOnline = (await lane.driver(julie).get('/v1/lots')).body as unknown as { name: string }[];
    const hold = await lane.driver(holder).post(`/v1/lots/${lotId}/holds`);
    const entryPassage = await asGate(entree, 'passage', { closedAt: new Date().toISOString() });

    expect((await setOnline(false)).status).toBe(200);
    const listedOffline = (await lane.driver(julie).get('/v1/lots')).body as unknown as { name: string }[];
    const [heldSpot] = await rows<{ status: string; state: string }>(
      sql`select spot_hold.status, spot.state from spot_hold join spot on spot.id = spot_hold.spot_id where spot_hold.id = ${String(hold.body['spotHoldId'])}`,
    );
    await asGate(entree, 'heartbeat');
    const qrContent = String((await asPierre('GET', `/lots/${lotId}/gates/${entree.id}/qr-link`)).body['link']);
    const entry = await lane.driver(entrant).post('/v1/entries', { qrContent });
    const newHold = await lane.driver(entrant).post(`/v1/lots/${lotId}/holds`);
    const exitPassage = await asGate(sortie, 'passage', { closedAt: new Date().toISOString() });

    expect(listedOnline.map(({ name }) => name)).toContain('Garage Roy Nord');
    expect(hold.status).toBe(201);
    expect(listedOffline.map(({ name }) => name)).not.toContain('Garage Roy Nord');
    expect(heldSpot).toEqual({ status: 'RELEASED', state: 'AVAILABLE' });
    expect([entry.status, entry.body['error']]).toEqual([409, 'LOT_NOT_IN_SERVICE']);
    expect([newHold.status, newHold.body['error']]).toEqual([409, 'LOT_NOT_IN_SERVICE']);
    expect(exitPassage.status).toBe(200);
    expect(exitPassage.body['vehicleCount']).toBe(Number(entryPassage.body['vehicleCount']) - 1);
  });
});
