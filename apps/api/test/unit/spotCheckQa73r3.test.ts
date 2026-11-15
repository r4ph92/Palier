import { describe, expect, it } from 'vitest';
import { PostgresSpotCheckRepository } from '../../src/infrastructure/postgres/PostgresSpotCheckRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SOPHIE_OPERATOR = 'operator-lavoie';
const PARKING_DEMO = 'lot-demo';
const spotA2 = { lotId: PARKING_DEMO, spotId: 'spot-a2' };

// The reporter's exit frees the reported spot (spotsFreedOnExit), so criterion 3 wants SPOT_STILL_ASSIGNED, not SPOT_NOT_FREE.
describe('clearing a spot reported taken by a driver still parked (QA #73 round 3)', () => {
  it('counts a spot reported taken by an open session as held, so its clear waits for that exit', async () => {
    const scripted = new ScriptedSql()
      .answer('lock-owned-lot', [{ id: PARKING_DEMO }])
      .answer('lock-spot-to-clear', [{ state: 'OCCUPIED_UNKNOWN', needs_check: true, held_by_session: false }]);

    await new PostgresSpotCheckRepository(scripted.database()).clearSpotCheck(SOPHIE_OPERATOR, spotA2);

    expect(scripted.statement('lock-spot-to-clear')?.text).toMatch(/parking_session_reported_spot/);
  });

  it('marks a spot reported taken by an open session as held in the list too', async () => {
    const scripted = new ScriptedSql().answer('read-spots-to-check', []);

    await new PostgresSpotCheckRepository(scripted.database()).listSpotsToCheck(SOPHIE_OPERATOR, PARKING_DEMO);

    expect(scripted.statement('read-spots-to-check')?.text).toMatch(/parking_session_reported_spot/);
  });
});
