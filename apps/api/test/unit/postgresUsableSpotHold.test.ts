import { describe, expect, it } from 'vitest';
import { PostgresSpotHoldRepository } from '../../src/infrastructure/postgres/PostgresSpotHoldRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const query = { driverId: 'driver-julie', lotId: 'lot-demo', now: new Date('2026-11-05T12:00:00Z') };

describe('PostgresSpotHoldRepository.hasUsableSpotHold', () => {
  it('asks for the driver’s active hold in this lot that is still running at the API clock instant', async () => {
    const scripted = new ScriptedSql();

    await new PostgresSpotHoldRepository(scripted.database()).hasUsableSpotHold(query);

    const [statement] = scripted.statements;
    expect(statement?.text).toMatch(/from spot_hold where user_id = \$1 and lot_id = \$2 and status = 'ACTIVE' and expires_at > \$3::timestamptz/);
    expect(statement?.params).toEqual([query.driverId, query.lotId, query.now.toISOString()]);
  });

  it('is true when a hold row answers and false when none does', async () => {
    const holds = new PostgresSpotHoldRepository(new ScriptedSql().answer('has-usable-spot-hold', [{ '?column?': 1 }]).database());
    const none = new PostgresSpotHoldRepository(new ScriptedSql().database());

    expect(await holds.hasUsableSpotHold(query)).toBe(true);
    expect(await none.hasUsableSpotHold(query)).toBe(false);
  });
});
