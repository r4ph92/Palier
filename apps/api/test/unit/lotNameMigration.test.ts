import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0045_lot_name_not_blank.sql', import.meta.url), 'utf8');

describe('migration 0045, lot name', () => {
  it('refuses at the database a lot name that is empty once trimmed', () => {
    expect(migration).toContain(`ADD CONSTRAINT "parking_lot_name_not_blank" CHECK (btrim("parking_lot"."name") <> '')`);
  });
});
