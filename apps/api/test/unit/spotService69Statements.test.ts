import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { putBackInServiceStatement, readLiveSpotStateStatement, takeOutOfServiceStatement } from '../../src/infrastructure/postgres/lotSpotStatements.ts';

// Pentest #69: durable proof of the SQL invariants of the spot service toggle.
const dialect = new PgDialect();
const render = (statement: SQL) => dialect.sqlToQuery(statement);

const OPERATOR = 'operator-lavoie';
const SPOT = { lotId: 'lot-demo', spotId: 'spot-a3' };

const takeOut = takeOutOfServiceStatement(OPERATOR, SPOT);
const putBack = putBackInServiceStatement(OPERATOR, SPOT);
const serviceStatements = [
  ['take-out', takeOut],
  ['put-back', putBack],
  ['read-live-state', readLiveSpotStateStatement(OPERATOR, SPOT)],
] as const;
const serviceWrites = [
  ['take-out', takeOut, { from: 'AVAILABLE', to: 'OUT_OF_SERVICE' }],
  ['put-back', putBack, { from: 'OUT_OF_SERVICE', to: 'AVAILABLE' }],
] as const;

describe('spot service statements stay inside the operator’s lot', () => {
  it.each(serviceStatements)('%s ties the spot to the named lot and the lot to the operator, with every id bound', (_label, statement) => {
    const { sql, params } = render(statement);

    expect(sql).toMatch(/spot\.id = \$\d+ and spot\.lot_id = \$\d+/);
    expect(sql).toMatch(/parking_lot\.id = spot\.lot_id and parking_lot\.operator_id = \$\d+/);
    expect(params).toEqual([SPOT.spotId, SPOT.lotId, OPERATOR]);
    expect(sql).not.toContain(SPOT.spotId);
    expect(sql).not.toContain(SPOT.lotId);
    expect(sql).not.toContain(OPERATOR);
  });

  it.each(serviceStatements)('%s never reaches a retired spot', (_label, statement) => {
    expect(render(statement).sql).toContain('spot.retired_at is null');
  });
});

describe('the service toggle writes the state and nothing else', () => {
  it.each(serviceWrites)('%s sets only state and state_changed_at, from the one state it may leave', (_label, statement, { from, to }) => {
    const { sql } = render(statement);
    const assignments = /update spot set (.+)\n\s*from parking_lot/.exec(sql)?.[1];

    expect(assignments).toBe(`state = '${to}', state_changed_at = now()`);
    expect(sql).toContain(`spot.state = '${from}'`);
  });

  it.each(serviceWrites)('%s refuses a spot an active session, an active hold or an open report points at', (_label, statement) => {
    const { sql } = render(statement);

    expect(sql).toMatch(/not \(exists \(select 1 from parking_session holder where \(holder\.assigned_spot_id = spot\.id or holder\.confirmed_spot_id = spot\.id\) and holder\.state in \(/);
    expect(sql).toMatch(/or exists \(select 1 from parking_session_reported_spot reported join parking_session reporter on reporter\.id = reported\.session_id where reported\.spot_id = spot\.id and reported\.lot_id = spot\.lot_id and reporter\.state in \(/);
    expect(sql).toContain(`not exists (select 1 from spot_hold where spot_hold.spot_id = spot.id and status = 'ACTIVE')`);
  });
});
