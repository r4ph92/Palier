import { sql } from 'drizzle-orm';
import type { GateCommander, OpenCommand } from '../../domain/entries/GateCommander.ts';
import type { Database } from './database.ts';
import { storeOpenCommand } from './gateCommandStatements.ts';
import { appendSessionEvent } from './sessionEventStatements.ts';

// A simulated gate has no hardware: the command is stored and the demo console shows it. It serves entries only:
// an exit stores its command with its capture (PostgresExitRepository), through the same storeOpenCommand.
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
