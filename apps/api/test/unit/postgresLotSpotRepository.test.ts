import { describe, expect, it } from 'vitest';
import { MAX_SPOTS_PER_LOT, spotNumbersOf } from '@palier/shared-types/spotDraft';
import { PostgresLotSpotRepository } from '../../src/infrastructure/postgres/PostgresLotSpotRepository.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const ROY_OPERATOR = 'operator-roy';
const GARAGE_ROY_NORD = 'lot-roy-nord';
const AISLE_A = 'aisle-a';
const SPOT_A3 = 'spot-a3';
const aisle = { lotId: GARAGE_ROY_NORD, aisleId: AISLE_A };
const spotA3 = { lotId: GARAGE_ROY_NORD, spotId: SPOT_A3 };
const standard = { isEv: false, isAccessible: false, isOversize: false, distanceToExit: 30 };
const aisleARange = { numbers: spotNumbersOf({ prefix: 'A-', first: '1', last: '20' }), attributes: standard };
const ownedLot = [{ id: GARAGE_ROY_NORD }];
const noSpot = { id: null, number: null, state: null, is_ev: null, is_accessible: null, is_oversize: null, distance_to_exit: null };
const aisleRow = { aisle_id: AISLE_A, capacity: 18, spot_count: 21 };

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresLotSpotRepository(scripted.database());
}

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-owned-lot', ownedLot);
}

describe('reading the spots of an aisle from Postgres', () => {
  it('lists the live spots in natural order, with the lot’s live spot count and capacity', async () => {
    const scripted = new ScriptedSql().answer('read-aisle-spots', [
      { ...aisleRow, id: 'a2', number: 'A-2', state: 'AVAILABLE', is_ev: true, is_accessible: false, is_oversize: false, distance_to_exit: 12 },
      { ...aisleRow, id: 'a10', number: 'A-10', state: 'OCCUPIED', is_ev: false, is_accessible: true, is_oversize: false, distance_to_exit: 40 },
    ]);

    const spots = await repositoryOn(scripted).readAisleSpots(ROY_OPERATOR, aisle);

    expect(spots).toEqual({
      aisleId: AISLE_A,
      spotCount: 21,
      capacity: 18,
      spots: [
        { id: 'a2', number: 'A-2', state: 'AVAILABLE', isEv: true, isAccessible: false, isOversize: false, distanceToExit: 12 },
        { id: 'a10', number: 'A-10', state: 'OCCUPIED', isEv: false, isAccessible: true, isOversize: false, distanceToExit: 40 },
      ],
    });
    const { text, params } = scripted.statement('read-aisle-spots') ?? { text: '', params: [] };
    expect(text).toMatch(/left join spot on spot\.aisle_id = aisle\.id and spot\.retired_at is null/);
    expect(text).toMatch(/cross join \(select count\(\*\)::int from spot where spot\.lot_id = \$1 and spot\.retired_at is null\) as lot_spots\(spot_count\)/);
    expect(text).toMatch(/aisle\.id = \$2 and aisle\.lot_id = \$3 and not aisle\.is_exit_lane and parking_lot\.id = aisle\.lot_id and parking_lot\.operator_id = \$4/);
    expect(text).toMatch(/order by regexp_replace\(spot\.number, '\[0-9\]\+\$', ''\), substring\(spot\.number from '\[0-9\]\+\$'\)::numeric nulls first, spot\.number$/);
    expect(params).toEqual([GARAGE_ROY_NORD, AISLE_A, GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('reads an empty aisle as no spots, and another operator’s aisle or the exit lane as null', async () => {
    const empty = new ScriptedSql().answer('read-aisle-spots', [{ ...aisleRow, spot_count: 0, ...noSpot }]);

    expect((await repositoryOn(empty).readAisleSpots(ROY_OPERATOR, aisle))?.spots).toEqual([]);
    expect(await repositoryOn(new ScriptedSql()).readAisleSpots('operator-lavoie', aisle)).toBeNull();
  });
});

describe('adding spots in Postgres', () => {
  it('locks the lot first, then checks the aisle, the limit and the taken numbers, then inserts the range in one statement', async () => {
    const scripted = lockedLot().answer('read-parking-aisle', [{ id: AISLE_A }]).answer('count-live-spots', [{ spot_count: 0 }]);

    expect(await repositoryOn(scripted).addSpots(ROY_OPERATOR, aisle, aisleARange)).toEqual({ kind: 'written', aisleId: AISLE_A });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-parking-aisle', 'count-live-spots', 'find-taken-number', 'insert-spots']);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    const insert = scripted.statement('insert-spots');
    expect(insert?.text).toMatch(/select aisle\.id, aisle\.lot_id, wanted\.number, \$\d+::boolean, \$\d+::boolean, \$\d+::boolean, \$\d+::int/);
    expect(insert?.text).toMatch(/cross join unnest\(array\[(\$\d+, ){19}\$\d+\]::text\[\]\) as wanted\(number\)/);
    expect(insert?.text).toMatch(/aisle\.lot_id = \$\d+ and not aisle\.is_exit_lane and parking_lot\.id = aisle\.lot_id and parking_lot\.operator_id = \$\d+/);
    expect(insert?.params).toEqual([false, false, false, 30, ...aisleARange.numbers, AISLE_A, GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('reads the taken numbers the way a driver’s answer does, in the lot only, among live spots', async () => {
    const scripted = lockedLot().answer('read-parking-aisle', [{ id: AISLE_A }]).answer('count-live-spots', [{ spot_count: 3 }]).answer('find-taken-number', [{ number: 'A 3' }]);

    expect(await repositoryOn(scripted).addSpots(ROY_OPERATOR, aisle, aisleARange)).toEqual({ kind: 'numberTaken', takenNumber: 'A 3' });

    expect(scripted.count('insert-spots')).toBe(0);
    const { text, params } = scripted.statement('find-taken-number') ?? { text: '', params: [] };
    expect(text).toMatch(/join spot on spot\.lot_id = \$21 and spot\.retired_at is null and upper\(regexp_replace\(spot\.number, '\[\[:space:\]–—-\]', '', 'g'\)\) = upper\(regexp_replace\(wanted\.number/);
    expect(text).toMatch(/parking_lot\.operator_id = \$22\s+order by wanted\.position, spot\.number\s+limit 1/);
    expect(params).toEqual([...aisleARange.numbers, GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('refuses an aisle that is not a parking aisle of the lot before counting anything', async () => {
    const scripted = lockedLot();

    expect(await repositoryOn(scripted).addSpots(ROY_OPERATOR, aisle, aisleARange)).toEqual({ kind: 'refused', reason: 'AISLE_NOT_FOUND' });
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-parking-aisle']);
  });

  it('refuses a range that would take the lot past its spot limit, counting live spots only', async () => {
    const scripted = lockedLot().answer('read-parking-aisle', [{ id: AISLE_A }]).answer('count-live-spots', [{ spot_count: MAX_SPOTS_PER_LOT - 19 }]);

    expect(await repositoryOn(scripted).addSpots(ROY_OPERATOR, aisle, aisleARange)).toEqual({ kind: 'refused', reason: 'SPOT_LIMIT_REACHED' });
    expect(scripted.statement('count-live-spots')?.text).toMatch(/select \(select count\(\*\)::int from spot where spot\.lot_id = \$1 and spot\.retired_at is null\) as spot_count from parking_lot where parking_lot\.id = \$2 and parking_lot\.operator_id = \$3/);
    expect(scripted.count('find-taken-number')).toBe(0);
  });

  it('accepts a range that fills the lot exactly to its limit', async () => {
    const scripted = lockedLot().answer('read-parking-aisle', [{ id: AISLE_A }]).answer('count-live-spots', [{ spot_count: MAX_SPOTS_PER_LOT - 20 }]);

    expect(await repositoryOn(scripted).addSpots(ROY_OPERATOR, aisle, aisleARange)).toEqual({ kind: 'written', aisleId: AISLE_A });
  });

  it('refuses another operator’s lot before reading its aisle, and a busy lot as LOT_BUSY', async () => {
    const notOwned = new ScriptedSql();
    const busy = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await repositoryOn(notOwned).addSpots('operator-lavoie', aisle, aisleARange)).toEqual({ kind: 'refused', reason: 'LOT_NOT_FOUND' });
    expect(notOwned.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot']);
    expect(await repositoryOn(busy).addSpots(ROY_OPERATOR, aisle, aisleARange)).toEqual({ kind: 'refused', reason: 'LOT_BUSY' });
  });
});

describe('changing a spot in Postgres', () => {
  const electric = { ...standard, isEv: true, distanceToExit: 12 };

  it('sets the three attributes and the distance of a live spot of the operator’s lot, under the lot lock', async () => {
    const scripted = lockedLot().answer('change-spot', [{ aisle_id: AISLE_A }]);

    expect(await repositoryOn(scripted).changeSpot(ROY_OPERATOR, spotA3, electric)).toEqual({ kind: 'written', aisleId: AISLE_A });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'change-spot']);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    const { text, params } = scripted.statement('change-spot') ?? { text: '', params: [] };
    expect(text).toMatch(/spot\.id = \$5 and spot\.lot_id = \$6 and spot\.retired_at is null and parking_lot\.id = spot\.lot_id and parking_lot\.operator_id = \$7/);
    expect(text).not.toMatch(/number =/);
    expect(params).toEqual([true, false, false, 12, SPOT_A3, GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('answers SPOT_NOT_FOUND for a spot that is retired, another lot’s, or none', async () => {
    expect(await repositoryOn(lockedLot()).changeSpot(ROY_OPERATOR, spotA3, electric)).toEqual({ kind: 'refused', reason: 'SPOT_NOT_FOUND' });
  });
});

describe('deleting a spot in Postgres', () => {
  it('deletes a spot nothing ever pointed at, and stops there', async () => {
    const scripted = lockedLot().answer('delete-unused-spot', [{ aisle_id: AISLE_A }]);

    expect(await repositoryOn(scripted).removeSpot(ROY_OPERATOR, spotA3)).toEqual({ kind: 'written', aisleId: AISLE_A });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'delete-unused-spot']);
    const text = scripted.statement('delete-unused-spot')?.text ?? '';
    expect(text).toMatch(/spot\.retired_at is null and parking_lot\.id = spot\.lot_id and parking_lot\.operator_id = \$3 and spot\.state in \('AVAILABLE', 'OUT_OF_SERVICE'\)/);
    for (const history of ['parking_session past where past.assigned_spot_id', 'parking_session past where past.confirmed_spot_id', 'spot_hold past where', 'parking_session_reported_spot past where']) {
      expect(text).toContain(`not exists (select 1 from ${history}`);
    }
  });

  it('retires a spot with history out of service, when no active session or hold points at it', async () => {
    const scripted = lockedLot().answer('retire-spot', [{ aisle_id: AISLE_A }]);

    expect(await repositoryOn(scripted).removeSpot(ROY_OPERATOR, spotA3)).toEqual({ kind: 'written', aisleId: AISLE_A });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'delete-unused-spot', 'retire-spot']);
    const text = scripted.statement('retire-spot')?.text ?? '';
    expect(text).toMatch(/set retired_at = now\(\), state = 'OUT_OF_SERVICE', state_changed_at = now\(\)/);
    expect(text).toMatch(/spot\.state in \('AVAILABLE', 'OUT_OF_SERVICE'\)\s+and not exists \(select 1 from parking_session holder where \(holder\.assigned_spot_id = spot\.id or holder\.confirmed_spot_id = spot\.id\) and holder\.state in \(/);
    expect(text).toMatch(/not exists \(select 1 from spot_hold where spot_hold\.spot_id = spot\.id and status = 'ACTIVE'\)/);
  });

  it('answers SPOT_IN_USE for a live spot neither statement could take, and changes nothing', async () => {
    const scripted = lockedLot().answer('read-live-spot', [{ id: SPOT_A3 }]);

    expect(await repositoryOn(scripted).removeSpot(ROY_OPERATOR, spotA3)).toEqual({ kind: 'refused', reason: 'SPOT_IN_USE' });
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'delete-unused-spot', 'retire-spot', 'read-live-spot']);
    expect(scripted.statement('read-live-spot')?.params).toEqual([SPOT_A3, GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('answers SPOT_NOT_FOUND for a spot already retired, another lot’s, or none', async () => {
    expect(await repositoryOn(lockedLot()).removeSpot(ROY_OPERATOR, spotA3)).toEqual({ kind: 'refused', reason: 'SPOT_NOT_FOUND' });
  });

  it('refuses another operator’s lot before touching the spot', async () => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).removeSpot('operator-lavoie', spotA3)).toEqual({ kind: 'refused', reason: 'LOT_NOT_FOUND' });
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot']);
  });
});
