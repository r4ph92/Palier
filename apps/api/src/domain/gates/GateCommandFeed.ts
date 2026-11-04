import type { GateCommand } from '@palier/shared-types';

export const GATE_COMMAND_PAGE_SIZE = 50;

export interface GateCommandFeed {
  // Oldest first: the commands issued strictly after `after`, or the latest ones when `after` is null.
  listCommands(gateId: string, after: Date | null): Promise<readonly GateCommand[]>;
}
