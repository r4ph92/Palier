import { describe, expect, it } from 'vitest';
import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldDraft } from '../../src/domain/spotHolds/SpotHoldRepository.ts';
import { PostgresSpotHoldRepository } from '../../src/infrastructure/postgres/PostgresSpotHoldRepository.ts';
import { ScriptedSql, type StatementLabel } from './fakes/scriptedSql.ts';

const LOT_ID = 'lot-demo';
const CREATED_AT = new Date('2026-11-04T19:02:00Z');
const EXPIRES_AT = new Date('2026-11-04T19:17:00Z');

const draft: SpotHoldDraft = {
  driverId: 'driver-julie',
  lotId: LOT_ID,
  needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
  createdAt: CREATED_AT,
  expiresAt: EXPIRES_AT,
};

const parkingDemoRow = { id: LOT_ID, name: 'Parking Démo', is_online: true, capacity: 10, vehicle_count: 0 };
const noHoldYet = { own_active_hold: false, active_holds_in_lot: 0, held_spot_count: 0 };
const freeSpot = (number: string, isEv = false) => ({
  id: `spot-${number}`,
  number,
  level_order: 1,
  aisle_code: 'A',
  distance_to_exit: 1,
  needs_check: false,
  is_ev: isEv,
  is_accessible: false,
  is_oversize: false,
});

interface HoldScript {
  readonly lot?: typeof parkingDemoRow | null;
  readonly facts?: typeof noHoldYet;
  readonly spots?: readonly ReturnType<typeof freeSpot>[];
}

function scriptedHold({ lot = parkingDemoRow, facts = noHoldYet, spots = [freeSpot('A-1')] }: HoldScript = {}): ScriptedSql {
  return new ScriptedSql()
    .answer('lock-lot', lot === null ? [] : [lot])
    .answer('read-spot-hold-facts', [facts])
    .answer('read-free-spots', [...spots])
    .answer('claim-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
    .answer('insert-spot-hold', [{ id: 'hold-1' }]);
}

function placeWith(scripted: ScriptedSql) {
  return new PostgresSpotHoldRepository(scripted.database()).placeSpotHold(draft);
}

async function refusalOf(scripted: ScriptedSql): Promise<SpotHoldRefusalCode | undefined> {
  const error: unknown = await placeWith(scripted).catch((caught: unknown) => caught);
  return error instanceof SpotHoldRefusedError ? error.reason : undefined;
}

function paramsOf(scripted: ScriptedSql, label: StatementLabel): readonly unknown[] | undefined {
  return scripted.statements.find((statement) => statement.label === label)?.params;
}

describe('placing a spot hold under the lot lock', () => {
  it('bounds the lock wait, locks the lot, reads the facts, then claims a spot and inserts the hold', async () => {
    const scripted = scriptedHold();

    await placeWith(scripted);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'read-spot-hold-facts', 'read-free-spots', 'claim-spot', 'insert-spot-hold']);
  });

  it('runs every statement on a READ COMMITTED transaction', async () => {
    const scripted = scriptedHold();

    await placeWith(scripted);

    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.isolationLevels).toEqual(['read committed']);
  });

  it('locks the requested lot and counts its holds for this driver', async () => {
    const scripted = scriptedHold();

    await placeWith(scripted);

    expect(paramsOf(scripted, 'lock-lot')).toEqual([LOT_ID]);
    expect(paramsOf(scripted, 'read-spot-hold-facts')).toEqual(['driver-julie', LOT_ID, LOT_ID]);
  });

  it('moves the claimed spot to HELD and records the request\'s instants, not the database clock', async () => {
    const scripted = scriptedHold();

    await placeWith(scripted);

    expect(paramsOf(scripted, 'claim-spot')).toEqual(['spot-A-1', 'HELD', CREATED_AT.toISOString()]);
    expect(paramsOf(scripted, 'insert-spot-hold')).toEqual(['driver-julie', LOT_ID, 'spot-A-1', CREATED_AT.toISOString(), EXPIRES_AT.toISOString()]);
  });

  it('answers the hold with the lot name read under the lock and never the spot number', async () => {
    const placed = await placeWith(scriptedHold());

    expect(placed).toEqual({ id: 'hold-1', lotId: LOT_ID, lotName: 'Parking Démo', expiresAt: EXPIRES_AT });
    expect(JSON.stringify(placed)).not.toContain('A-1');
  });

  it.each([
    ['the lot does not exist', { lot: null }, 'LOT_NOT_FOUND'],
    ['the lot went offline', { lot: { ...parkingDemoRow, is_online: false } }, 'LOT_NOT_IN_SERVICE'],
    ['the driver already holds a spot', { facts: { ...noHoldYet, own_active_hold: true } }, 'HOLD_ALREADY_EXISTS'],
    ['Marc and two other drivers use the quota of 3', { facts: { ...noHoldYet, active_holds_in_lot: 3 } }, 'HOLD_QUOTA_REACHED'],
    ['vehicles and held spots fill the lot', { lot: { ...parkingDemoRow, vehicle_count: 8 }, facts: { ...noHoldYet, active_holds_in_lot: 2, held_spot_count: 2 } }, 'NO_SUITABLE_SPOT'],
  ])('refuses before claiming a spot when %s', async (_case, script: HoldScript, reason) => {
    const scripted = scriptedHold(script);

    expect(await refusalOf(scripted)).toBe(reason);
    expect(scripted.count('claim-spot')).toBe(0);
    expect(scripted.count('insert-spot-hold')).toBe(0);
  });

  it('refuses NO_SUITABLE_SPOT and inserts nothing when every fitting spot is claimed by another writer first', async () => {
    const scripted = new ScriptedSql()
      .answer('lock-lot', [parkingDemoRow])
      .answer('read-spot-hold-facts', [noHoldYet])
      .answer('read-free-spots', [freeSpot('A-1'), freeSpot('A-2')])
      .answer('claim-spot', [], []);

    expect(await refusalOf(scripted)).toBe('NO_SUITABLE_SPOT');
    expect(scripted.count('claim-spot')).toBe(2);
    expect(scripted.count('insert-spot-hold')).toBe(0);
  });

  it('refuses NO_SUITABLE_SPOT and inserts nothing when no free spot fits the default vehicle', async () => {
    const scripted = scriptedHold({ spots: [freeSpot('A-5', true)] });

    expect(await refusalOf(scripted)).toBe('NO_SUITABLE_SPOT');
    expect(scripted.count('claim-spot')).toBe(0);
    expect(scripted.count('insert-spot-hold')).toBe(0);
  });
});

describe('reading spot holds before the lot lock', () => {
  it('reads the driver\'s active hold on the pool, outside any transaction', async () => {
    const scripted = new ScriptedSql().answer('read-active-spot-hold', [
      { id: 'hold-1', lot_id: LOT_ID, lot_name: 'Parking Démo', expires_at: '2026-11-04 19:17:00+00' },
    ]);

    const active = await new PostgresSpotHoldRepository(scripted.database()).findActiveSpotHold('driver-julie');

    expect(active).toEqual({ id: 'hold-1', lotId: LOT_ID, lotName: 'Parking Démo', expiresAt: EXPIRES_AT });
    expect(scripted.statements).toEqual([{ label: 'read-active-spot-hold', params: ['driver-julie'], onTransaction: false }]);
  });

  it('answers null for a driver without an active hold', async () => {
    expect(await new PostgresSpotHoldRepository(new ScriptedSql().database()).findActiveSpotHold('driver-julie')).toBeNull();
  });

  it('reads the lot\'s terms with its operator\'s account on the pool', async () => {
    const scripted = new ScriptedSql().answer('read-spot-hold-lot', [
      { id: LOT_ID, is_online: true, pricing_policy: { incrementCents: 75, incrementMinutes: 15 }, daily_cap_cents: 2500, stripe_account_id: 'acct_1Lavoie' },
    ]);

    const lot = await new PostgresSpotHoldRepository(scripted.database()).findSpotHoldLot(LOT_ID);

    expect(lot).toEqual({ id: LOT_ID, isOnline: true, pricingPolicy: { incrementCents: 75, incrementMinutes: 15 }, dailyCapCents: 2500, operatorStripeAccountId: 'acct_1Lavoie' });
    expect(scripted.statements.every(({ onTransaction }) => !onTransaction)).toBe(true);
  });

  it('answers null for an unknown lot', async () => {
    expect(await new PostgresSpotHoldRepository(new ScriptedSql().database()).findSpotHoldLot(LOT_ID)).toBeNull();
  });
});
