import { describe, expect, it } from 'vitest';
import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldDraft, SpotHoldRelease } from '../../src/domain/spotHolds/SpotHoldRepository.ts';
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
    expect(scripted.statements).toEqual([expect.objectContaining({ label: 'read-active-spot-hold', params: ['driver-julie'], onTransaction: false })]);
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

const release: SpotHoldRelease = { driverId: 'driver-julie', spotHoldId: 'hold-1', lotId: LOT_ID, releasedAt: new Date('2026-11-04T19:05:00Z') };

function scriptedRelease(): ScriptedSql {
  return new ScriptedSql()
    .answer('lock-lot', [parkingDemoRow])
    .answer('release-spot-hold', [{ spot_id: 'spot-A-1' }])
    .answer('free-held-spot', [{ id: 'spot-A-1' }]);
}

function textOf(scripted: ScriptedSql, label: StatementLabel): string {
  return scripted.statements.find((statement) => statement.label === label)?.text ?? '';
}

function releaseWith(scripted: ScriptedSql) {
  return new PostgresSpotHoldRepository(scripted.database()).releaseSpotHold(release);
}

describe('releasing a spot hold under the lot lock', () => {
  it('bounds the lock wait, locks the lot, then marks the hold RELEASED and frees its spot, all on READ COMMITTED', async () => {
    const scripted = scriptedRelease();

    await releaseWith(scripted);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'release-spot-hold', 'free-held-spot']);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.isolationLevels).toEqual(['read committed']);
  });

  it('updates the hold by id and driver, and frees the spot with the request\'s instant, not the database clock', async () => {
    const scripted = scriptedRelease();

    await releaseWith(scripted);

    expect(paramsOf(scripted, 'lock-lot')).toEqual([LOT_ID]);
    expect(paramsOf(scripted, 'release-spot-hold')).toEqual(['hold-1', 'driver-julie']);
    expect(paramsOf(scripted, 'free-held-spot')).toEqual(['2026-11-04T19:05:00.000Z', 'spot-A-1']);
  });

  it('only releases an ACTIVE hold and only frees a HELD spot', async () => {
    const scripted = scriptedRelease();

    await releaseWith(scripted);

    expect(textOf(scripted, 'release-spot-hold')).toContain("status = 'ACTIVE'");
    expect(textOf(scripted, 'free-held-spot')).toContain("state = 'HELD'");
  });

  it('refuses HOLD_UNAVAILABLE and updates nothing when the lot lock times out', async () => {
    const scripted = scriptedRelease().fail('lock-lot', new Error('Failed query', { cause: { code: '55P03' } }));

    const error: unknown = await releaseWith(scripted).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ reason: 'HOLD_UNAVAILABLE' });
    expect(scripted.count('release-spot-hold')).toBe(0);
    expect(scripted.count('free-held-spot')).toBe(0);
  });

  it('refuses HOLD_NOT_FOUND and frees no spot when a concurrent release got there first', async () => {
    const scripted = new ScriptedSql().answer('lock-lot', [parkingDemoRow]);

    const error: unknown = await releaseWith(scripted).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ reason: 'HOLD_NOT_FOUND' });
    expect(scripted.count('free-held-spot')).toBe(0);
  });

  it('fails the transaction, so the hold stays ACTIVE, when its spot is not HELD', async () => {
    const scripted = new ScriptedSql().answer('lock-lot', [parkingDemoRow]).answer('release-spot-hold', [{ spot_id: 'spot-A-1' }]);

    await expect(releaseWith(scripted)).rejects.toThrow('was not held');
  });
});

describe('reading one of the driver\'s own holds', () => {
  it('matches the hold id and the driver together, on the pool', async () => {
    const scripted = new ScriptedSql().answer('read-active-spot-hold', [
      { id: 'hold-1', lot_id: LOT_ID, lot_name: 'Parking Démo', expires_at: '2026-11-04 19:17:00+00' },
    ]);

    const found = await new PostgresSpotHoldRepository(scripted.database()).findOwnActiveSpotHold('driver-julie', 'hold-1');

    expect(found).toEqual({ id: 'hold-1', lotId: LOT_ID, lotName: 'Parking Démo', expiresAt: EXPIRES_AT });
    expect(scripted.statements).toEqual([expect.objectContaining({ label: 'read-active-spot-hold', params: ['hold-1', 'driver-julie'], onTransaction: false })]);
  });

  it('answers null when the id and the driver match no active hold', async () => {
    expect(await new PostgresSpotHoldRepository(new ScriptedSql().database()).findOwnActiveSpotHold('driver-marc', 'hold-1')).toBeNull();
  });
});

describe('expiring the spot holds of a lot', () => {
  const NOW = new Date('2026-11-04T19:17:00Z');

  function expireWith(scripted: ScriptedSql) {
    return new PostgresSpotHoldRepository(scripted.database()).expireLotSpotHolds(LOT_ID, NOW);
  }

  function endingTwoHolds(): ScriptedSql {
    return new ScriptedSql()
      .answer('lock-lot', [parkingDemoRow])
      .answer('expire-spot-holds', [{ spot_id: 'spot-A-1' }, { spot_id: 'spot-A-2' }])
      .answer('free-held-spot', [{ id: 'spot-A-1' }], [{ id: 'spot-A-2' }]);
  }

  it('bounds the lock wait, locks the lot, ends the holds, then frees each spot', async () => {
    const scripted = endingTwoHolds();

    const expiry = await expireWith(scripted);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'expire-spot-holds', 'free-held-spot', 'free-held-spot']);
    expect(expiry).toEqual({ expired: 2, freed: 2 });
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.isolationLevels).toEqual(['read committed']);
  });

  it('ends only the ACTIVE holds of the lot whose end has passed, at the clock reading', async () => {
    const scripted = endingTwoHolds();

    await expireWith(scripted);

    const statement = scripted.statements.find(({ label }) => label === 'expire-spot-holds');
    expect(statement?.text).toContain(`status = 'EXPIRED'`);
    expect(statement?.text).toContain(`status = 'ACTIVE'`);
    expect(statement?.text).toContain('expires_at <=');
    expect(statement?.params).toEqual([LOT_ID, NOW.toISOString()]);
  });

  it('frees only a HELD spot, stamped with the clock reading', async () => {
    const scripted = endingTwoHolds();

    await expireWith(scripted);

    const statement = scripted.statements.find(({ label }) => label === 'free-held-spot');
    expect(statement?.text).toContain(`state = 'HELD'`);
    expect(statement?.params).toEqual([NOW.toISOString(), 'spot-A-1']);
  });

  it('frees nothing when a concurrent run already ended the holds', async () => {
    const scripted = new ScriptedSql().answer('lock-lot', [parkingDemoRow]);

    const expiry = await expireWith(scripted);

    expect(expiry).toEqual({ expired: 0, freed: 0 });
    expect(scripted.count('free-held-spot')).toBe(0);
  });

  it('counts an expired hold whose spot was no longer held as not freed', async () => {
    const scripted = new ScriptedSql().answer('lock-lot', [parkingDemoRow]).answer('expire-spot-holds', [{ spot_id: 'spot-A-1' }]);

    expect(await expireWith(scripted)).toEqual({ expired: 1, freed: 0 });
  });

  it('lets a lock timeout through for the job to log and retry', async () => {
    const timeout = new Error('lock timeout');
    const scripted = endingTwoHolds().fail('lock-lot', timeout);

    await expect(expireWith(scripted)).rejects.toBe(timeout);
    expect(scripted.count('expire-spot-holds')).toBe(0);
  });

  it('finds the lots with an expired hold before any lock, at the clock reading', async () => {
    const scripted = new ScriptedSql().answer('find-expired-hold-lots', [{ lot_id: LOT_ID }]);

    const lotIds = await new PostgresSpotHoldRepository(scripted.database()).findLotsWithExpiredHolds(NOW);

    expect(lotIds).toEqual([LOT_ID]);
    expect(scripted.labels()).toEqual(['find-expired-hold-lots']);
    expect(scripted.statements[0]?.onTransaction).toBe(false);
    expect(scripted.statements[0]?.text).toContain('expires_at <=');
    expect(scripted.statements[0]?.params).toEqual([NOW.toISOString()]);
  });
});
