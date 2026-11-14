import { describe, expect, it } from 'vitest';
import { PostgresSilentSessionRepository } from '../../src/infrastructure/postgres/PostgresSilentSessionRepository.ts';
import { builtPayloads } from './fakes/appendedSessionEvents.ts';
import { parkingDemoLockRow } from './fakes/lotRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const LOT_ID = '00000000-0000-4000-8000-000000000201';

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

describe('no signal for 30 minutes (story #156, decision 030)', () => {
  const NOW = new Date('2026-11-14T18:35:00Z');

  function presumeSilent(scripted: ScriptedSql) {
    return new PostgresSilentSessionRepository(scripted.database()).presumeLotSilentSessions(LOT_ID, { cutoff: new Date('2026-11-14T18:05:00Z'), now: NOW });
  }

  function silentLot(): ScriptedSql {
    return new ScriptedSql()
      .answer('lock-lot', [parkingDemoLockRow])
      .answer('presume-silent-entries', [{ session_id: 'a' }, { session_id: 'b' }])
      .answer('presume-silent-questions', [{ session_id: 'c' }]);
  }

  it.each(['presume-silent-entries', 'presume-silent-questions'] as const)('%s logs every presumed session from one insert in the same statement', async (label) => {
    const scripted = silentLot();

    await presumeSilent(scripted);

    const statement = oneLine(scripted.statement(label)?.text);
    expect(statement).toMatch(/^with presumed as \( update parking_session set state = 'PARKED_PRESUMED', presumed_by = 'TIMEOUT'/);
    expect(statement.match(/insert into event_log/g)).toHaveLength(1);
    expect(statement).toMatch(/from presumed join spot on spot\.id = presumed\.assigned_spot_id returning session_id$/);
  });

  it('counts the sessions from the rows the statements logged, in the lot transaction', async () => {
    const scripted = silentLot();

    await expect(presumeSilent(scripted)).resolves.toEqual({ confirmedEntries: 2, unansweredQuestions: 1 });
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber)).size).toBe(1);
  });

  it.each(['presume-silent-entries', 'presume-silent-questions'] as const)('%s logs the timeout on the assigned spot at the job clock, purged 2160 h later', async (label) => {
    const scripted = silentLot();

    await presumeSilent(scripted);

    const statement = scripted.statement(label);
    const text = oneLine(statement?.text);
    expect(text).toContain(`'PARKING_PRESUMED', jsonb_build_object('evidence', 'TIMEOUT', 'spotId', spot.id, 'spotNumber', spot.number)`);
    expect(text).toMatch(/\$(\d+)::timestamptz, \$(\d+)::timestamptz \+ make_interval\(hours => \$\d+::int\) from presumed/);
    expect(statement?.params.slice(-3)).toEqual([NOW.toISOString(), NOW.toISOString(), 2160]);
    expect(builtPayloads(text)).toEqual([{ kind: 'PARKING_PRESUMED', keys: ['evidence', 'spotId', 'spotNumber'] }]);
  });
});
