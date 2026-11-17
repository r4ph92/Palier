import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0044_presence_arming.sql', import.meta.url), 'utf8');

describe('migration 0044, passage arming time', () => {
  it('adds the arming time as a nullable instant, so every existing passage stays unmeasured', () => {
    expect(migration).toContain('ALTER TABLE "gate_passage" ADD COLUMN "armed_at" timestamp with time zone;');
  });

  it('refuses an arming time after the closing time', () => {
    expect(migration).toContain(
      `ADD CONSTRAINT "gate_passage_armed_before_closed" CHECK ("gate_passage"."armed_at" is null or "gate_passage"."armed_at" <= "gate_passage"."closed_at")`,
    );
  });

  it('indexes only the measured passages by gate and closing time', () => {
    expect(migration).toContain(
      'CREATE INDEX "gate_passage_presence_index" ON "gate_passage" USING btree ("gate_id","closed_at") WHERE "gate_passage"."armed_at" is not null;',
    );
  });
});
