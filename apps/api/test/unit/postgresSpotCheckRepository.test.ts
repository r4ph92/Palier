import { describe, expect, it } from 'vitest';
import { PostgresSpotCheckRepository } from '../../src/infrastructure/postgres/PostgresSpotCheckRepository.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const SOPHIE_OPERATOR = 'operator-lavoie';
const PARKING_DEMO = 'lot-demo';
const SPOT_B2 = 'spot-b2';
const spotB2 = { lotId: PARKING_DEMO, spotId: SPOT_B2 };
const noSpot = { id: null, number: null, level_code: null, aisle_code: null, needs_check_since: null, needs_check_reason: null, state: null };

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresSpotCheckRepository(scripted.database());
}

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-owned-lot', [{ id: PARKING_DEMO }]);
}

describe('reading the spots to check from Postgres', () => {
  it('lists the flagged live spots of the operator’s lot with their time, reason and place, oldest flag first, in one statement', async () => {
    const scripted = new ScriptedSql().answer('read-spots-to-check', [
      { id: 'a1', number: 'A-1', level_code: 'P1', aisle_code: 'A', needs_check_since: new Date('2026-11-13T14:05:00Z'), needs_check_reason: 'WRONG_AISLE', state: 'OCCUPIED_UNKNOWN' },
      { id: 'b2', number: 'B-2', level_code: 'P1', aisle_code: 'B', needs_check_since: '2026-11-13T15:20:00.000Z', needs_check_reason: null, state: 'AVAILABLE' },
    ]);

    const spots = await repositoryOn(scripted).listSpotsToCheck(SOPHIE_OPERATOR, PARKING_DEMO);

    expect(spots).toEqual([
      { spotId: 'a1', number: 'A-1', levelCode: 'P1', aisleCode: 'A', since: '2026-11-13T14:05:00.000Z', reason: 'WRONG_AISLE', state: 'OCCUPIED_UNKNOWN' },
      { spotId: 'b2', number: 'B-2', levelCode: 'P1', aisleCode: 'B', since: '2026-11-13T15:20:00.000Z', reason: null, state: 'AVAILABLE' },
    ]);
    expect(scripted.labels()).toEqual(['read-spots-to-check']);
    const { text, params } = scripted.statement('read-spots-to-check') ?? { text: '', params: [] };
    expect(text).toMatch(/left join spot on spot\.lot_id = parking_lot\.id and spot\.needs_check and spot\.retired_at is null/);
    expect(text).toMatch(/where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2\s+order by spot\.needs_check_since, spot\.number$/);
    expect(params).toEqual([PARKING_DEMO, SOPHIE_OPERATOR]);
  });

  it('reads an owned lot with nothing flagged as an empty list, and another operator’s lot as null', async () => {
    const empty = new ScriptedSql().answer('read-spots-to-check', [noSpot]);

    expect(await repositoryOn(empty).listSpotsToCheck(SOPHIE_OPERATOR, PARKING_DEMO)).toEqual([]);
    expect(await repositoryOn(new ScriptedSql()).listSpotsToCheck('operator-roy', PARKING_DEMO)).toBeNull();
  });
});

describe('clearing the check of a spot in Postgres', () => {
  const free = { state: 'AVAILABLE', needs_check: true, held_by_session: false };

  it('locks the lot, then the spot row, then clears the flag, its time and its reason of that spot in the operator’s lot', async () => {
    const scripted = lockedLot().answer('lock-spot-to-clear', [free]).answer('clear-spot-check', [{ id: SPOT_B2 }]);

    expect(await repositoryOn(scripted).clearSpotCheck(SOPHIE_OPERATOR, spotB2)).toBe('CLEARED');

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'lock-spot-to-clear', 'clear-spot-check']);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    const lock = scripted.statement('lock-spot-to-clear');
    expect(lock?.text).toMatch(/spot\.id = \$\d+ and spot\.lot_id = \$\d+ and spot\.retired_at is null and parking_lot\.id = spot\.lot_id and parking_lot\.operator_id = \$\d+\s+for update of spot$/);
    expect(lock?.text).toMatch(/holder\.assigned_spot_id = spot\.id or holder\.confirmed_spot_id = spot\.id\) and holder\.state in \(/);
    const update = scripted.statement('clear-spot-check');
    expect(update?.text).toMatch(/set needs_check = false, needs_check_since = null, needs_check_reason = null/);
    expect(update?.text).toMatch(/operator_id = \$3/);
    expect(update?.params).toEqual([SPOT_B2, PARKING_DEMO, SOPHIE_OPERATOR]);
  });

  it.each([
    ['occupied-unknown', { ...free, state: 'OCCUPIED_UNKNOWN' }],
    ['assigned', { ...free, state: 'ASSIGNED' }],
    ['held', { ...free, state: 'HELD' }],
    ['free with an active session pointing at it', { ...free, held_by_session: true }],
  ])('refuses a spot that is %s as SPOT_STILL_ASSIGNED and writes nothing', async (_label, row) => {
    const scripted = lockedLot().answer('lock-spot-to-clear', [row]);

    expect(await repositoryOn(scripted).clearSpotCheck(SOPHIE_OPERATOR, spotB2)).toBe('SPOT_STILL_ASSIGNED');
    expect(scripted.count('clear-spot-check')).toBe(0);
  });

  it('answers CLEARED without a write for a spot that is not flagged (a double click)', async () => {
    const scripted = lockedLot().answer('lock-spot-to-clear', [{ ...free, needs_check: false }]);

    expect(await repositoryOn(scripted).clearSpotCheck(SOPHIE_OPERATOR, spotB2)).toBe('CLEARED');
    expect(scripted.count('clear-spot-check')).toBe(0);
  });

  it('answers SPOT_NOT_FOUND for a spot that is retired, another lot’s, or none', async () => {
    expect(await repositoryOn(lockedLot()).clearSpotCheck(SOPHIE_OPERATOR, spotB2)).toBe('SPOT_NOT_FOUND');
  });

  it('refuses another operator’s lot before reading the spot, and a busy lot as LOT_BUSY', async () => {
    const notOwned = new ScriptedSql();
    const busy = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await repositoryOn(notOwned).clearSpotCheck('operator-roy', spotB2)).toBe('LOT_NOT_FOUND');
    expect(notOwned.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot']);
    expect(await repositoryOn(busy).clearSpotCheck(SOPHIE_OPERATOR, spotB2)).toBe('LOT_BUSY');
  });
});
