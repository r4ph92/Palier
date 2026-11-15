import type { GateCommander, OpenCommand } from '../../domain/entries/GateCommander.ts';
import type { Database } from './database.ts';
import { storeOpenCommand } from './gateCommandStatements.ts';

// A simulated gate has no hardware: the command is stored and the demo console shows it. It serves entries only:
// an exit stores its command with its capture (PostgresExitRepository), through the same storeOpenCommand.
export class SimulatedGateCommander implements GateCommander {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async open(command: OpenCommand): Promise<void> {
    await this.#database.transaction((tx) => storeOpenCommand(tx, command, 'ENTRY'));
  }
}
