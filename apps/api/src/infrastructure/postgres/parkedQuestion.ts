import { sql } from 'drizzle-orm';
import type { ParkedQuestion } from '@palier/shared-types';
import type { Database } from './database.ts';

interface QuestionRow extends Record<string, unknown> {
  readonly code: string;
  readonly number: string | null;
}

// The free spots of the aisle seen at the walk, in natural order (B-2 before B-10); the aisle is in the session's lot by its foreign key.
export async function readParkedQuestion(database: Database, aisleId: string): Promise<ParkedQuestion | null> {
  const rows = await database.execute<QuestionRow>(sql`
    select aisle.code, spot.number
    from aisle
    left join spot on spot.aisle_id = aisle.id and spot.state = 'AVAILABLE'
    where aisle.id = ${aisleId}
    order by length(spot.number), spot.number`);
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  return { aisleCode: first.code, freeSpotNumbers: rows.flatMap(({ number }) => (number === null ? [] : [number])) };
}
