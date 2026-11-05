import { describe, expect, it } from 'vitest';
import { PostgresSpotHoldRepository } from '../../src/infrastructure/postgres/PostgresSpotHoldRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const LOT_ID = 'lot-demo';
const parkingDemoRow = { id: LOT_ID, name: 'Parking Démo', is_online: true, capacity: 10, vehicle_count: 0 };

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
