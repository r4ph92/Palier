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

// The gate's row lock, taken by raising its count, is held until commit: the gate's next command waits for this one, so the
// sequence a reader sees is the commit order and no command lands behind a cursor (docs/decisions/048).
async function insertOpenCommand(tx: Transaction, { gateId, lotId, sessionId }: OpenCommand): Promise<string> {
  const [issued] = await tx.execute<IssuedCommandRow>(sql`
    with counted as (
      update gate set last_command_sequence = last_command_sequence + 1
      where id = ${gateId} and lot_id = ${lotId}
      returning last_command_sequence)
    insert into gate_command (gate_id, lot_id, kind, session_id, sequence)
    select ${gateId}, ${lotId}, 'OPEN', ${sessionId}, counted.last_command_sequence from counted
    returning id`);
  if (issued === undefined) {
    throw new Error('The gate command was not stored.');
  }
  return issued.id;
}
