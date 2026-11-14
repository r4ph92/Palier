import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { isValidSpotRange, parseSpotRange, spotNumbersOf } from '@palier/shared-types/spotDraft';
import { readAisleSpotsStatement } from '../../src/infrastructure/postgres/lotSpotStatements.ts';

function numbersAddedFrom(text: string): string[] {
  const range = parseSpotRange(text);
  return range !== null && isValidSpotRange(range) ? spotNumbersOf(range) : [];
}

function selectListOf(statementText: string): string {
  return statementText.slice(0, statementText.indexOf('from aisle'));
}

describe('spots of an aisle under attack (QA #66)', () => {
  // Live: « F-1 a F-3 » added one spot numbered « F-1 a F-3 » and announced « 1 place ajoutée ».
  it.each(['A-1 a A-20', 'A-1 - A-20', 'A-1-A-20', 'A-1 au A-20'])('never adds a single spot named after the whole range text « %s »', (text) => {
    expect(numbersAddedFrom(text)).not.toContain(text);
  });

  // Live: prefix « --- » saved « ---1 », which the driver lookup reads as « 1 ».
  it.each(['---', '- -', '-'])('refuses a prefix of only dashes and spaces « %s »', (prefix) => {
    expect(isValidSpotRange({ prefix, first: '1', last: '2' })).toBe(false);
  });

  // Live: a 10 000-spot aisle took 6.6 s per read (SubPlan loops=10000) and starved the pool for other operators.
  it('counts the lot’s live spots once per read, not once per spot row of the aisle', () => {
    const { sql: statementText } = new PgDialect().sqlToQuery(readAisleSpotsStatement('operator-roy', { lotId: 'lot-roy-nord', aisleId: 'aisle-a' }));

    expect(selectListOf(statementText)).not.toMatch(/\(select count/);
  });
});
