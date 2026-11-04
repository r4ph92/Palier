import type { GateCommand } from '@palier/shared-types';

export const GATE_COMMAND_PAGE_SIZE = 50;

// The last command a reader holds: two commands can share a millisecond, so the id breaks the tie.
export interface GateCommandCursor {
  readonly issuedAt: Date;
  readonly id: string;
}

export interface GateCommandFeed {
  // Oldest first, by issuedAt then id: the commands after the cursor, or the latest ones when it is null.
  listCommands(gateId: string, after: GateCommandCursor | null): Promise<readonly GateCommand[]>;
}
