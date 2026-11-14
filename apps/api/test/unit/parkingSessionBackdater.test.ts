import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionBackdater } from '../../src/infrastructure/postgres/PostgresParkingSessionBackdater.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const ENTERED_AT = new Date('2026-11-04T18:02:00Z');

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function backdate(scripted: ScriptedSql): Promise<boolean> {
  return new PostgresParkingSessionBackdater(scripted.database()).backdateEntry(SESSION_ID, ENTERED_AT);
}

describe('PostgresParkingSessionBackdater', () => {
  it('reads the delta from the locked active session before any write, in the same statement', async () => {
    const scripted = new ScriptedSql();

    await backdate(scripted);

    expect(scripted.labels()).toEqual(['backdate-entry']);
    const text = oneLine(scripted.statement('backdate-entry')?.text);
    expect(text).toMatch(/^with previous as \( select id, \$\d+::timestamptz - entry_scan_at as delta from parking_session where id = \$\d+ and state in \([^)]*\) for update \)/);
    expect(scripted.statement('backdate-entry')?.params).toEqual([ENTERED_AT.toISOString(), SESSION_ID, ENTERED_AT.toISOString()]);
  });

  it('moves the loop confirmation and the walking instant by the scan delta, so a parked session keeps its order of events', async () => {
    const scripted = new ScriptedSql();

    await backdate(scripted);

    const text = oneLine(scripted.statement('backdate-entry')?.text);
    expect(text).toContain('set entry_confirmed_at = entry_confirmed_at + previous.delta, parked_at = parked_at + previous.delta, entry_scan_at = $3::timestamptz');
    expect(text).toContain('from previous where parking_session.id = previous.id returning parking_session.id, previous.delta');
  });

  it("shifts that session's logged events and their purge dates by the same delta, keeping the 2160 h rule", async () => {
    const scripted = new ScriptedSql();

    await backdate(scripted);

    const text = oneLine(scripted.statement('backdate-entry')?.text);
    expect(text).toContain(
      'update event_log set occurred_at = occurred_at + backdated.delta, purge_after = purge_after + backdated.delta from backdated where event_log.session_id = backdated.id',
    );
  });

  it('answers whether an active session was backdated', async () => {
    await expect(backdate(new ScriptedSql().answer('backdate-entry', [{ id: SESSION_ID }]))).resolves.toBe(true);
    await expect(backdate(new ScriptedSql())).resolves.toBe(false);
  });
});
