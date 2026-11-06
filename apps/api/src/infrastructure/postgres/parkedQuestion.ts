import { sql } from 'drizzle-orm';
import type { ParkedQuestion } from '@palier/shared-types';
import { spotFits } from '../../domain/allocation/chooseSpotFor.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { Database } from './database.ts';
import { spotFlagsOf, type SpotFlagsRow } from './spotClaim.ts';

// The flags are null with the number when the aisle has no free spot.
interface QuestionRow extends Record<string, unknown>, SpotFlagsRow {
  readonly code: string;
  readonly number: string | null;
}

export interface QuestionScope {
  readonly aisleId: string;
  readonly needs: VehicleNeeds;
}

// The free spots of the aisle seen at the walk that fit the session's vehicle, in natural order (B-2 before B-10);
// the aisle is in the session's lot by its foreign key.
export async function readParkedQuestion(database: Database, { aisleId, needs }: QuestionScope): Promise<ParkedQuestion | null> {
  const rows = await database.execute<QuestionRow>(sql`
    select aisle.code, spot.number, spot.is_ev, spot.is_accessible, spot.is_oversize
    from aisle
    left join spot on spot.aisle_id = aisle.id and spot.state = 'AVAILABLE'
    where aisle.id = ${aisleId}
    order by length(spot.number), spot.number`);
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  const freeSpotNumbers = rows.flatMap((row) => (row.number !== null && spotFits(needs, spotFlagsOf(row)) ? [row.number] : []));
  return { aisleCode: first.code, freeSpotNumbers };
}
