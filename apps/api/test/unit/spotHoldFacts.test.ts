import { describe, expect, it } from 'vitest';
import { readSpotHoldFacts } from '../../src/infrastructure/postgres/spotHoldFacts.ts';
import { PARKING_DEMO_LOCK_ID } from './fakes/lotRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const lockedLot = { id: PARKING_DEMO_LOCK_ID, name: 'Parking Démo', isOnline: true, capacity: 10, vehicleCount: 0, holdQuota: 4 };

describe('the facts a spot hold is decided on', () => {
  it('takes the hold quota from the lot row read under the lock, without reading the lot again', async () => {
    const scripted = new ScriptedSql().answer('read-spot-hold-facts', [{ own_active_hold: false, active_holds_in_lot: 3, held_spot_count: 3, assigned_spot_count: 0 }]);

    const facts = await readSpotHoldFacts(scripted.executor(), lockedLot, 'driver-julie');

    expect(facts.holdQuota).toBe(4);
    expect(scripted.statement('read-spot-hold-facts')?.text).not.toMatch(/from parking_lot/);
  });
});
