import { sql } from 'drizzle-orm';
import type { OpenCommand } from '../../domain/entries/GateCommander.ts';
import type { GateOpenedPayload } from '../../domain/sessionEvents/SessionEvent.ts';
import type { Transaction } from './database.ts';
import { appendSessionEvent } from './sessionEventStatements.ts';

interface IssuedCommandRow extends Record<string, unknown> {
  readonly id: string;
}

// The one write of an opening order, at the entry and at the exit: the demo console shows it to the simulated gate. Its GATE_OPENED
// event is dated by the command's own issued_at, in the same transaction.
export async function storeOpenCommand(tx: Transaction, command: OpenCommand, direction: GateOpenedPayload['direction']): Promise<void> {
  const commandId = await insertOpenCommand(tx, command);
  await appendSessionEvent(tx, {
    sessionId: command.sessionId,
    lotId: command.lotId,
    occurredAt: sql`(select issued_at from gate_command where id = ${commandId})`,
    event: { kind: 'GATE_OPENED', payload: { direction, gateId: command.gateId, commandId } },
  });
}

async function insertOpenCommand(tx: Transaction, { gateId, lotId, sessionId }: OpenCommand): Promise<string> {
  const [issued] = await tx.execute<IssuedCommandRow>(sql`
    insert into gate_command (gate_id, lot_id, kind, session_id)
    values (${gateId}, ${lotId}, 'OPEN', ${sessionId})
    returning id`);
  if (issued === undefined) {
    throw new Error('The gate command was not stored.');
  }
  return issued.id;
}
