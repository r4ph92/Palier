import { describe, expect, it } from 'vitest';
import { assignFirstFreeSpot } from '../../src/infrastructure/postgres/spotClaim.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const LOT_ID = 'lot-demo';
const STANDARD_CAR = { isElectric: false, hasAccessiblePermit: false, isOversize: false };
const SPOT_NUMBERS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6'];

const freeSpotRows = SPOT_NUMBERS.map((number, index) => ({
  id: `spot-${number}`,
  number,
  level_order: 1,
  aisle_code: 'A',
  distance_to_exit: index + 1,
  needs_check: false,
  is_ev: false,
  is_accessible: false,
  is_oversize: false,
}));

function claimedRow(number: string) {
  return { id: `spot-${number}`, number, aisle_code: 'A', level_code: 'P1' };
}

function claimedSpotIds(scripted: ScriptedSql): unknown[] {
  return scripted.statements.filter(({ label }) => label === 'claim-spot').map(({ params }) => params[0]);
}

describe('claiming the first free spot under the lot lock', () => {
  it('moves past four spots another writer holds and claims the fifth', async () => {
    const scripted = new ScriptedSql().answer('read-free-spots', freeSpotRows).answer('claim-spot', [], [], [], [], [claimedRow('A-5')]);

    const assigned = await assignFirstFreeSpot(scripted.executor(), LOT_ID, STANDARD_CAR);

    expect(assigned).toEqual(claimedRow('A-5'));
    expect(claimedSpotIds(scripted)).toEqual(['spot-A-1', 'spot-A-2', 'spot-A-3', 'spot-A-4', 'spot-A-5']);
  });

  it('tries every free spot once and answers undefined when all of them are lost', async () => {
    const scripted = new ScriptedSql().answer('read-free-spots', freeSpotRows);

    const assigned = await assignFirstFreeSpot(scripted.executor(), LOT_ID, STANDARD_CAR);

    expect(assigned).toBeUndefined();
    expect(claimedSpotIds(scripted)).toEqual(SPOT_NUMBERS.map((number) => `spot-${number}`));
  });

  it('reads the free spots once, however many claims it loses', async () => {
    const scripted = new ScriptedSql().answer('read-free-spots', freeSpotRows).answer('claim-spot', [], [], [], [claimedRow('A-4')]);

    await assignFirstFreeSpot(scripted.executor(), LOT_ID, STANDARD_CAR);

    expect(scripted.count('read-free-spots')).toBe(1);
  });

  it('claims nothing in a lot without a free spot', async () => {
    const scripted = new ScriptedSql();

    expect(await assignFirstFreeSpot(scripted.executor(), LOT_ID, STANDARD_CAR)).toBeUndefined();
    expect(scripted.labels()).toEqual(['read-free-spots']);
  });
});
