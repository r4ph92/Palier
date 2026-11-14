import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresUnconfirmedEntryRepository } from '../../src/infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';
import { onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000201';
const NOW = new Date('2026-11-14T18:05:00Z');
const cancelledRow = { assigned_spot_id: '00000000-0000-4000-8000-0000000003a1', consumed_spot_hold_id: null };

function cancelByJob(scripted: ScriptedSql) {
  return new PostgresUnconfirmedEntryRepository(scripted.database(), () => NOW).cancel({ sessionId: SESSION_ID, lotId: LOT_ID });
}

function cancelOnRollback(scripted: ScriptedSql) {
  return new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => NOW).cancel(SESSION_ID);
}

describe('no loop within 60 s after the opening (story #156, decision 013)', () => {
  it('logs the cancellation in the cancellation transaction, after the session and its spot', async () => {
    const scripted = new ScriptedSql().answer('cancel-session', [cancelledRow]).answer('read-barrier-opened', [{ was_barrier_opened: true }]);

    await expect(cancelByJob(scripted)).resolves.toBe(true);

    expect(scripted.labels()).toEqual(['lock-lot', 'cancel-session', 'free-held-spot', 'read-barrier-opened', 'append-session-event']);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber)).size).toBe(1);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('cancel-session'));
  });

  it('logs the reason, at the cancelled_at the session stored', async () => {
    const scripted = new ScriptedSql().answer('cancel-session', [cancelledRow]).answer('read-barrier-opened', [{ was_barrier_opened: true }]);

    await cancelByJob(scripted);

    const cancelled = onlyAppendedSessionEvent(scripted);
    expect(cancelled.kind).toBe('ENTRY_CANCELLED');
    expect(cancelled.payload).toEqual({ reason: 'NO_LOOP', wasBarrierOpened: true });
    expect([cancelled.sessionId, cancelled.lotId]).toEqual([SESSION_ID, LOT_ID]);
    expect(cancelled.occurredAtText).toMatch(/select "cancelled_at" from parking_session where id = \$\d+/);
  });

  it('tells an entry stopped before its barrier, which has no OPEN command', async () => {
    const scripted = new ScriptedSql().answer('cancel-session', [cancelledRow]).answer('read-barrier-opened', [{ was_barrier_opened: false }]);

    await cancelByJob(scripted);

    expect(onlyAppendedSessionEvent(scripted).payload).toEqual({ reason: 'NO_LOOP', wasBarrierOpened: false });
    const read = scripted.statement('read-barrier-opened');
    expect(read?.text).toMatch(/exists \(select 1 from gate_command where session_id = \$1 and kind = 'OPEN'\)/);
    expect(read?.params).toEqual([SESSION_ID]);
  });

  it('logs nothing when the session was no longer waiting for its loop', async () => {
    const scripted = new ScriptedSql();

    await expect(cancelByJob(scripted)).resolves.toBe(false);
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('an entry undone by its own request (story #156)', () => {
  it('logs the failed admission in the cancellation transaction', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot', [{ lot_id: LOT_ID }]).answer('cancel-session', [cancelledRow]);

    await cancelOnRollback(scripted);

    expect(scripted.labels()).toEqual(['read-session-lot', 'lock-lot', 'cancel-session', 'free-held-spot', 'append-session-event']);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('cancel-session'));
    const cancelled = onlyAppendedSessionEvent(scripted);
    expect(cancelled.kind).toBe('ENTRY_CANCELLED');
    expect(cancelled.payload).toEqual({ reason: 'ADMISSION_FAILED' });
    expect(cancelled.occurredAtText).toMatch(/select "cancelled_at" from parking_session where id = \$\d+/);
  });

  it('logs nothing when the job cancelled the session first', async () => {
    const scripted = new ScriptedSql().answer('read-session-lot', [{ lot_id: LOT_ID }]);

    await cancelOnRollback(scripted);

    expect(scripted.labels()).toEqual(['read-session-lot', 'lock-lot', 'cancel-session']);
  });

  it('neither locks nor writes for a session that does not exist', async () => {
    const scripted = new ScriptedSql();

    await cancelOnRollback(scripted);

    expect(scripted.labels()).toEqual(['read-session-lot']);
  });
});
