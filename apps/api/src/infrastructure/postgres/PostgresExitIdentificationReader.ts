import { sql } from 'drizzle-orm';
import type { SessionExitMethod } from '@palier/shared-types/sessionTimeline';
import type { ExitCountsRead, ExitIdentificationReader, RecordedExitCounts } from '../../domain/dashboard/ExitIdentificationReader.ts';
import type { Database } from './database.ts';

interface ExitCountRow extends Record<string, unknown> {
  readonly lot_name: string;
  readonly exit_identification: SessionExitMethod | null;
  readonly exit_count: number;
}

const NO_EXITS: RecordedExitCounts = { BEACON: 0, APP: 0, PLATE: 0, TRANSPONDER: 0, STAFF: 0 };

export class PostgresExitIdentificationReader implements ExitIdentificationReader {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // The lot row stays when it has no exit (a null method, a zero count); another operator's lot gives no row. Never user_id or plate: only counts leave.
  async readExitCounts(operatorId: string, lotId: string, since: Date): Promise<ExitCountsRead | null> {
    const rows = await this.#database.execute<ExitCountRow>(sql`
      select parking_lot.name as lot_name, ps.exit_identification, count(ps.id)::int as exit_count
      from parking_lot
      left join parking_session ps on ps.lot_id = parking_lot.id and ps.exit_identification is not null and ps.exit_at >= ${since.toISOString()}::timestamptz
      where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
      group by parking_lot.name, ps.exit_identification`);
    const [first] = rows;
    return first === undefined ? null : { lotName: first.lot_name, counts: countsOf(rows) };
  }
}

function countsOf(rows: readonly ExitCountRow[]): RecordedExitCounts {
  return rows.reduce((counts, row) => (row.exit_identification === null ? counts : { ...counts, [row.exit_identification]: row.exit_count }), NO_EXITS);
}
