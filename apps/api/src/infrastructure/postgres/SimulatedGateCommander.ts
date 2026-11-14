import { sql } from 'drizzle-orm';
import type { GateCommander, OpenCommand } from '../../domain/entries/GateCommander.ts';
import type { Database, Transaction } from './database.ts';
import { appendSessionEvent } from './sessionEventStatements.ts';

interface IssuedCommandRow extends Record<string, unknown> {
  readonly id: string;
}

// A simulated gate has no hardware: the command is stored and the demo console shows it. It serves entries only:
// an exit stores its own command with its capture (PostgresExitRepository).
export class SimulatedGateCommander implements GateCommander {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async open(command: OpenCommand): Promise<void> {
    await this.#database.transaction(async (tx) => {
      const commandId = await storeOpenCommand(tx, command);
      await appendSessionEvent(tx, {
        sessionId: command.sessionId,
        lotId: command.lotId,
        occurredAt: sql`(select issued_at from gate_command where id = ${commandId})`,
        event: { kind: 'GATE_OPENED', payload: { direction: 'ENTRY', gateId: command.gateId, commandId } },
      });
    });
  }
}

async function storeOpenCommand(tx: Transaction, { gateId, lotId, sessionId }: OpenCommand): Promise<string> {
  const [issued] = await tx.execute<IssuedCommandRow>(sql`
    insert into gate_command (gate_id, lot_id, kind, session_id)
    values (${gateId}, ${lotId}, 'OPEN', ${sessionId})
    returning id`);
  if (issued === undefined) {
    throw new Error('The gate command was not stored.');
  }
  return issued.id;
}
