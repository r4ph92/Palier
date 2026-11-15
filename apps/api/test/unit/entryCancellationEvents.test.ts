import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresUnconfirmedEntryRepository } from '../../src/infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';
import { builtPayloads, onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000201';
const NOW = new Date('2026-11-14T18:05:00Z');
const cancelledRow = { assigned_spot_id: '00000000-0000-4000-8000-0000000003a1', consumed_spot_hold_id: null };

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function cancelByJob(scripted: ScriptedSql) {
  return new PostgresUnconfirmedEntryRepository(scripted.database(), () => NOW).cancel({ sessionId: SESSION_ID, lotId: LOT_ID });
}

function cancelOnRollback(scripted: ScriptedSql) {
  return new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => NOW).cancel(SESSION_ID);
}

describe('no loop within 60 s after the opening (story #156, decision 013)', () => {
  function cancelledEntry(): ScriptedSql {
    return new ScriptedSql().answer('cancel-session', [cancelledRow]);
  }

  function withoutLoopText(scripted: ScriptedSql): string {
    return oneLine(scripted.statement('log-entry-without-loop')?.text);
  }

  it('logs the cancellation in the cancellation transaction, after the session and its spot', async () => {
    const scripted = cancelledEntry();

    await expect(cancelByJob(scripted)).resolves.toBe(true);

    expect(scripted.labels()).toEqual(['lock-lot', 'cancel-session', 'free-held-spot', 'log-entry-without-loop']);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber)).size).toBe(1);
  });

  it('logs the reason, and whether a barrier command existed, from one insert', async () => {
    const scripted = cancelledEntry();

    await cancelByJob(scripted);

    expect(withoutLoopText(scripted)).toMatch(/^insert into event_log \(session_id, lot_id, kind, payload, occurred_at, purge_after\) select cancelled\.id, cancelled\.lot_id, 'ENTRY_CANCELLED', /);
    expect(builtPayloads(withoutLoopText(scripted))).toEqual([{ kind: 'ENTRY_CANCELLED', keys: ['reason', 'wasBarrierOpened'] }]);
    expect(withoutLoopText(scripted)).toContain(
      `jsonb_build_object('reason', 'NO_LOOP', 'wasBarrierOpened', exists (select 1 from gate_command where gate_command.session_id = cancelled.id and gate_command.kind = 'OPEN'))`,
    );
  });

  it('logs it at the cancelled_at of the very session it cancelled, in that session\'s lot', async () => {
    const scripted = cancelledEntry();

    await cancelByJob(scripted);

    expect(withoutLoopText(scripted)).toMatch(/, cancelled\.cancelled_at, cancelled\.cancelled_at \+ make_interval\(hours => \$1::int\) from parking_session cancelled where cancelled\.id = \$2$/);
    expect(scripted.statement('log-entry-without-loop')?.params).toEqual([2160, SESSION_ID]);
  });

  it('logs nothing when the session was no longer waiting for its loop', async () => {
    const scripted = new ScriptedSql();

    await expect(cancelByJob(scripted)).resolves.toBe(false);
    expect(scripted.labels()).toEqual(['lock-lot', 'cancel-session']);
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
