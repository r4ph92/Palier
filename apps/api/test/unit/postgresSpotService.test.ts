import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { PostgresLotSpotRepository } from '../../src/infrastructure/postgres/PostgresLotSpotRepository.ts';
import { putBackInServiceStatement, takeOutOfServiceStatement } from '../../src/infrastructure/postgres/lotSpotStatements.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const OPERATOR = 'operator-sophie';
const spot = { lotId: 'lot-demo', spotId: 'spot-a3' };
const dialect = new PgDialect();

function repositoryOn(scripted: ScriptedSql) {
  return new PostgresLotSpotRepository(scripted.database());
}

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-owned-lot', [{ id: spot.lotId }]);
}

describe('the service statements', () => {
  it('take out only a free live spot nobody holds, assigned, confirmed or reported', () => {
    const { sql } = dialect.sqlToQuery(takeOutOfServiceStatement(OPERATOR, spot));
    expect(sql).toContain("spot.state = 'AVAILABLE'");
    expect(sql).toContain('spot.retired_at is null');
    expect(sql).toMatch(/operator_id = \$\d+/);
    expect(sql).toMatch(/holder\.assigned_spot_id = spot\.id or holder\.confirmed_spot_id = spot\.id/);
    expect(sql).toMatch(/not exists \(select 1 from spot_hold/);
    expect(sql).toMatch(/not exists \(select 1 from parking_session_reported_spot reported join parking_session reporter/);
  });

  it('put back only a live out-of-service spot, so a retired spot stays gone', () => {
    const { sql } = dialect.sqlToQuery(putBackInServiceStatement(OPERATOR, spot));
    expect(sql).toContain("spot.state = 'OUT_OF_SERVICE'");
    expect(sql).toContain('spot.retired_at is null');
    expect(sql).toMatch(/operator_id = \$\d+/);
  });
});

describe('setting a spot in or out of service in Postgres', () => {
  it('writes the aisle of the changed spot', async () => {
    const scripted = lockedLot().answer('take-spot-out-of-service', [{ aisle_id: 'aisle-a' }]);

    expect(await repositoryOn(scripted).setSpotService(OPERATOR, spot, true)).toEqual({ kind: 'written', aisleId: 'aisle-a' });
    expect(scripted.count('read-live-spot-state')).toBe(0);
  });

  it('puts back with the put-back statement', async () => {
    const scripted = lockedLot().answer('put-spot-back-in-service', [{ aisle_id: 'aisle-a' }]);

    expect(await repositoryOn(scripted).setSpotService(OPERATOR, spot, false)).toEqual({ kind: 'written', aisleId: 'aisle-a' });
  });

  it.each(['ASSIGNED', 'HELD', 'OCCUPIED', 'OCCUPIED_UNKNOWN', 'AVAILABLE'])('refuses taking out a spot found %s (free ones: a session points at it) as in use', async (state) => {
    const scripted = lockedLot().answer('read-live-spot-state', [{ state, aisle_id: 'aisle-a' }]);

    const outcome = await repositoryOn(scripted).setSpotService(OPERATOR, spot, true);

    expect(outcome).toEqual({ kind: 'refused', reason: 'SPOT_IN_USE' });
  });

  it('succeeds when the spot is already out of service', async () => {
    const scripted = lockedLot().answer('read-live-spot-state', [{ state: 'OUT_OF_SERVICE', aisle_id: 'aisle-a' }]);

    expect(await repositoryOn(scripted).setSpotService(OPERATOR, spot, true)).toEqual({ kind: 'written', aisleId: 'aisle-a' });
  });

  it('answers SPOT_NOT_FOUND when no live spot is left', async () => {
    expect(await repositoryOn(lockedLot()).setSpotService(OPERATOR, spot, false)).toEqual({ kind: 'refused', reason: 'SPOT_NOT_FOUND' });
  });
});
