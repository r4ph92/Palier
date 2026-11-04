import type { GateCommand } from '@palier/shared-types';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { GATE_COMMAND_PAGE_SIZE, type GateCommandCursor, type GateCommandFeed } from '../../domain/gates/GateCommandFeed.ts';
import type { Database } from './database.ts';
import { gateCommand } from './schema.ts';

const commandColumns = { id: gateCommand.id, kind: gateCommand.kind, issuedAt: gateCommand.issuedAt };

interface CommandRow {
  readonly id: string;
  readonly kind: GateCommand['kind'];
  readonly issuedAt: Date;
}

export class PostgresGateCommandFeed implements GateCommandFeed {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listCommands(gateId: string, after: GateCommandCursor | null): Promise<readonly GateCommand[]> {
    const rows = after === null ? await this.#latest(gateId) : await this.#after(gateId, after);
    return rows.map((row) => ({ id: row.id, kind: row.kind, issuedAt: row.issuedAt.toISOString() }));
  }

  #after(gateId: string, after: GateCommandCursor): Promise<CommandRow[]> {
    const isAfterCursor = sql`(${gateCommand.issuedAt}, ${gateCommand.id}) > (${after.issuedAt.toISOString()}::timestamptz, ${after.id}::uuid)`;
    return this.#database
      .select(commandColumns)
      .from(gateCommand)
      .where(and(eq(gateCommand.gateId, gateId), isAfterCursor))
      .orderBy(asc(gateCommand.issuedAt), asc(gateCommand.id))
      .limit(GATE_COMMAND_PAGE_SIZE);
  }

  async #latest(gateId: string): Promise<CommandRow[]> {
    const newestFirst = await this.#database
      .select(commandColumns)
      .from(gateCommand)
      .where(eq(gateCommand.gateId, gateId))
      .orderBy(desc(gateCommand.issuedAt), desc(gateCommand.id))
      .limit(GATE_COMMAND_PAGE_SIZE);
    return newestFirst.reverse();
  }
}
