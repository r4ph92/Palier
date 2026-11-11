import { describe, expect, it } from 'vitest';
import { readSpotHoldFacts } from '../../src/infrastructure/postgres/spotHoldFacts.ts';
import { PARKING_DEMO_LOCK_ID } from './fakes/lotRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const lockedLot = { id: PARKING_DEMO_LOCK_ID, name: 'Parking Démo', isOnline: true, capacity: 10, vehicleCount: 0 };

describe('the facts a spot hold is decided on', () => {
  it('reads the hold quota the lot sets, in the statement run under the lot lock', async () => {
    const scripted = new ScriptedSql().answer('read-spot-hold-facts', [{ own_active_hold: false, active_holds_in_lot: 3, hold_quota: 4, held_spot_count: 3 }]);

    const facts = await readSpotHoldFacts(scripted.executor(), lockedLot, 'driver-julie');

    expect(facts.holdQuota).toBe(4);
    expect(scripted.statement('read-spot-hold-facts')?.text).toMatch(/select hold_quota from parking_lot where id = \$3/);
    expect(scripted.statement('read-spot-hold-facts')?.params[2]).toBe(PARKING_DEMO_LOCK_ID);
  });
});
