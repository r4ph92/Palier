import { describe, expect, it } from 'vitest';
import { LotBusyError } from '../../src/domain/lots/LotBusyError.ts';
import { PostgresSilentSessionRepository } from '../../src/infrastructure/postgres/PostgresSilentSessionRepository.ts';
import { PARKING_DEMO_LOCK_ID, parkingDemoLockRow } from './fakes/lotRows.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const CUTOFF = new Date('2026-11-04T19:00:00Z');
const NOW = new Date('2026-11-04T19:30:00Z');

function presumeWith(scripted: ScriptedSql) {
  return new PostgresSilentSessionRepository(scripted.database()).presumeLotSilentSessions(PARKING_DEMO_LOCK_ID, { cutoff: CUTOFF, now: NOW });
}

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-lot', [parkingDemoLockRow]);
}

describe('presuming the silent sessions of a lot', () => {
  it('bounds the lock wait, locks the lot, then runs two guarded updates and writes no spot', async () => {
    const scripted = lockedLot().answer('presume-silent-entries', [{ id: 'a' }]).answer('presume-silent-questions', [{ id: 'b' }, { id: 'c' }]);

    const presumptions = await presumeWith(scripted);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'presume-silent-entries', 'presume-silent-questions']);
    expect(presumptions).toEqual({ confirmedEntries: 1, unansweredQuestions: 2 });
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.statements.some(({ text }) => text.includes('update spot'))).toBe(false);
  });

  it('presumes a confirmed entry at or before the cutoff by timeout, parked at the clock reading', async () => {
    const scripted = lockedLot();

    await presumeWith(scripted);

    const statement = scripted.statements.find(({ label }) => label === 'presume-silent-entries');
    expect(statement?.text).toContain(`state = 'ENTRY_CONFIRMED'`);
    expect(statement?.text).toContain('entry_confirmed_at <=');
    expect(statement?.text).toContain(`presumed_by = 'TIMEOUT'`);
    expect(statement?.params).toEqual([NOW.toISOString(), PARKING_DEMO_LOCK_ID, CUTOFF.toISOString()]);
  });

  it('presumes an unanswered question by timeout and keeps the instant it was asked', async () => {
    const scripted = lockedLot();

    await presumeWith(scripted);

    const statement = scripted.statements.find(({ label }) => label === 'presume-silent-questions');
    expect(statement?.text).toContain(`state = 'PARKED_UNCONFIRMED'`);
    expect(statement?.text).toContain('parked_at <=');
    expect(statement?.text).toContain(`presumed_by = 'TIMEOUT'`);
    expect(statement?.text).not.toContain('parked_at =');
    expect(statement?.params).toEqual([PARKING_DEMO_LOCK_ID, CUTOFF.toISOString()]);
  });

  it.each(['presume-silent-entries', 'presume-silent-questions'] as const)('%s only touches its own state, never a cancelled, created or confirmed session', async (label) => {
    const scripted = lockedLot();

    await presumeWith(scripted);

    expect(scripted.statement(label)?.text).not.toMatch(/CANCELLED|CREATED|PARKED_CONFIRMED/);
  });

  it('turns a lock timeout into a busy lot for the job to warn about, writing nothing', async () => {
    const scripted = lockedLot().fail('lock-lot', LOCK_NOT_AVAILABLE);

    await expect(presumeWith(scripted)).rejects.toBeInstanceOf(LotBusyError);
    expect(scripted.count('presume-silent-entries')).toBe(0);
  });

  it('finds the lots with a silent session before any lock, at the cutoff', async () => {
    const scripted = new ScriptedSql().answer('find-silent-session-lots', [{ lot_id: PARKING_DEMO_LOCK_ID }]);

    const lotIds = await new PostgresSilentSessionRepository(scripted.database()).findLotsWithSilentSessions(CUTOFF);

    expect(lotIds).toEqual([PARKING_DEMO_LOCK_ID]);
    expect(scripted.labels()).toEqual(['find-silent-session-lots']);
    expect(scripted.statements[0]?.onTransaction).toBe(false);
    expect(scripted.statements[0]?.params).toEqual([CUTOFF.toISOString(), CUTOFF.toISOString()]);
  });
});
