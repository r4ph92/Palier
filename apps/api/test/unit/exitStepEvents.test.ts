import { describe, expect, it } from 'vitest';
import type { ExitClosing, ExitIdentification, PendingExitClosing } from '../../src/domain/exits/ExitRepository.ts';
import { EVENT_RETENTION_HOURS } from '../../src/domain/sessionEvents/SessionEvent.ts';
import { PostgresExitRepository } from '../../src/infrastructure/postgres/PostgresExitRepository.ts';
import { PostgresPassageLedger } from '../../src/infrastructure/postgres/PostgresPassageLedger.ts';
import { PostgresPendingCaptureRepository } from '../../src/infrastructure/postgres/PostgresPendingCaptureRepository.ts';
import { appendedSessionEvents, onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { sortieDemo } from './fakes/gateFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const COMMAND_ID = '00000000-0000-4000-8000-000000000962';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const LOT_ID = sortieDemo.lotId;
const TAPPED_AT = new Date('2026-11-14T21:17:00Z');
const CAPTURED_AT = new Date('2026-11-14T21:17:02Z');
const RETRIED_AT = new Date('2026-11-14T22:05:00Z');
const LOOP_CLOSED_AT = new Date('2026-11-14T21:17:30Z');
const WINDOW = { withinMilliseconds: 60_000 };

const julieTaps: ExitClosing = {
  sessionId: SESSION_ID,
  lotId: LOT_ID,
  exitGateId: sortieDemo.id,
  identification: 'APP',
  exit: { exitedAt: TAPPED_AT, capturedCents: 975, surplusPaidCents: 0, unpaidCents: 0 },
  capturedAt: CAPTURED_AT,
};

const julieTapsWhileStripeIsDown: PendingExitClosing = {
  sessionId: SESSION_ID,
  lotId: LOT_ID,
  exitGateId: sortieDemo.id,
  identification: 'APP',
  exitedAt: TAPPED_AT,
  pendingCaptureCents: 975,
  pendingSurplusCents: 0,
};

function closingJulie(closeLabel: 'close-paid-session' | 'close-pending-session'): ScriptedSql {
  return new ScriptedSql().answer(closeLabel, [{ assigned_spot_id: SPOT_A1_ID, confirmed_spot_id: null }]).answer('insert-gate-command', [{ id: COMMAND_ID }]);
}

function closeWith(scripted: ScriptedSql, closing: ExitClosing = julieTaps) {
  return new PostgresExitRepository(scripted.database()).close(closing);
}

function closePendingWith(scripted: ScriptedSql) {
  return new PostgresExitRepository(scripted.database()).closeWithPendingCapture(julieTapsWhileStripeIsDown);
}

function kindsOf(scripted: ScriptedSql): unknown[] {
  return appendedSessionEvents(scripted).map(({ kind }) => kind);
}

function eventOf(scripted: ScriptedSql, kind: string) {
  return appendedSessionEvents(scripted).find((event) => event.kind === kind);
}

describe('Julie touches « Ouvrir » and Stripe takes the payment (story #157)', () => {
  it('logs the identification, the capture, then the opening, in the close transaction', async () => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted);

    expect(kindsOf(scripted)).toEqual(['EXIT_IDENTIFIED', 'CAPTURED', 'GATE_OPENED']);
    expect(scripted.labels().indexOf('close-paid-session')).toBeLessThan(scripted.labels().indexOf('append-session-event'));
    expect(scripted.labels().slice(-2)).toEqual(['insert-gate-command', 'append-session-event']);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber))).toEqual(new Set(scripted.transactionsOf('close-paid-session')));
  });

  it('identifies the app at the time of the tap the session stored', async () => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted);

    const identified = eventOf(scripted, 'EXIT_IDENTIFIED');
    expect(identified?.payload).toEqual({ method: 'APP', gateId: sortieDemo.id });
    expect([identified?.sessionId, identified?.lotId]).toEqual([SESSION_ID, LOT_ID]);
    expect(identified?.occurredAtText).toMatch(/select "exit_at" from parking_session where id = \$\d+/);
  });

  it('logs the amount captured at the time Stripe confirmed it', async () => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted);

    const captured = scripted.statementsOf('append-session-event')[1];
    expect(eventOf(scripted, 'CAPTURED')?.payload).toEqual({ capturedCents: 975, surplusPaidCents: 0, unpaidCents: 0 });
    expect(eventOf(scripted, 'CAPTURED')?.occurredAtText).toMatch(/from \(select \$\d+::timestamptz as occurred_at\) step$/);
    expect(captured?.params.at(-1)).toBe(CAPTURED_AT.toISOString());
  });

  it('marks the opening as an exit at the time the command was issued', async () => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted);

    const opening = eventOf(scripted, 'GATE_OPENED');
    expect(opening?.payload).toEqual({ direction: 'EXIT', gateId: sortieDemo.id, commandId: COMMAND_ID });
    expect(opening?.occurredAtText).toMatch(/select issued_at from gate_command where id = \$\d+/);
  });

  it('dates the purge of every exit event 2160 hours after its own instant', async () => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted);

    for (const { text, params } of scripted.statementsOf('append-session-event')) {
      expect(text).toContain('step.occurred_at + make_interval(hours => $5::int)');
      expect(params[4]).toBe(EVENT_RETENTION_HOURS);
    }
  });

  it('carries the captured amount and the unpaid balance of a stay over 24 hours whose surplus the card refused', async () => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted, { ...julieTaps, exit: { exitedAt: TAPPED_AT, capturedCents: 2500, surplusPaidCents: 0, unpaidCents: 1800 } });

    expect(eventOf(scripted, 'CAPTURED')?.payload).toEqual({ capturedCents: 2500, surplusPaidCents: 0, unpaidCents: 1800 });
  });
});

describe('how the vehicle was identified at Sortie Démo (story #157)', () => {
  it.each<ExitIdentification>(['PLATE', 'TRANSPONDER', 'BEACON'])('logs %s as the identification method', async (identification) => {
    const scripted = closingJulie('close-paid-session');

    await closeWith(scripted, { ...julieTaps, identification });

    expect(eventOf(scripted, 'EXIT_IDENTIFIED')?.payload).toEqual({ method: identification, gateId: sortieDemo.id });
  });
});

describe('Julie touches « Ouvrir » while Stripe cannot be reached (story #157)', () => {
  it('logs the identification, the pending capture, then the opening, and no capture', async () => {
    const scripted = closingJulie('close-pending-session');

    await closePendingWith(scripted);

    expect(kindsOf(scripted)).toEqual(['EXIT_IDENTIFIED', 'CAPTURE_PENDING', 'GATE_OPENED']);
    expect(new Set(scripted.transactionsOf('append-session-event'))).toEqual(new Set(scripted.transactionsOf('close-pending-session')));
  });

  it('logs the amounts fixed at the tap, dated by the tap', async () => {
    const scripted = closingJulie('close-pending-session');

    await closePendingWith(scripted);

    const pending = eventOf(scripted, 'CAPTURE_PENDING');
    expect(pending?.payload).toEqual({ pendingCaptureCents: 975, pendingSurplusCents: 0 });
    expect(pending?.occurredAtText).toMatch(/select "exit_at" from parking_session where id = \$\d+/);
  });
});

describe('an exit another request already closed (story #157)', () => {
  it('logs nothing for the tap that lost the paid close', async () => {
    const scripted = new ScriptedSql().answer('read-paid-exit', [{ state: 'CLOSED_PAID', exit_at: TAPPED_AT, captured_cents: 975, surplus_paid_cents: 0, unpaid_cents: 0 }]);

    await expect(closeWith(scripted)).resolves.toMatchObject({ outcome: 'already' });
    expect(scripted.count('append-session-event')).toBe(0);
    expect(scripted.count('insert-gate-command')).toBe(0);
  });

  it('logs nothing for the tap that lost the pending close', async () => {
    const scripted = new ScriptedSql();

    await expect(closePendingWith(scripted)).resolves.toEqual({ outcome: 'already' });
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('the retry capturing once Stripe is back (story #157)', () => {
  function retryWith(scripted: ScriptedSql) {
    return new PostgresPendingCaptureRepository(scripted.database()).markPaid(SESSION_ID, { capturedCents: 975, surplusPaidCents: 0, unpaidCents: 0, capturedAt: RETRIED_AT });
  }

  it('logs the capture at the retry time, in the transaction that marks the session paid', async () => {
    const scripted = new ScriptedSql().answer('mark-capture-paid', [{ lot_id: LOT_ID }]);

    await retryWith(scripted);

    const captured = onlyAppendedSessionEvent(scripted);
    expect(scripted.labels()).toEqual(['mark-capture-paid', 'append-session-event']);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('mark-capture-paid'));
    expect([captured.kind, captured.sessionId, captured.lotId]).toEqual(['CAPTURED', SESSION_ID, LOT_ID]);
    expect(captured.payload).toEqual({ capturedCents: 975, surplusPaidCents: 0, unpaidCents: 0 });
    expect(scripted.statement('append-session-event')?.params.at(-1)).toBe(RETRIED_AT.toISOString());
  });

  it('logs nothing when the session is no longer pending: another run paid it', async () => {
    const scripted = new ScriptedSql();

    await retryWith(scripted);

    expect(scripted.labels()).toEqual(['mark-capture-paid']);
  });
});

describe('the console closing the exit loop (story #157)', () => {
  function closeExitLoop(scripted: ScriptedSql) {
    return new PostgresPassageLedger(scripted.database()).recordPassage({
      gate: sortieDemo,
      closedAt: LOOP_CLOSED_AT,
      armedAt: null,
      vehicleCountChange: -1,
      confirmableOpenings: null,
      attachableOpenings: WINDOW,
    });
  }

  it('logs the loop at the closing time the attach stored, in the passage transaction', async () => {
    const scripted = new ScriptedSql().answer('count-vehicle', [{ vehicle_count: 0 }]).answer('attach-exit-passage', [{ id: SESSION_ID }]);

    await closeExitLoop(scripted);

    const loop = onlyAppendedSessionEvent(scripted);
    expect(scripted.labels()).toEqual(['count-vehicle', 'attach-exit-passage', 'append-session-event']);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('attach-exit-passage'));
    expect([loop.kind, loop.sessionId, loop.lotId]).toEqual(['EXIT_LOOP_CLOSED', SESSION_ID, LOT_ID]);
    expect(loop.payload).toEqual({ gateId: sortieDemo.id });
    expect(loop.occurredAtText).toMatch(/select "exit_passage_at" from parking_session where id = \$\d+/);
    expect(scripted.statement('attach-exit-passage')?.params).toContain(LOOP_CLOSED_AT.toISOString());
  });

  it('logs nothing when the passage attaches to no exit', async () => {
    const scripted = new ScriptedSql().answer('count-vehicle', [{ vehicle_count: 0 }]);

    await expect(closeExitLoop(scripted)).resolves.toMatchObject({ exitedSessionId: null });
    expect(scripted.count('append-session-event')).toBe(0);
  });
});
