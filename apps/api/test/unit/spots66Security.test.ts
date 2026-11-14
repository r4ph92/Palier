import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  changeSpotStatement,
  countLiveSpotsStatement,
  deleteSpotWithoutHistoryStatement,
  firstTakenNumberStatement,
  insertSpotsStatement,
  readAisleSpotsStatement,
  readLiveSpotStatement,
  readParkingAisleStatement,
  retireSpotStatement,
} from '../../src/infrastructure/postgres/lotSpotStatements.ts';

// Pentest #66 — durable proof of the security invariants of the spot statements (story/66-spots-attributes).
// Live proof of the running build is in .claude/work/66-spots-attributes/pentest.log; this pins the invariants in code.
const dialect = new PgDialect();
const render = (statement: SQL) => dialect.sqlToQuery(statement);

const OPERATOR = 'operator-roy';
const LOT = 'lot-roy-nord';
const AISLE = { lotId: LOT, aisleId: 'aisle-a' };
const SPOT = { lotId: LOT, spotId: 'spot-a3' };
const ATTRIBUTES = { isEv: true, isAccessible: false, isOversize: false, distanceToExit: 12 };

const everyStatement = [
  ['read-aisle-spots', readAisleSpotsStatement(OPERATOR, AISLE)],
  ['read-parking-aisle', readParkingAisleStatement(OPERATOR, AISLE)],
  ['count-live-spots', countLiveSpotsStatement(OPERATOR, LOT)],
  ['find-taken-number', firstTakenNumberStatement(OPERATOR, LOT, ['A-3'])],
  ['insert-spots', insertSpotsStatement(OPERATOR, AISLE, { numbers: ['A-3'], attributes: ATTRIBUTES })],
  ['change-spot', changeSpotStatement(OPERATOR, SPOT, ATTRIBUTES)],
  ['delete-unused-spot', deleteSpotWithoutHistoryStatement(OPERATOR, SPOT)],
  ['retire-spot', retireSpotStatement(OPERATOR, SPOT)],
  ['read-live-spot', readLiveSpotStatement(OPERATOR, SPOT)],
] as const;

describe('spot statements are scoped to the operator and never trust ids or numbers as SQL', () => {
  it.each(everyStatement)('%s names the operator and binds every id as a parameter', (_label, statement) => {
    const { sql, params } = render(statement);
    expect(sql).toMatch(/operator_id = \$\d+/);
    expect(params).toContain(OPERATOR);
    expect(sql).not.toContain(LOT);
    expect(sql).not.toContain('aisle-a');
    expect(sql).not.toContain('spot-a3');
  });

  it('binds attacker-controlled spot numbers as parameters, so SQL in a number is inert', () => {
    const evil = ["'); drop table spot;--", '<script>alert(1)</script>', 'A-3'];
    for (const statement of [firstTakenNumberStatement(OPERATOR, LOT, evil), insertSpotsStatement(OPERATOR, AISLE, { numbers: evil, attributes: ATTRIBUTES })]) {
      const { sql, params } = render(statement);
      expect(sql).not.toContain('drop table');
      expect(sql).not.toContain('<script>');
      for (const number of evil) {
        expect(params).toContain(number);
      }
    }
  });
});

describe('retired spots stay out of every read, count and reuse check', () => {
  it.each([
    ['read-aisle-spots', readAisleSpotsStatement(OPERATOR, AISLE)],
    ['count-live-spots', countLiveSpotsStatement(OPERATOR, LOT)],
    ['find-taken-number', firstTakenNumberStatement(OPERATOR, LOT, ['A-3'])],
    ['change-spot', changeSpotStatement(OPERATOR, SPOT, ATTRIBUTES)],
    ['read-live-spot', readLiveSpotStatement(OPERATOR, SPOT)],
  ] as const)('%s filters on retired_at is null', (_label, statement) => {
    expect(render(statement).sql).toContain('retired_at is null');
  });

  it('inserts spots only through the operator-owned, non-exit parking aisle', () => {
    const { sql } = render(insertSpotsStatement(OPERATOR, AISLE, { numbers: ['A-3'], attributes: ATTRIBUTES }));
    expect(sql).toContain('insert into spot');
    expect(sql).toMatch(/not aisle\.is_exit_lane/);
    expect(sql).toMatch(/operator_id = \$\d+/);
  });
});

describe('a spot in use or with history is never silently deleted', () => {
  it('retire requires a free, unheld, unassigned spot and marks it out of service', () => {
    const { sql } = render(retireSpotStatement(OPERATOR, SPOT));
    expect(sql).toContain("state = 'OUT_OF_SERVICE'");
    expect(sql).toContain('retired_at = now()');
    expect(sql).toContain("spot.state in ('AVAILABLE', 'OUT_OF_SERVICE')");
    expect(sql).toMatch(/not exists \(select 1 from parking_session holder/);
    expect(sql).toMatch(/not exists \(select 1 from spot_hold/);
  });

  it('hard delete is refused for any spot a session, hold or report ever pointed at', () => {
    const { sql } = render(deleteSpotWithoutHistoryStatement(OPERATOR, SPOT));
    expect(sql).toContain('delete from spot');
    expect(sql).toMatch(/not exists \(select 1 from parking_session past where past\.assigned_spot_id = spot\.id/);
    expect(sql).toMatch(/not exists \(select 1 from parking_session past where past\.confirmed_spot_id = spot\.id/);
    expect(sql).toMatch(/not exists \(select 1 from spot_hold past/);
    expect(sql).toMatch(/not exists \(select 1 from parking_session_reported_spot past/);
  });
});
