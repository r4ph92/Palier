import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0031_awaiting_signal_index.sql', import.meta.url), 'utf8');

describe('migration 0031, the lot index of the silence check', () => {
  it('indexes by lot only the sessions still waiting for a signal or an answer', () => {
    expect(migration).toContain('CREATE INDEX "parking_session_awaiting_signal_by_lot_index" ON "parking_session" USING btree ("lot_id")');
    expect(migration).toContain(`WHERE "parking_session"."state" in ('ENTRY_CONFIRMED', 'PARKED_UNCONFIRMED')`);
  });
});
