import { readFileSync } from 'node:fs';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { canonicalNumberOf } from '../../src/infrastructure/postgres/canonicalNumberSql.js';
import { spot } from '../../src/infrastructure/postgres/lotSchema.js';

const migration = readFileSync(new URL('../../drizzle/0018_spot_canonical_number.sql', import.meta.url), 'utf8');

describe('migration 0018, the canonical spot number index', () => {
  it('indexes the exact expression the spot lookup builds, or the planner cannot use the index', () => {
    const qualifiedExpression = new PgDialect().sqlToQuery(canonicalNumberOf(spot.number)).sql;
    const expression = qualifiedExpression.replace('"spot".', '');

    expect(migration).toContain(expression);
  });
});
