import type { GateCommand } from '@palier/shared-types';
import { sql } from 'drizzle-orm';
import { GATE_COMMAND_PAGE_SIZE, type GateCommandFeed } from '../../domain/gates/GateCommandFeed.ts';
import type { Database } from './database.ts';

interface CommandRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: GateCommand['kind'];
  readonly issued_at: Date | string;
  readonly sequence: number;
}

// Paged on the gate's sequence, which follows commit order (docs/decisions/048): a command committed late is never behind the cursor.
export class PostgresGateCommandFeed implements GateCommandFeed {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listCommands(gateId: string, afterSequence: number | null): Promise<readonly GateCommand[]> {
    const rows = afterSequence === null ? await this.#latest(gateId) : await this.#after(gateId, afterSequence);
    return rows.map((row) => ({ id: row.id, kind: row.kind, issuedAt: new Date(row.issued_at).toISOString(), sequence: row.sequence }));
  }

  #after(gateId: string, afterSequence: number): Promise<readonly CommandRow[]> {
    return this.#database.execute<CommandRow>(sql`
      select id, kind, issued_at, sequence from gate_command
      where gate_id = ${gateId} and sequence > ${afterSequence}
      order by sequence asc limit ${GATE_COMMAND_PAGE_SIZE}`);
  }

  async #latest(gateId: string): Promise<readonly CommandRow[]> {
    const newestFirst = await this.#database.execute<CommandRow>(sql`
      select id, kind, issued_at, sequence from gate_command
      where gate_id = ${gateId}
      order by sequence desc limit ${GATE_COMMAND_PAGE_SIZE}`);
    return [...newestFirst].reverse();
  }
}
