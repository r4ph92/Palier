import { describe, expect, it, vi } from 'vitest';
import { presumeSilentSessions, type SilentSessionJob } from '../../src/domain/parkingSessions/presumeSilentSessions.ts';
import { PostgresSilentSessionRepository } from '../../src/infrastructure/postgres/PostgresSilentSessionRepository.ts';
import { FakeSilentSessionRepository } from './fakes/fakeSilentSessions.ts';
import { PARKING_DEMO_LOCK_ID, parkingDemoLockRow } from './fakes/lotRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const ENTERED_AT = new Date('2026-11-11T13:30:00.000Z');
const CUTOFF = new Date('2026-11-11T13:30:00.000Z');
const NOW = new Date('2026-11-11T14:00:00.000Z');

function logSpy() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function julieEnteredAt(instant: Date): FakeSilentSessionRepository {
  const silentSessions = new FakeSilentSessionRepository();
  silentSessions.sessions.push({ state: 'ENTRY_CONFIRMED', entryConfirmedAt: instant, presumedBy: null });
  return silentSessions;
}

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ');
}

async function presumeLotStatements(): Promise<ScriptedSql> {
  const scripted = new ScriptedSql().answer('lock-lot', [parkingDemoLockRow]);
  await new PostgresSilentSessionRepository(scripted.database()).presumeLotSilentSessions(PARKING_DEMO_LOCK_ID, { cutoff: CUTOFF, now: NOW });
  return scripted;
}

describe('presuming silent sessions, QA attacks (story #24)', () => {
  it('C1/C2 boundary: presumes an entry confirmed exactly 30:00.000 before the check, not one confirmed a millisecond later', async () => {
    const atLimit = julieEnteredAt(ENTERED_AT);
    const justUnder = julieEnteredAt(new Date(ENTERED_AT.getTime() + 1));
    const job = (silentSessions: SilentSessionJob['silentSessions']): SilentSessionJob => ({ silentSessions, clock: () => NOW });

    await presumeSilentSessions(job(atLimit), logSpy());
    await presumeSilentSessions(job(justUnder), logSpy());

    expect(atLimit.sessions[0]?.presumedBy).toBe('TIMEOUT');
    expect(justUnder.sessions[0]?.presumedBy).toBeNull();
    expect(justUnder.presumptions).toEqual([]);
  });

  it('presumes at the next check a lot that was busy at the previous one', async () => {
    const presumeLot = vi
      .fn<SilentSessionJob['silentSessions']['presumeLotSilentSessions']>()
      .mockRejectedValueOnce(new Error('canceling statement due to lock timeout'))
      .mockResolvedValueOnce({ confirmedEntries: 1, unansweredQuestions: 0 });
    const silentSessions: SilentSessionJob['silentSessions'] = { findLotsWithSilentSessions: () => Promise.resolve(['lot-demo']), presumeLotSilentSessions: presumeLot };
    const log = logSpy();

    await presumeSilentSessions({ silentSessions, clock: () => NOW }, log);
    await presumeSilentSessions({ silentSessions, clock: () => new Date(NOW.getTime() + 300_000) }, log);

    expect(presumeLot).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-demo', confirmedEntries: 1, unansweredQuestions: 0 }, expect.any(String));
  });

  it('finds silent lots by the entry instant for a confirmed entry and by the question instant for an unanswered one, and no other state', async () => {
    const scripted = new ScriptedSql();

    await new PostgresSilentSessionRepository(scripted.database()).findLotsWithSilentSessions(CUTOFF);

    const text = oneLine(scripted.statement('find-silent-session-lots')?.text);
    expect(text).toMatch(/\(state = 'ENTRY_CONFIRMED' and entry_confirmed_at <= \$1::timestamptz\)/);
    expect(text).toMatch(/\(state = 'PARKED_UNCONFIRMED' and parked_at <= \$2::timestamptz\)/);
    expect(text).not.toMatch(/CANCELLED|CREATED|PARKED_CONFIRMED|'PARKED_PRESUMED'/);
  });

  it('C1/C3: each presumption is scoped to the locked lot and re-checks its own state and instant, never another state', async () => {
    const scripted = await presumeLotStatements();

    const entries = oneLine(scripted.statement('presume-silent-entries')?.text);
    const questions = oneLine(scripted.statement('presume-silent-questions')?.text);
    expect(entries).toMatch(/where lot_id = \$\d and state = 'ENTRY_CONFIRMED' and entry_confirmed_at <= \$\d::timestamptz/);
    expect(questions).toMatch(/where lot_id = \$\d and state = 'PARKED_UNCONFIRMED' and parked_at <= \$\d::timestamptz/);
    expect(`${entries} ${questions}`).not.toMatch(/CANCELLED|CREATED|PARKED_CONFIRMED|confirmed_spot_id|parked_aisle_id/);
  });

  it('C3: leaves the flagged spot and the aisle of the question untouched when the question times out', async () => {
    const scripted = await presumeLotStatements();

    expect(scripted.statements.map(({ text }) => oneLine(text)).filter((text) => /update spot|needs_check/.test(text))).toEqual([]);
  });
});
