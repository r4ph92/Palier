import { describe, expect, it } from 'vitest';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { readSpotHoldFacts } from '../../src/infrastructure/postgres/spotHoldFacts.ts';
import { PARKING_DEMO_LOCK_ID } from './fakes/lotRows.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const lockedLot = { id: PARKING_DEMO_LOCK_ID, name: 'Parking Démo', isOnline: true, capacity: 10, vehicleCount: 0, holdQuota: 4 };

describe('the facts a spot hold is decided on', () => {
  it('takes the hold quota from the lot row read under the lock, without reading the lot again', async () => {
    const scripted = new ScriptedSql().answer('read-spot-hold-facts', [{ own_active_hold: false, own_active_session: false, active_holds_in_lot: 3, held_spot_count: 3, assigned_spot_count: 0 }]);

    const facts = await readSpotHoldFacts(scripted.executor(), lockedLot, 'driver-julie');

    expect(facts.holdQuota).toBe(4);
    expect(scripted.statement('read-spot-hold-facts')?.text).not.toMatch(/from parking_lot/);
  });

  it('reads the driver\'s own session in every active state and in no closed one', async () => {
    const scripted = new ScriptedSql().answer('read-spot-hold-facts', [{ own_active_hold: false, own_active_session: true, active_holds_in_lot: 0, held_spot_count: 0, assigned_spot_count: 0 }]);

    const facts = await readSpotHoldFacts(scripted.executor(), lockedLot, 'driver-julie');

    const statement = scripted.statement('read-spot-hold-facts');
    expect(facts.hasOwnActiveSession).toBe(true);
    expect(statement?.text).toMatch(/from parking_session where user_id = \$2 and state in/);
    expect(statement?.params.slice(0, 2)).toEqual(['driver-julie', 'driver-julie']);
    for (const activeState of ACTIVE_ENTRY_SESSION_STATES) expect(statement?.text).toContain(`'${activeState}'`);
    for (const closedState of ['CANCELLED', 'CLOSED_PAID', 'CLOSED_CAPTURE_PENDING']) expect(statement?.text).not.toContain(`'${closedState}'`);
  });
});
