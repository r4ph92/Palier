import { describe, expect, it } from 'vitest';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { PostgresSpotCheckRepository } from '../../src/infrastructure/postgres/PostgresSpotCheckRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SOPHIE_OPERATOR = 'operator-lavoie';
const PARKING_DEMO = 'lot-demo';
const spotA2 = { lotId: PARKING_DEMO, spotId: 'spot-a2' };

function reportedSpotClauseOf(statementText: string): string {
  const start = statementText.indexOf('parking_session_reported_spot');
  expect(start).toBeGreaterThan(-1);
  return statementText.slice(start, statementText.indexOf(')', statementText.indexOf('reporter.state in', start)) + 1);
}

// Report rows outlive the session: once the reporter has left, the spot must become clearable (live: A-2 cleared 200 after Marc's exit).
describe('a spot reported taken stops holding its check once the reporter has left (QA #73 round 4)', () => {
  it('holds the clear only while the reporting session is in an active state', async () => {
    const scripted = new ScriptedSql()
      .answer('lock-owned-lot', [{ id: PARKING_DEMO }])
      .answer('lock-spot-to-clear', [{ state: 'OCCUPIED_UNKNOWN', needs_check: true, held_by_session: false }]);

    await new PostgresSpotCheckRepository(scripted.database()).clearSpotCheck(SOPHIE_OPERATOR, spotA2);

    const clause = reportedSpotClauseOf(scripted.statement('lock-spot-to-clear')?.text ?? '');
    for (const activeState of ACTIVE_ENTRY_SESSION_STATES) expect(clause).toContain(`'${activeState}'`);
    for (const closedState of ['CANCELLED', 'CLOSED_PAID', 'CLOSED_CAPTURE_PENDING']) expect(clause).not.toContain(`'${closedState}'`);
  });

  it('holds the clear only for a report made in the spot own lot', async () => {
    const scripted = new ScriptedSql()
      .answer('lock-owned-lot', [{ id: PARKING_DEMO }])
      .answer('lock-spot-to-clear', [{ state: 'OCCUPIED_UNKNOWN', needs_check: true, held_by_session: false }]);

    await new PostgresSpotCheckRepository(scripted.database()).clearSpotCheck(SOPHIE_OPERATOR, spotA2);

    expect(reportedSpotClauseOf(scripted.statement('lock-spot-to-clear')?.text ?? '')).toMatch(/reported\.lot_id = spot\.lot_id/);
  });

  it('lists a spot as held only while its reporting session is in an active state', async () => {
    const scripted = new ScriptedSql().answer('read-spots-to-check', []);

    await new PostgresSpotCheckRepository(scripted.database()).listSpotsToCheck(SOPHIE_OPERATOR, PARKING_DEMO);

    const clause = reportedSpotClauseOf(scripted.statement('read-spots-to-check')?.text ?? '');
    expect(clause).not.toContain("'CLOSED_PAID'");
    expect(clause).toContain("'PARKED_CONFIRMED'");
  });
});
