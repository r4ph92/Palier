import { sql } from 'drizzle-orm';
import type { OpenCommand } from '../../domain/entries/GateCommander.ts';
import type { Transaction } from './database.ts';

interface IssuedCommandRow extends Record<string, unknown> {
  readonly id: string;
}

// The one write of an opening order, at the entry and at the exit: the demo console shows it to the simulated gate.
export async function storeOpenCommand(tx: Transaction, { gateId, lotId, sessionId }: OpenCommand): Promise<string> {
  const [issued] = await tx.execute<IssuedCommandRow>(sql`
    insert into gate_command (gate_id, lot_id, kind, session_id)
    values (${gateId}, ${lotId}, 'OPEN', ${sessionId})
    returning id`);
  if (issued === undefined) {
    throw new Error('The gate command was not stored.');
  }
  return issued.id;
}
