import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { parkingSession } from '../../src/infrastructure/postgres/entrySchema.ts';
import { silentConfirmedEntry, unansweredQuestion } from '../../src/infrastructure/postgres/silentSessionStatements.ts';

const dialect = new PgDialect();

function renderedText(statement: SQL): string {
  return dialect.sqlToQuery(statement).sql;
}

function statesOf(text: string): string[] {
  return [...text.matchAll(/'([A-Z_]+)'/g)].map(([, state]) => state ?? '');
}

describe('the lot index of the silence check', () => {
  it('has a predicate that covers the state of both silence arms', () => {
    const index = getTableConfig(parkingSession).indexes.find(({ config }) => config.name === 'parking_session_awaiting_signal_by_lot_index');
    const predicate = renderedText(index?.config.where as SQL);
    const armStates = [silentConfirmedEntry(new Date()), unansweredQuestion(new Date())].flatMap((arm) => statesOf(renderedText(arm)));

    expect(armStates).toEqual(['ENTRY_CONFIRMED', 'PARKED_UNCONFIRMED']);
    for (const state of armStates) {
      expect(predicate).toContain(`'${state}'`);
    }
  });
});
