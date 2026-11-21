import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { WalkingSignal } from '../../src/domain/parkingSessions/ParkedPresumption.ts';
import { PostgresParkedPresumptionRepository } from '../../src/infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const MARC_ID = '00000000-0000-4000-8000-000000000502';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000101';
const AISLE_A_ID = '00000000-0000-4000-8000-0000000002a1';
const AISLE_B_ID = '00000000-0000-4000-8000-0000000002b1';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const WALKED_AT = new Date('2026-11-04T15:05:00Z');
const TIMEOUT_AT = new Date('2026-11-04T15:31:00Z');

const aisleA = { detected_aisle_id: AISLE_A_ID, detected_aisle_code: 'A', detected_aisle_minor: 1 };
const aisleB = { detected_aisle_id: AISLE_B_ID, detected_aisle_code: 'B', detected_aisle_minor: 2 };

function factsRow(state: EntrySessionState, detected: typeof aisleA, parkedAt: Date = TIMEOUT_AT) {
  return { state, parked_at: parkedAt.toISOString(), lot_id: LOT_ID, assigned_spot_id: SPOT_A1_ID, assigned_aisle_id: AISLE_A_ID, ...detected };
}

function walk(minor: number | null, driverId = JULIE_ID, detectedAt = WALKED_AT): WalkingSignal {
  return { sessionId: SESSION_ID, driverId, detectedAt, detectedAisleMinor: minor };
}

function walkWith(scripted: ScriptedSql, signal: WalkingSignal) {
  return new PostgresParkedPresumptionRepository(scripted.database()).presume(signal);
}

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function timeoutPresumedAtA1(detected: typeof aisleA = aisleA, state: EntrySessionState = 'PARKED_PRESUMED') {
  return new ScriptedSql().answer('read-walk-facts', [factsRow(state, detected)]);
}

const CLAMPED_WALK = String.raw`greatest\(least\(\$\d+::timestamptz, now\(\)\), entry_confirmed_at\)`;

describe('a late walk replacing a timeout presumption (story #147)', () => {
  it("replaces the timeout by the walk in A-1's aisle, answering presumed at the walk's time", async () => {
    const scripted = timeoutPresumedAtA1().answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);

    await expect(walkWith(scripted, walk(1))).resolves.toEqual({ outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });

    expect(scripted.labels()).toEqual(['read-walk-facts', 'presume-parked']);
    const update = oneLine(scripted.statement('presume-parked')?.text);
    expect(update).toMatch(new RegExp(`set state = 'PARKED_PRESUMED', presumed_by = 'WALK', parked_at = ${CLAMPED_WALK}`));
    expect(scripted.statement('presume-parked')?.params).toEqual(expect.arrayContaining([WALKED_AT.toISOString(), SESSION_ID, JULIE_ID, SPOT_A1_ID]));
  });

  it('replaces the timeout by a walk with no aisle detected, the same way', async () => {
    const scripted = new ScriptedSql().answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);

    await expect(walkWith(scripted, walk(null))).resolves.toEqual({ outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });

    expect(scripted.labels()).toEqual(['presume-parked']);
    expect(oneLine(scripted.statement('presume-parked')?.text)).toContain(`state = 'PARKED_PRESUMED' and presumed_by = 'TIMEOUT'`);
  });

  it('clamps the walk to the entry confirmation, in the time it writes and in the time it compares', async () => {
    const scripted = new ScriptedSql();

    await walkWith(scripted, walk(null, JULIE_ID, new Date('2026-11-04T14:55:00Z')));

    const update = oneLine(scripted.statement('presume-parked')?.text);
    expect(update).toMatch(new RegExp(`parked_at = ${CLAMPED_WALK} where`));
    expect(update).toMatch(new RegExp(`and ${CLAMPED_WALK} < parked_at\\)\\)`));
  });

  it('replaces only a timeout from a silent confirmed entry, earlier than the walk: no question asked, never a walk, never an answer', async () => {
    const scripted = new ScriptedSql();

    await walkWith(scripted, walk(null));

    const update = oneLine(scripted.statement('presume-parked')?.text);
    expect(update).toMatch(
      new RegExp(`and \\(state = 'ENTRY_CONFIRMED' or \\(state = 'PARKED_PRESUMED' and presumed_by = 'TIMEOUT' and parked_asked_at is null and ${CLAMPED_WALK} < parked_at\\)\\)`),
    );
    expect(update).not.toMatch(/PARKED_CONFIRMED|PARKED_UNCONFIRMED|presumed_by = 'WALK' and/);
  });

  it('logs the aisle and the presumption on foot at the walk time in the same statement, and writes no spot', async () => {
    const scripted = timeoutPresumedAtA1().answer('presume-parked', [{ parked_at: WALKED_AT.toISOString() }]);

    await walkWith(scripted, walk(1));

    const update = oneLine(scripted.statement('presume-parked')?.text);
    expect(update).toMatch(/^with presumed as \( update parking_session .* insert into event_log/);
    expect(update).toMatch(/values \(1, 'AISLE_DETECTED', \$\d+::jsonb\), \(2, 'PARKING_PRESUMED', /);
    expect(scripted.statements.some(({ text }) => /update spot\b/.test(text))).toBe(false);
    expect(scripted.count('lock-lot')).toBe(0);
  });

  it('keeps the timeout and its time when the walk is later than the presumption, answering already at 10:31', async () => {
    const scripted = timeoutPresumedAtA1();

    await expect(walkWith(scripted, walk(1, JULIE_ID, new Date('2026-11-04T15:40:00Z')))).resolves.toEqual({
      outcome: 'already',
      state: 'PARKED_PRESUMED',
      parkedAt: TIMEOUT_AT,
    });
    expect(scripted.labels()).toEqual(['read-walk-facts', 'presume-parked']);
  });

  it('keeps the timeout for a walk with no aisle that it cannot replace, answering with the session as read back', async () => {
    const scripted = new ScriptedSql().answer('read-unchanged-session', [{ state: 'PARKED_PRESUMED', parked_at: TIMEOUT_AT.toISOString() }]);

    await expect(walkWith(scripted, walk(null))).resolves.toEqual({ outcome: 'already', state: 'PARKED_PRESUMED', parkedAt: TIMEOUT_AT });
    expect(scripted.labels()).toEqual(['presume-parked', 'read-unchanged-session']);
  });

  it('keeps a walk presumption at its own time: the guarded update matches nothing, a walk never replaces a walk', async () => {
    const scripted = new ScriptedSql().answer('read-walk-facts', [factsRow('PARKED_PRESUMED', aisleA, WALKED_AT)]);

    await expect(walkWith(scripted, walk(1, JULIE_ID, new Date('2026-11-04T15:03:00Z')))).resolves.toEqual({
      outcome: 'already',
      state: 'PARKED_PRESUMED',
      parkedAt: WALKED_AT,
    });
    expect(scripted.count('presume-parked')).toBe(1);
  });

  it('leaves a corrected session alone: no write once Julie confirmed A-2', async () => {
    const scripted = timeoutPresumedAtA1(aisleA, 'PARKED_CONFIRMED');

    await expect(walkWith(scripted, walk(1))).resolves.toEqual({ outcome: 'already', state: 'PARKED_CONFIRMED', parkedAt: TIMEOUT_AT });
    expect(scripted.labels()).toEqual(['read-walk-facts']);
  });

  it('ignores a late walk in another aisle: no write, no question, the timeout stands', async () => {
    const scripted = timeoutPresumedAtA1(aisleB);

    await expect(walkWith(scripted, walk(2))).resolves.toEqual({ outcome: 'already', state: 'PARKED_PRESUMED', parkedAt: TIMEOUT_AT });
    expect(scripted.labels()).toEqual(['read-walk-facts']);
  });

  it("answers not found to Marc for Julie's presumed session, without a write", async () => {
    const scripted = new ScriptedSql();

    await expect(walkWith(scripted, walk(1, MARC_ID))).resolves.toEqual({ outcome: 'not-found' });
    expect(scripted.labels()).toEqual(['read-walk-facts']);
    expect(scripted.statement('read-walk-facts')?.params).toContain(MARC_ID);
  });

  it("answers not found to Marc's walk with no aisle, the update guarded by his id matching nothing", async () => {
    const scripted = new ScriptedSql();

    await expect(walkWith(scripted, walk(null, MARC_ID))).resolves.toEqual({ outcome: 'not-found' });
    expect(oneLine(scripted.statement('presume-parked')?.text)).toMatch(/where id = \$\d+ and user_id = \$\d+ and \(/);
    expect(scripted.statement('presume-parked')?.params).toEqual(expect.arrayContaining([SESSION_ID, MARC_ID]));
  });
});
