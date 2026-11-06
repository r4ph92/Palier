import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionBackdater } from '../../src/infrastructure/postgres/PostgresParkingSessionBackdater.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';

describe('PostgresParkingSessionBackdater', () => {
  it('moves the walking instant by the same delta as the entry scan, so a parked session keeps its order of events', async () => {
    const sql = new ScriptedSql();

    await new PostgresParkingSessionBackdater(sql.database()).backdateEntry(SESSION_ID, new Date('2026-11-04T18:02:00Z'));

    const [update] = sql.statements;
    expect(update?.text).toMatch(/parked_at = parked_at \+ \(\$\d+::timestamptz - entry_scan_at\)/);
    expect(update?.text).toMatch(/entry_confirmed_at = entry_confirmed_at \+ \(\$\d+::timestamptz - entry_scan_at\)/);
  });
});
