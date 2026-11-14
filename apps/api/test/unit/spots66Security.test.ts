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
const render = (statement: { queryChunks?: unknown } | import('drizzle-orm').SQL) => dialect.sqlToQuery(statement as import('drizzle-orm').SQL);

const OP = 'operator-roy';
const LOT = 'lot-roy-nord';
const AISLE = { lotId: LOT, aisleId: 'aisle-a' };
const SPOT = { lotId: LOT, spotId: 'spot-a3' };
const ATTRS = { isEv: true, isAccessible: false, isOversize: false, distanceToExit: 12 };

const everyWrite = [
  ['read-aisle-spots', readAisleSpotsStatement(OP, AISLE)],
  ['read-parking-aisle', readParkingAisleStatement(OP, AISLE)],
  ['count-live-spots', countLiveSpotsStatement(OP, LOT)],
  ['find-taken-number', firstTakenNumberStatement(OP, LOT, ['A-3'])],
  ['insert-spots', insertSpotsStatement(OP, AISLE, { numbers: ['A-3'], attributes: ATTRS })],
  ['change-spot', changeSpotStatement(OP, SPOT, ATTRS)],
  ['delete-unused-spot', deleteSpotWithoutHistoryStatement(OP, SPOT)],
  ['retire-spot', retireSpotStatement(OP, SPOT)],
  ['read-live-spot', readLiveSpotStatement(OP, SPOT)],
] as const;

describe('spot statements are scoped to the operator and never trust ids or numbers as SQL', () => {
  it.each(everyWrite)('%s names the operator and binds every id as a parameter', (_label, statement) => {
    const { sql, params } = render(statement);
    // Tenant scope: the operator predicate is present and bound, so another operator's lot is never touched.
    expect(sql).toMatch(/operator_id = \$\d+/);
    expect(params).toContain(OP);
    // The lot/aisle/spot ids reach the query only as parameters, never inlined into the text.
    expect(sql).not.toContain(LOT);
    expect(sql).not.toContain('aisle-a');
    expect(sql).not.toContain('spot-a3');
  });

  it('binds attacker-controlled spot numbers as parameters, so SQL in a number is inert', () => {
    const evil = ["'); drop table spot;--", '<script>alert(1)</script>', 'A-3'];
    for (const statement of [firstTakenNumberStatement(OP, LOT, evil), insertSpotsStatement(OP, AISLE, { numbers: evil, attributes: ATTRS })]) {
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
    ['read-aisle-spots', readAisleSpotsStatement(OP, AISLE)],
    ['count-live-spots', countLiveSpotsStatement(OP, LOT)],
    ['find-taken-number', firstTakenNumberStatement(OP, LOT, ['A-3'])],
    ['change-spot', changeSpotStatement(OP, SPOT, ATTRS)],
    ['read-live-spot', readLiveSpotStatement(OP, SPOT)],
  ] as const)('%s filters on retired_at is null', (_label, statement) => {
    expect(render(statement).sql).toContain('retired_at is null');
  });

  it('inserts spots only through the operator-owned, non-exit parking aisle', () => {
    const { sql } = render(insertSpotsStatement(OP, AISLE, { numbers: ['A-3'], attributes: ATTRS }));
    expect(sql).toContain('insert into spot');
    expect(sql).toMatch(/not aisle\.is_exit_lane/);
    expect(sql).toMatch(/operator_id = \$\d+/);
  });
});

describe('a spot in use or with history is never silently deleted', () => {
  it('retire requires a free, unheld, unassigned spot and marks it out of service', () => {
    const { sql } = render(retireSpotStatement(OP, SPOT));
    expect(sql).toContain("state = 'OUT_OF_SERVICE'");
    expect(sql).toContain('retired_at = now()');
    expect(sql).toContain("spot.state in ('AVAILABLE', 'OUT_OF_SERVICE')");
    expect(sql).toMatch(/not exists \(select 1 from parking_session holder/);
    expect(sql).toMatch(/not exists \(select 1 from spot_hold/);
  });

  it('hard delete is refused for any spot a session, hold or report ever pointed at', () => {
    const { sql } = render(deleteSpotWithoutHistoryStatement(OP, SPOT));
    expect(sql).toContain('delete from spot');
    expect(sql).toMatch(/not exists \(select 1 from parking_session past where past\.assigned_spot_id = spot\.id/);
    expect(sql).toMatch(/not exists \(select 1 from parking_session past where past\.confirmed_spot_id = spot\.id/);
    expect(sql).toMatch(/not exists \(select 1 from spot_hold past/);
    expect(sql).toMatch(/not exists \(select 1 from parking_session_reported_spot past/);
  });
});
