import { describe, expect, it } from 'vitest';
import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';
import { PostgresLotMapRepository } from '../../src/infrastructure/postgres/PostgresLotMapRepository.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const ROY_OPERATOR = 'operator-roy';
const GARAGE_ROY_NORD = 'lot-roy-nord';
const LEVEL_P1 = 'level-p1';
const LEVEL_P2 = 'level-p2';
const aisleA = { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } };
const placement = { lotId: GARAGE_ROY_NORD, levelId: LEVEL_P1 };
const lotRow = { lot_name: 'Garage Roy Nord', beacon_major: 4 };
const noBattery = { beacon_battery_percent: null, beacon_battery_reported_at: null };
const noAisle = { aisle_id: null, aisle_code: null, beacon_minor: null, is_exit_lane: null, map_polygon: null, ...noBattery };
const READ_AT = new Date('2026-11-13T19:05:00Z');
const lowBattery = { beacon_battery_percent: 15, beacon_battery_reported_at: '2026-11-13 19:05:00+00' };
const p1Row = { ...lotRow, level_id: LEVEL_P1, level_code: 'P1', display_order: 1 };
const p2Row = { ...lotRow, level_id: LEVEL_P2, level_code: 'P2', display_order: 2 };

function uniqueViolation(constraintName: string) {
  return { code: '23505', constraint_name: constraintName };
}

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresLotMapRepository(scripted.database());
}

describe('reading the map of a lot from Postgres', () => {
  it('groups aisles under their level, in the order of the statement, with the platform UUID and the lot major', async () => {
    const scripted = new ScriptedSql().answer('read-lot-map', [
      { ...p1Row, aisle_id: 'aisle-a', aisle_code: 'A', beacon_minor: 1, is_exit_lane: false, map_polygon: aisleA.rectangle, ...lowBattery },
      { ...p1Row, aisle_id: 'exit', aisle_code: 'Sortie', beacon_minor: 0, is_exit_lane: true, map_polygon: null, ...noBattery },
      { ...p2Row, ...noAisle },
    ]);

    const map = await repositoryOn(scripted).readLotMap(ROY_OPERATOR, GARAGE_ROY_NORD);

    expect(map).toEqual({
      lotId: GARAGE_ROY_NORD,
      lotName: 'Garage Roy Nord',
      platformUuid: PLATFORM_BEACON_UUID,
      beaconMajor: 4,
      levels: [
        {
          id: LEVEL_P1,
          code: 'P1',
          displayOrder: 1,
          aisles: [
            { id: 'aisle-a', code: 'A', beaconMinor: 1, isExitLane: false, rectangle: aisleA.rectangle, batteryPercent: 15, batteryReportedAt: READ_AT },
            { id: 'exit', code: 'Sortie', beaconMinor: 0, isExitLane: true, rectangle: null, batteryPercent: null, batteryReportedAt: null },
          ],
        },
        { id: LEVEL_P2, code: 'P2', displayOrder: 2, aisles: [] },
      ],
    });
    const statement = scripted.statement('read-lot-map');
    expect(statement?.text).toMatch(/where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2\s+order by level\.display_order, level\.code, aisle\.is_exit_lane, aisle\.code/);
    expect(statement?.params).toEqual([GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('reads a lot with no level as an empty map, and a stored shape it refuses as undrawn', async () => {
    const empty = new ScriptedSql().answer('read-lot-map', [{ ...lotRow, level_id: null, level_code: null, display_order: null, ...noAisle }]);
    const refused = new ScriptedSql().answer('read-lot-map', [{ ...p1Row, ...noAisle, aisle_id: 'a', aisle_code: 'A', beacon_minor: 1, is_exit_lane: false, map_polygon: { x: -5 } }]);

    expect((await repositoryOn(empty).readLotMap(ROY_OPERATOR, GARAGE_ROY_NORD))?.levels).toEqual([]);
    expect((await repositoryOn(refused).readLotMap(ROY_OPERATOR, GARAGE_ROY_NORD))?.levels[0]?.aisles[0]?.rectangle).toBeNull();
  });

  it('answers null for a lot of another operator', async () => {
    expect(await repositoryOn(new ScriptedSql()).readLotMap('operator-lavoie', GARAGE_ROY_NORD)).toBeNull();
  });
});

describe('adding a level in Postgres', () => {
  it('locks the operator’s lot, appends the level and gives the lot its exit lane, minor 0, in one transaction', async () => {
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).answer('insert-level', [{ id: LEVEL_P1 }]);

    expect(await repositoryOn(scripted).addLevel(ROY_OPERATOR, GARAGE_ROY_NORD, 'P1')).toBe('WRITTEN');

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'insert-level', 'insert-exit-lane']);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.statement('lock-owned-lot')?.params).toEqual([GARAGE_ROY_NORD, ROY_OPERATOR]);
    const level = scripted.statement('insert-level');
    expect(level?.text).toMatch(/coalesce\(max\(level\.display_order\), 0\) \+ 1/);
    expect(level?.text).toMatch(/having count\(level\.id\) < \$4/);
    expect(level?.params).toEqual(['P1', GARAGE_ROY_NORD, ROY_OPERATOR, 20]);
    const exitLane = scripted.statement('insert-exit-lane');
    expect(exitLane?.text).toContain('on conflict on constraint "aisle_lot_id_beacon_minor_unique" do nothing');
    expect(exitLane?.params).toEqual(['Sortie', 0, LEVEL_P1, ROY_OPERATOR]);
  });

  it('refuses another operator’s lot at the lock, before reading or writing anything else', async () => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).addLevel('operator-lavoie', GARAGE_ROY_NORD, 'P1')).toBe('LOT_NOT_FOUND');
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot']);
  });

  it('refuses a 21st level without adding an exit lane', async () => {
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).answer('insert-level', []);

    expect(await repositoryOn(scripted).addLevel(ROY_OPERATOR, GARAGE_ROY_NORD, 'P21')).toBe('LEVEL_LIMIT_REACHED');
    expect(scripted.count('insert-exit-lane')).toBe(0);
  });

  it('reads a taken code from the constraint that refused it, and a lock past its wait as a busy lot', async () => {
    const taken = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).fail('insert-level', uniqueViolation('level_lot_id_code_unique'));
    const busy = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await repositoryOn(taken).addLevel(ROY_OPERATOR, GARAGE_ROY_NORD, 'P1')).toBe('LEVEL_CODE_TAKEN');
    expect(await repositoryOn(busy).addLevel(ROY_OPERATOR, GARAGE_ROY_NORD, 'P1')).toBe('LOT_BUSY');
  });

  it('lets any other failure through', async () => {
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).fail('insert-level', { code: '23502' });

    await expect(repositoryOn(scripted).addLevel(ROY_OPERATOR, GARAGE_ROY_NORD, 'P1')).rejects.toThrow('Failed query');
  });
});

describe('reordering levels in Postgres', () => {
  function lockedWithLevels(...levelIds: string[]) {
    return new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).answer('read-level-ids', levelIds.map((id) => ({ id })));
  }

  it('numbers P2 then P1 from their place in the list, in one update', async () => {
    const scripted = lockedWithLevels(LEVEL_P1, LEVEL_P2);

    expect(await repositoryOn(scripted).reorderLevels(ROY_OPERATOR, GARAGE_ROY_NORD, { levelIds: [LEVEL_P2, LEVEL_P1], fromLevelIds: [LEVEL_P1, LEVEL_P2] })).toBe('WRITTEN');

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-level-ids', 'reorder-levels']);
    const update = scripted.statement('reorder-levels');
    expect(update?.text).toMatch(/set display_order = ordered\.position::int\s+from unnest\(array\[\$1, \$2\]::uuid\[\]\) with ordinality as ordered\(id, position\)/);
    expect(update?.params).toEqual([LEVEL_P2, LEVEL_P1, GARAGE_ROY_NORD, ROY_OPERATOR]);
    expect(scripted.statement('read-level-ids')?.text).toMatch(/order by level\.display_order, level\.code$/);
    expect(scripted.statement('read-level-ids')?.params).toEqual([GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it.each([
    ['a level of another lot', { levelIds: [LEVEL_P1, 'level-of-sophie'], fromLevelIds: [LEVEL_P1, LEVEL_P2] }],
    ['a missing level', { levelIds: [LEVEL_P1], fromLevelIds: [LEVEL_P1, LEVEL_P2] }],
    ['a level twice', { levelIds: [LEVEL_P1, LEVEL_P1], fromLevelIds: [LEVEL_P1, LEVEL_P2] }],
    ['no change', { levelIds: [LEVEL_P1, LEVEL_P2], fromLevelIds: [LEVEL_P1, LEVEL_P2] }],
    ['a move made from an order the lot no longer has', { levelIds: [LEVEL_P2, LEVEL_P1], fromLevelIds: [LEVEL_P2, LEVEL_P1] }],
  ])('refuses an order with %s and changes nothing', async (_case, order) => {
    const scripted = lockedWithLevels(LEVEL_P1, LEVEL_P2);

    expect(await repositoryOn(scripted).reorderLevels(ROY_OPERATOR, GARAGE_ROY_NORD, order)).toBe('LEVEL_ORDER_INVALID');
    expect(scripted.count('reorder-levels')).toBe(0);
  });
});

describe('adding an aisle in Postgres', () => {
  it('inserts aisle A with minor 1 and its rectangle only on a level of the operator’s lot', async () => {
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).answer('insert-aisle', [{ id: 'aisle-a' }]);

    expect(await repositoryOn(scripted).addAisle(ROY_OPERATOR, placement, aisleA)).toBe('WRITTEN');

    const insert = scripted.statement('insert-aisle');
    expect(insert?.text).toMatch(/where level\.id = \$4 and level\.lot_id = \$5 and parking_lot\.operator_id = \$6/);
    expect(insert?.params).toEqual(['A', 1, '{"x":0,"y":0,"width":100,"height":40}', LEVEL_P1, GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('refuses a level that is not one of this lot’s', async () => {
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).answer('insert-aisle', []);

    expect(await repositoryOn(scripted).addAisle(ROY_OPERATOR, { ...placement, levelId: 'level-of-sophie' }, aisleA)).toBe('LEVEL_NOT_FOUND');
  });

  it.each([
    ['aisle_lot_id_beacon_minor_unique', 'AISLE_MINOR_TAKEN'],
    ['aisle_level_id_code_unique', 'AISLE_CODE_TAKEN'],
  ])('reads a violation of %s as %s', async (constraint, refusal) => {
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]).fail('insert-aisle', uniqueViolation(constraint));

    expect(await repositoryOn(scripted).addAisle(ROY_OPERATOR, placement, aisleA)).toBe(refusal);
  });
});

describe('recording a beacon battery reading in Postgres', () => {
  const placement = { lotId: GARAGE_ROY_NORD, aisleId: 'aisle-a' };
  const reading = { percent: 15, reportedAt: READ_AT };

  it("writes on the aisle of the operator's lot in one statement, without reading the lot first", async () => {
    const scripted = new ScriptedSql().answer('record-aisle-battery', [{ id: 'aisle-a' }]);

    expect(await repositoryOn(scripted).recordBeaconBattery(ROY_OPERATOR, placement, reading)).toBe('WRITTEN');
    expect(scripted.labels()).toEqual(['record-aisle-battery']);
    const write = scripted.statement('record-aisle-battery');
    expect(write?.text).toMatch(/where aisle\.id = \$3 and aisle\.lot_id = \$4 and parking_lot\.id = aisle\.lot_id and parking_lot\.operator_id = \$5\s+returning aisle\.id/);
    expect(write?.params).toEqual([15, READ_AT.toISOString(), 'aisle-a', GARAGE_ROY_NORD, ROY_OPERATOR]);
    expect(scripted.isolationLevels).toEqual([]);
  });

  it("answers LOT_NOT_FOUND for another operator's lot, whose aisles the write never matched", async () => {
    const scripted = new ScriptedSql().answer('record-aisle-battery', []).answer('read-owned-lot-id', []);

    expect(await repositoryOn(scripted).recordBeaconBattery('operator-lavoie', placement, reading)).toBe('LOT_NOT_FOUND');
    expect(scripted.labels()).toEqual(['record-aisle-battery', 'read-owned-lot-id']);
    expect(scripted.statement('read-owned-lot-id')?.params).toEqual([GARAGE_ROY_NORD, 'operator-lavoie']);
  });

  it("answers AISLE_NOT_FOUND when the lot is the operator's but no aisle of it was written", async () => {
    const scripted = new ScriptedSql().answer('record-aisle-battery', []).answer('read-owned-lot-id', [{ id: GARAGE_ROY_NORD }]);

    expect(await repositoryOn(scripted).recordBeaconBattery(ROY_OPERATOR, placement, reading)).toBe('AISLE_NOT_FOUND');
  });
});
