import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionBackdater } from '../../src/infrastructure/postgres/PostgresParkingSessionBackdater.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const BEFORE_FALL_BACK = new Date('2026-10-20T12:00:00Z');
const ELAPSED_TIME_DELTA = /extract\(epoch from|time zone 'UTC'|timezone = 'UTC'|make_interval\(secs/i;

describe('backdating a visit across a daylight saving change (story #156, decision 035)', () => {
  // A calendar-day delta under America/Toronto would give 2161 h across the fall back.
  it('shifts the logged events by an elapsed time, so the purge stays 2160 h after each event whatever the session time zone', async () => {
    const scripted = new ScriptedSql();

    await new PostgresParkingSessionBackdater(scripted.database()).backdateEntry(SESSION_ID, BEFORE_FALL_BACK);

    expect(scripted.statement('backdate-entry')?.text).toMatch(ELAPSED_TIME_DELTA);
  });
});
