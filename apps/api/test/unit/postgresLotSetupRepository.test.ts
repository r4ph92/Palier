import { describe, expect, it } from 'vitest';
import { parsePricingPolicy } from '../../src/domain/pricing/PricingPolicy.ts';
import { PostgresLotSetupRepository } from '../../src/infrastructure/postgres/PostgresLotSetupRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const ROY_OPERATOR = 'operator-roy';
const LOT = 'lot-roy-nord';
const garageRoyNord = { name: 'Garage Roy Nord', address: '8000, boulevard Saint-Laurent', latitude: 45.54, longitude: -73.62, capacity: 40 };
const royPricing = { incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 };
const createdRow = {
  id: LOT,
  name: 'Garage Roy Nord',
  is_online: false,
  address: '8000, boulevard Saint-Laurent',
  latitude: '45.540000',
  longitude: '-73.620000',
  capacity: 40,
  beacon_major: 4,
  pricing_policy: null,
  daily_cap_cents: null,
  hold_quota: 3,
};
const pricedRow = { ...createdRow, pricing_policy: { incrementCents: 100, incrementMinutes: 20 }, daily_cap_cents: 1800, hold_quota: 4 };

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresLotSetupRepository(scripted.database());
}

describe('the Postgres lot setup repository', () => {
  it('inserts an offline lot for the operator, leaves the beacon major to its sequence and reads it back', async () => {
    const scripted = new ScriptedSql().answer('insert-lot', [createdRow]);

    const created = await repositoryOn(scripted).createLot(ROY_OPERATOR, garageRoyNord);

    const insert = scripted.statement('insert-lot');
    expect(insert?.text).toMatch(/\(operator_id, name, address, latitude, longitude, capacity, is_online\)/);
    expect(insert?.text).toMatch(/returning .*beacon_major/);
    expect(insert?.params).toEqual([ROY_OPERATOR, 'Garage Roy Nord', '8000, boulevard Saint-Laurent', 45.54, -73.62, 40]);
    expect(created).toEqual({ ...garageRoyNord, id: LOT, isOnline: false, beaconMajor: 4, pricing: null });
  });

  it('writes the policy, the cap and the quota in one update scoped by lot and operator, and nothing else', async () => {
    const scripted = new ScriptedSql().answer('update-lot-pricing', [pricedRow]);

    const updated = await repositoryOn(scripted).updateLotPricing(ROY_OPERATOR, LOT, royPricing);

    const update = scripted.statement('update-lot-pricing');
    expect(scripted.labels()).toEqual(['update-lot-pricing']);
    expect(update?.text).toMatch(/set pricing_policy = \$1::jsonb, daily_cap_cents = \$2, hold_quota = \$3\s+where id = \$4 and operator_id = \$5/);
    expect(update?.params).toEqual(['{"incrementCents":100,"incrementMinutes":20}', 1800, 4, LOT, ROY_OPERATOR]);
    expect(update?.text).not.toContain('parking_session');
    expect(updated?.pricing).toEqual(royPricing);
  });

  it('stores a policy that sessions entering afterwards read back as the saved pricing', async () => {
    const scripted = new ScriptedSql();

    await repositoryOn(scripted).updateLotPricing(ROY_OPERATOR, LOT, royPricing);

    const storedPolicy: unknown = JSON.parse(String(scripted.statement('update-lot-pricing')?.params[0]));
    expect(parsePricingPolicy(storedPolicy, 1800)).toEqual({ incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800 });
  });

  it('answers null when the operator has no lot with this id', async () => {
    const scripted = new ScriptedSql().answer('update-lot-pricing', []).answer('read-lot-details', []);
    const repository = repositoryOn(scripted);

    expect(await repository.updateLotPricing('operator-lavoie', LOT, royPricing)).toBeNull();
    expect(await repository.findLotDetailsOfOperator('operator-lavoie', LOT)).toBeNull();
    expect(scripted.statement('read-lot-details')?.params).toEqual([LOT, 'operator-lavoie']);
  });

  it('reads a lot with no coordinates and no major as nulls, never as zeros', async () => {
    const scripted = new ScriptedSql().answer('read-lot-details', [{ ...pricedRow, latitude: null, longitude: null, beacon_major: null }]);

    const found = await repositoryOn(scripted).findLotDetailsOfOperator(ROY_OPERATOR, LOT);

    expect(found).toMatchObject({ latitude: null, longitude: null, beaconMajor: null, pricing: royPricing });
  });
});
