import { describe, expect, it } from 'vitest';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresPassageLedger } from '../../src/infrastructure/postgres/PostgresPassageLedger.ts';
import { SimulatedGateCommander } from '../../src/infrastructure/postgres/SimulatedGateCommander.ts';
import { appendedSessionEvents, onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { entreeDemo } from './fakes/gateFixtures.ts';
import { PARKING_DEMO_OCCUPANCY_ROW, ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const COMMAND_ID = '00000000-0000-4000-8000-000000000961';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const WINDOW = { withinMilliseconds: 60_000 };
const CLOSED_AT = new Date('2026-11-14T18:01:00Z');

const julieAtEntreeDemo: SessionDraft = {
  driverId: '00000000-0000-4000-8000-000000000501',
  now: new Date('2026-11-14T18:00:00Z'),
  vehicleId: '00000000-0000-4000-8000-000000000601',
  plate: 'ABC 123',
  needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
  lotId: entreeDemo.lotId,
  entryGateId: entreeDemo.id,
  authorizedCents: 2500,
  pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
  cardLast4: '4242',
};

const freeA1 = { id: SPOT_A1_ID, number: 'A-1', level_order: 1, aisle_code: 'A', distance_to_exit: 1, needs_check: false, is_ev: false, is_accessible: false, is_oversize: false };

function julieScans(): ScriptedSql {
  return new ScriptedSql()
    .answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW])
    .answer('read-free-spots', [freeA1])
    .answer('claim-spot', [{ id: SPOT_A1_ID, number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
    .answer('insert-session', [{ id: SESSION_ID }]);
}

function scanWith(scripted: ScriptedSql) {
  return new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => julieAtEntreeDemo.now).openOrReplay(julieAtEntreeDemo);
}

function activeSessionRow(state: string, gateId: string = entreeDemo.id) {
  return { id: SESSION_ID, lot_id: entreeDemo.lotId, entry_gate_id: gateId, state, is_within_opening_window: true, number: 'A-1', aisle_code: 'A', level_code: 'P1' };
}

describe('Julie scans Entrée Démo and gets A-1 (story #156)', () => {
  it('logs the scan after the session insert, in the scan transaction', async () => {
    const scripted = julieScans();

    await scanWith(scripted);

    expect(scripted.labels().slice(-2)).toEqual(['insert-session', 'append-session-event']);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('insert-session'));
    expect(scripted.transactionsOf('append-session-event')).toEqual([expect.any(Number)]);
  });

  it('keeps the plate, the gate and the assigned spot, and nothing else', async () => {
    const scripted = julieScans();

    await scanWith(scripted);

    const scan = onlyAppendedSessionEvent(scripted);
    expect(scan.kind).toBe('ENTRY_SCANNED');
    expect(scan.payload).toEqual({ plate: 'ABC 123', gateId: entreeDemo.id, spotId: SPOT_A1_ID, spotNumber: 'A-1', aisleCode: 'A', levelCode: 'P1' });
    expect([scan.sessionId, scan.lotId]).toEqual([SESSION_ID, entreeDemo.lotId]);
  });

  it('dates the scan with the entry_scan_at the session stored', async () => {
    const scripted = julieScans();

    await scanWith(scripted);

    expect(onlyAppendedSessionEvent(scripted).occurredAtText).toMatch(/select "entry_scan_at" from parking_session where id = \$\d+/);
  });

  it('logs nothing when the lot is full and no session is created', async () => {
    const scripted = new ScriptedSql().answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW]);

    await expect(scanWith(scripted)).resolves.toBeNull();
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('a scan that opens no session (story #156)', () => {
  it('logs nothing for the same entry handed back by a double scan', async () => {
    const scripted = new ScriptedSql().answer('read-active-session', [activeSessionRow('CREATED')]);

    await expect(scanWith(scripted)).resolves.toMatchObject({ kind: 'replayed' });
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it('logs nothing when the scan is refused « Vous avez déjà une entrée en cours »', async () => {
    const scripted = new ScriptedSql().answer('read-active-session', [activeSessionRow('ENTRY_CONFIRMED')]);

    await expect(scanWith(scripted)).rejects.toMatchObject({ reason: 'ALREADY_INSIDE' });
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('the barrier opening for Julie (story #156)', () => {
  function openFor(scripted: ScriptedSql) {
    return new SimulatedGateCommander(scripted.database()).open({ gateId: entreeDemo.id, lotId: entreeDemo.lotId, sessionId: SESSION_ID });
  }

  it('stores the OPEN command and logs it in one transaction', async () => {
    const scripted = new ScriptedSql().answer('insert-gate-command', [{ id: COMMAND_ID }]);

    await openFor(scripted);

    expect(scripted.labels()).toEqual(['insert-gate-command', 'append-session-event']);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('insert-gate-command'));
    expect(scripted.transactionsOf('insert-gate-command')).toEqual([expect.any(Number)]);
    expect(scripted.statement('insert-gate-command')?.params).toEqual([entreeDemo.id, entreeDemo.lotId, SESSION_ID]);
  });

  it('marks the opening as an entry, at the time the command was issued', async () => {
    const scripted = new ScriptedSql().answer('insert-gate-command', [{ id: COMMAND_ID }]);

    await openFor(scripted);

    const opening = onlyAppendedSessionEvent(scripted);
    expect(opening.kind).toBe('GATE_OPENED');
    expect(opening.payload).toEqual({ direction: 'ENTRY', gateId: entreeDemo.id, commandId: COMMAND_ID });
    expect(opening.occurredAtText).toMatch(/select issued_at from gate_command where id = \$\d+/);
  });

  it('fails without logging when the command was not stored', async () => {
    const scripted = new ScriptedSql();

    await expect(openFor(scripted)).rejects.toThrow('The gate command was not stored.');
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('the console closing the entry loop (story #156)', () => {
  function closeLoop(scripted: ScriptedSql) {
    return new PostgresPassageLedger(scripted.database()).recordPassage({
      gate: entreeDemo,
      closedAt: CLOSED_AT,
      vehicleCountChange: 1,
      confirmableOpenings: WINDOW,
      attachableOpenings: null,
    });
  }

  function loopConfirmingJulie(): ScriptedSql {
    return new ScriptedSql().answer('count-vehicle', [{ vehicle_count: 1 }]).answer('confirm-opening', [{ id: SESSION_ID, assigned_spot_id: SPOT_A1_ID }]);
  }

  it('logs the loop in the passage transaction, after the confirmation and the spot', async () => {
    const scripted = loopConfirmingJulie();

    await closeLoop(scripted);

    expect(scripted.labels()).toEqual(['count-vehicle', 'confirm-opening', 'occupy-confirmed-spot', 'append-session-event']);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber)).size).toBe(1);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('confirm-opening'));
  });

  it('logs the gate at the closing time the confirmation stored', async () => {
    const scripted = loopConfirmingJulie();

    await closeLoop(scripted);

    const loop = onlyAppendedSessionEvent(scripted);
    expect(loop.kind).toBe('ENTRY_LOOP_CLOSED');
    expect(loop.payload).toEqual({ gateId: entreeDemo.id });
    expect([loop.sessionId, loop.lotId]).toEqual([SESSION_ID, entreeDemo.lotId]);
    expect(loop.occurredAtText).toMatch(/select "entry_confirmed_at" from parking_session where id = \$\d+/);
    expect(scripted.statement('confirm-opening')?.params).toContain(CLOSED_AT.toISOString());
  });

  it('logs nothing when the passage confirms no opening', async () => {
    const scripted = new ScriptedSql().answer('count-vehicle', [{ vehicle_count: 1 }]);

    await expect(closeLoop(scripted)).resolves.toMatchObject({ confirmedSessionId: null });
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('passages replayed after an offline period (story #156)', () => {
  it('log nothing for any session', async () => {
    const scripted = new ScriptedSql().answer('replay-passages', [{ vehicle_count: 2, counted: 2 }]);

    await new PostgresPassageLedger(scripted.database()).recordReplay({
      gate: entreeDemo,
      passages: [{ id: '11111111-1111-4111-8111-111111111111', closedAt: CLOSED_AT }],
      vehicleCountChange: 1,
    });

    expect(appendedSessionEvents(scripted)).toEqual([]);
    expect(scripted.labels()).toEqual(['lock-lot', 'replay-passages']);
  });
});
