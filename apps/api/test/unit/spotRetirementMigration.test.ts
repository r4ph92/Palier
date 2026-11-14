import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0036_spot_retirement.sql', import.meta.url), 'utf8');

describe('migration 0036, spot retirement', () => {
  it('keeps a spot number unique among the live spots of a lot only', () => {
    expect(migration).toContain('ALTER TABLE "spot" DROP CONSTRAINT "spot_lot_id_number_unique"');
    expect(migration).toContain('CREATE UNIQUE INDEX "spot_lot_id_number_unique" ON "spot" USING btree ("lot_id","number") WHERE "spot"."retired_at" is null');
  });

  it('keeps a retired spot out of service, so allocation never hands it out', () => {
    expect(migration).toContain(`CHECK ("spot"."retired_at" is null or "spot"."state" = 'OUT_OF_SERVICE')`);
  });

  it.each([
    ['parking_session', '"assigned_spot_id","lot_id"'],
    ['parking_session', '"confirmed_spot_id","lot_id"'],
    ['spot_hold', '"spot_id","lot_id"'],
    ['parking_session_reported_spot', '"spot_id","lot_id"'],
  ])('indexes %s by %s, so deleting a spot finds its history without a scan', (table, columns) => {
    expect(migration).toContain(`ON "${table}" USING btree (${columns})`);
  });
});
