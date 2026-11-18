import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LotBusyError } from '../../src/domain/lots/LotBusyError.ts';
import { PostgresStaleSessionRepository } from '../../src/infrastructure/postgres/PostgresStaleSessionRepository.ts';
import { PARKING_DEMO_LOCK_ID, parkingDemoLockRow } from './fakes/lotRows.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const CUTOFF = new Date('2026-11-01T09:00:00Z');
const NOW = new Date('2026-11-08T09:00:00Z');
const LAST_PROOF = `greatest(parking_session.entry_confirmed_at, case when parking_session.presumed_by = 'WALK' then parking_session.parked_at end, parking_session.parked_answered_at, parking_session.presence_confirmed_at)`;

function flagWith(scripted: ScriptedSql) {
  return new PostgresStaleSessionRepository(scripted.database()).flagLotStaleSessions(PARKING_DEMO_LOCK_ID, { cutoff: CUTOFF, now: NOW });
}

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-lot', [parkingDemoLockRow]);
}

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ');
}

describe('flagging the stale sessions of a lot', () => {
  it('bounds the lock wait, locks the lot, then runs one update and counts its rows', async () => {
    const scripted = lockedLot().answer('flag-stale-sessions', [{ id: 'a' }, { id: 'b' }]);

    const flagged = await flagWith(scripted);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'flag-stale-sessions']);
    expect(flagged).toBe(2);
    expect(scripted.isolationLevels).toEqual(['read committed']);
  });

  it('writes the flag and nothing else: no state, no payment column, no spot, no event', async () => {
    const scripted = lockedLot();

    await flagWith(scripted);

    const text = oneLine(scripted.statement('flag-stale-sessions')?.text);
    expect(text).toMatch(/^ update parking_session set stale_flagged_at = \$1::timestamptz where /);
    expect(scripted.statements.map(({ text: statement }) => statement).join(' ')).not.toMatch(/update spot|event_log|payment_intent|captured_cents|set state/);
  });

  it('flags an active, unflagged session of the locked lot whose last proof is at or before the cutoff', async () => {
    const scripted = lockedLot();

    await flagWith(scripted);

    const statement = scripted.statement('flag-stale-sessions');
    const text = oneLine(statement?.text);
    expect(text).toContain(`state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED')`);
    expect(text).toContain('stale_flagged_at is null');
    expect(text).toContain(`${LAST_PROOF} <= $3::timestamptz`);
    expect(statement?.params).toEqual([NOW.toISOString(), PARKING_DEMO_LOCK_ID, CUTOFF.toISOString()]);
  });

  it('turns a lock timeout into a busy lot for the job to warn about, writing nothing', async () => {
    const scripted = lockedLot().fail('lock-lot', LOCK_NOT_AVAILABLE);

    await expect(flagWith(scripted)).rejects.toBeInstanceOf(LotBusyError);
    expect(scripted.count('flag-stale-sessions')).toBe(0);
  });

  it('finds the lots with a stale unflagged session before any lock, at the cutoff', async () => {
    const scripted = new ScriptedSql().answer('find-stale-session-lots', [{ lot_id: PARKING_DEMO_LOCK_ID }]);

    const lotIds = await new PostgresStaleSessionRepository(scripted.database()).findLotsWithStaleSessions(CUTOFF);

    expect(lotIds).toEqual([PARKING_DEMO_LOCK_ID]);
    expect(scripted.labels()).toEqual(['find-stale-session-lots']);
    expect(scripted.statements[0]?.onTransaction).toBe(false);
    expect(oneLine(scripted.statements[0]?.text)).toContain(`${LAST_PROOF} <= $1::timestamptz`);
  });
});

describe('the stale session check and the payments', () => {
  const JOB_FILES = [
    '../../src/domain/parkingSessions/flagStaleSessions.ts',
    '../../src/infrastructure/postgres/PostgresStaleSessionRepository.ts',
    '../../src/infrastructure/postgres/staleSessionStatements.ts',
    '../../src/composeStaleSessionFlagging.ts',
  ];

  it.each(JOB_FILES)('%s imports no payment or Stripe code, so the check can never capture', (file) => {
    const imports = readFileSync(new URL(file, import.meta.url), 'utf8').split('\n').filter((line) => line.startsWith('import '));

    expect(imports.filter((line) => /payment|stripe|capture/i.test(line))).toEqual([]);
  });
});
