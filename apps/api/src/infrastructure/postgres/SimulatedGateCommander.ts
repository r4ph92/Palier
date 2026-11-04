import type { GateCommander, OpenCommand } from '../../domain/entries/GateCommander.ts';
import type { Database } from './database.ts';
import { gateCommand } from './schema.ts';

// A simulated gate has no hardware: the command is stored and the demo console shows it.
export class SimulatedGateCommander implements GateCommander {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async open(command: OpenCommand): Promise<void> {
    await this.#database.insert(gateCommand).values({ ...command, kind: 'OPEN' });
  }
}
