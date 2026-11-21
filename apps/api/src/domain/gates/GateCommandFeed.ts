import type { GateCommand } from '@palier/shared-types';

export const GATE_COMMAND_PAGE_SIZE = 50;

export interface GateCommandFeed {
  // Oldest first, by the gate's sequence: the commands after the sequence a reader holds, or the latest ones when it is null.
  listCommands(gateId: string, afterSequence: number | null): Promise<readonly GateCommand[]>;
}
