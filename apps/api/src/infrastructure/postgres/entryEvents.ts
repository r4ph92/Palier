import { sql } from 'drizzle-orm';
import type { SessionDraft } from '../../domain/entries/ParkingSessionRepository.ts';
import type { EntryWithoutLoopPayload } from '../../domain/sessionEvents/SessionEvent.ts';
import type { Transaction } from './database.ts';
import { appendSessionEvent, insertSessionEvents, jsonbObjectOf, type SessionEventColumns } from './sessionEventStatements.ts';
import type { AssignedSpotRow } from './spotClaim.ts';

export interface Scan {
  readonly sessionId: string;
  readonly draft: SessionDraft;
  readonly assigned: AssignedSpotRow;
}

// Explicit fields only: the draft also carries the card's last four digits, which the log never keeps.
export async function logScan(tx: Transaction, { sessionId, draft, assigned }: Scan): Promise<void> {
  await appendSessionEvent(tx, {
    sessionId,
    lotId: draft.lotId,
    occurredAt: 'entry_scan_at',
    event: {
      kind: 'ENTRY_SCANNED',
      payload: {
        plate: draft.plate,
        gateId: draft.entryGateId,
        spotId: assigned.id,
        spotNumber: assigned.number,
        aisleCode: assigned.aisle_code,
        levelCode: assigned.level_code,
      },
    },
  });
}

export interface SessionInLot {
  readonly sessionId: string;
  readonly lotId: string;
}

// With the loop and the job's cancellation, every logged scan ends in a closing event.
export async function logFailedAdmission(tx: Transaction, { sessionId, lotId }: SessionInLot): Promise<void> {
  await appendSessionEvent(tx, {
    sessionId,
    lotId,
    occurredAt: 'cancelled_at',
    event: { kind: 'ENTRY_CANCELLED', payload: { reason: 'ADMISSION_FAILED' } },
  });
}

// wasBarrierOpened tells an entry whose barrier opened and no car crossed from one stopped before its barrier (decision 037).
const WITHOUT_LOOP = jsonbObjectOf<EntryWithoutLoopPayload>({
  reason: sql`'NO_LOOP'`,
  wasBarrierOpened: sql`exists (select 1 from gate_command where gate_command.session_id = cancelled.id and gate_command.kind = 'OPEN')`,
});

// One statement, from the cancelled session's own row: its lot, its cancelled_at, and its barrier command if any.
export async function logEntryWithoutLoop(tx: Transaction, sessionId: string): Promise<void> {
  const row: SessionEventColumns = {
    sessionId: sql`cancelled.id`,
    lotId: sql`cancelled.lot_id`,
    kind: sql`'ENTRY_CANCELLED'`,
    payload: WITHOUT_LOOP,
    occurredAt: sql`cancelled.cancelled_at`,
  };
  await tx.execute(insertSessionEvents(row, sql`from parking_session cancelled where cancelled.id = ${sessionId}`));
}
