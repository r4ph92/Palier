import { describe, expect, it } from 'vitest';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { PostgresParkedPresumptionRepository } from '../../src/infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresPassageLedger } from '../../src/infrastructure/postgres/PostgresPassageLedger.ts';
import { PostgresSilentSessionRepository } from '../../src/infrastructure/postgres/PostgresSilentSessionRepository.ts';
import { PostgresUnconfirmedEntryRepository } from '../../src/infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';
import { SimulatedGateCommander } from '../../src/infrastructure/postgres/SimulatedGateCommander.ts';
import { appendedSessionEvents, builtPayloadKeys } from './fakes/appendedSessionEvents.ts';
import { entreeDemo } from './fakes/gateFixtures.ts';
import { PARKING_DEMO_OCCUPANCY_ROW, ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const DRIVER_ID = '00000000-0000-4000-8000-000000000501';
const LOT_ID = entreeDemo.lotId;
const NOW = new Date('2026-11-14T18:00:00Z');
const WINDOW = { withinMilliseconds: 60_000 };
const spotRow = { id: 'spot-a1', number: 'A-1', aisle_code: 'A', level_code: 'P1' };
const walkFacts = { state: 'ENTRY_CONFIRMED', parked_at: null, lot_id: LOT_ID, assigned_spot_id: 'spot-a1', assigned_aisle_id: 'aisle-a' };
const PARKED_AT = { parked_at: NOW.toISOString() };

type LoggedPayloads = [kind: string, keys: string[]][];

// A statement that writes its step and its events together binds the detected aisle as JSON and builds the presumption in SQL.
function loggedPayloads(scripted: ScriptedSql): LoggedPayloads {
  const appended: LoggedPayloads = appendedSessionEvents(scripted).map(({ kind, payload }) => [String(kind), Object.keys(payload).sort()]);
  const built: LoggedPayloads = scripted.statements
    .filter(({ label }) => label !== 'append-session-event' && label !== 'read-walk-facts')
    .flatMap(({ text, params }) => [
      ...params.filter((param) => typeof param === 'string' && param.startsWith('{')).map((json): [string, string[]] => ['AISLE_DETECTED', Object.keys(JSON.parse(String(json)) as object).sort()]),
      ...builtPayloadKeys(text).map((keys): [string, string[]] => ['PARKING_PRESUMED', keys.sort()]),
    ]);
  return [...appended, ...built];
}

const steps: [string, () => Promise<ScriptedSql>][] = [
  ['the scan', async () => {
    const scripted = new ScriptedSql().answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW]).answer('read-free-spots', [{ ...spotRow, level_order: 1, distance_to_exit: 1, needs_check: false, is_ev: false, is_accessible: false, is_oversize: false }]).answer('claim-spot', [spotRow]).answer('insert-session', [{ id: SESSION_ID }]);
    await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).openOrReplay({
      driverId: DRIVER_ID, now: NOW, vehicleId: 'vehicle', plate: 'ABC 123', needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
      lotId: LOT_ID, entryGateId: entreeDemo.id, authorizedCents: 2500, pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 }, cardLast4: '4242',
    });
    return scripted;
  }],
  ['the opening', async () => {
    const scripted = new ScriptedSql().answer('insert-gate-command', [{ id: 'command' }]);
    await new SimulatedGateCommander(scripted.database()).open({ gateId: entreeDemo.id, lotId: LOT_ID, sessionId: SESSION_ID });
    return scripted;
  }],
  ['the loop', async () => {
    const scripted = new ScriptedSql().answer('count-vehicle', [{ vehicle_count: 1 }]).answer('confirm-opening', [{ id: SESSION_ID, assigned_spot_id: 'spot-a1' }]);
    await new PostgresPassageLedger(scripted.database()).recordPassage({ gate: entreeDemo, closedAt: NOW, vehicleCountChange: 1, confirmableOpenings: WINDOW, attachableOpenings: null });
    return scripted;
  }],
  ['the walk in the assigned aisle', async () => {
    const scripted = new ScriptedSql().answer('read-walk-facts', [{ ...walkFacts, detected_aisle_id: 'aisle-a', detected_aisle_code: 'A', detected_aisle_minor: 1 }]).answer('presume-parked', [PARKED_AT]);
    await new PostgresParkedPresumptionRepository(scripted.database()).presume({ sessionId: SESSION_ID, driverId: DRIVER_ID, detectedAt: NOW, detectedAisleMinor: 1 });
    return scripted;
  }],
  ['the walk in another aisle', async () => {
    const scripted = new ScriptedSql().answer('read-walk-facts', [{ ...walkFacts, detected_aisle_id: 'aisle-b', detected_aisle_code: 'B', detected_aisle_minor: 2 }]).answer('ask-where-parked', [{ ...PARKED_AT, assigned_spot_id: 'spot-a1' }]).answer('flag-assigned-spot', [{ id: 'spot-a1' }]);
    await new PostgresParkedPresumptionRepository(scripted.database()).presume({ sessionId: SESSION_ID, driverId: DRIVER_ID, detectedAt: NOW, detectedAisleMinor: 2 });
    return scripted;
  }],
  ['the answer', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot', [{ lot_id: LOT_ID }]).answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', assigned_spot_id: 'spot-a1', assigned_spot_state: 'OCCUPIED_UNKNOWN', number: null, aisle_code: null, level_code: null }]).answer('lock-answered-spot', [{ ...spotRow, id: 'spot-b3', number: 'B-3', state: 'AVAILABLE' }]).answer('occupy-answered-spot', [{ id: 'spot-b3' }]).answer('confirm-parked-spot', [{ id: SESSION_ID }]);
    await new PostgresParkedAnswerRepository(scripted.database()).answer({ sessionId: SESSION_ID, driverId: DRIVER_ID, spotNumber: 'B-3' });
    return scripted;
  }],
  ['the silence', async () => {
    const scripted = new ScriptedSql();
    await new PostgresSilentSessionRepository(scripted.database()).presumeLotSilentSessions(LOT_ID, { cutoff: NOW, now: NOW });
    return scripted;
  }],
  ['the cancellations', async () => {
    const scripted = new ScriptedSql().answer('cancel-session', [{ assigned_spot_id: 'spot-a1', consumed_spot_hold_id: null }], [{ assigned_spot_id: 'spot-a1', consumed_spot_hold_id: null }]).answer('read-session-lot', [{ lot_id: LOT_ID }]);
    await new PostgresUnconfirmedEntryRepository(scripted.database(), () => NOW).cancel({ sessionId: SESSION_ID, lotId: LOT_ID });
    await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).cancel(SESSION_ID);
    return scripted;
  }],
];

async function everyLoggedPayload(): Promise<LoggedPayloads> {
  const payloads: LoggedPayloads = [];
  for (const [, run] of steps) {
    payloads.push(...loggedPayloads(await run()));
  }
  return payloads;
}

describe('what the visit log keeps (story #156)', () => {
  it('logs each kind with exactly its own step facts', async () => {
    const byKind = new Map((await everyLoggedPayload()).map(([kind, keys]) => [`${kind} ${keys.join(',')}`, keys]));

    expect([...byKind.keys()].sort()).toEqual([
      'AISLE_DETECTED aisleCode,aisleId,beaconMinor,isAssignedAisle',
      'ENTRY_CANCELLED opened,reason',
      'ENTRY_CANCELLED reason',
      'ENTRY_LOOP_CLOSED gateId',
      'ENTRY_SCANNED aisleCode,gateId,levelCode,plate,spotId,spotNumber',
      'GATE_OPENED commandId,direction,gateId',
      'PARKING_CONFIRMED spotId,spotNumber',
      'PARKING_PRESUMED evidence,spotId,spotNumber',
    ]);
  });

  it('never keeps an email, a card, a Stripe or payment id, or a user id', async () => {
    const keys = (await everyLoggedPayload()).flatMap(([, payloadKeys]) => payloadKeys);

    expect(keys.filter((key) => /email|stripe|payment|card|user|last4/i.test(key))).toEqual([]);
  });
});
