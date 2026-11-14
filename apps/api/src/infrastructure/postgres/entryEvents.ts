import { sql } from 'drizzle-orm';
import type { SessionDraft } from '../../domain/entries/ParkingSessionRepository.ts';
import type { Transaction } from './database.ts';
import { appendSessionEvent, sessionInstant } from './sessionEventStatements.ts';
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
    occurredAt: sessionInstant(sessionId, 'entry_scan_at'),
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

interface BarrierOpenedRow extends Record<string, unknown> {
  readonly opened: boolean;
}

// With the loop and the job's cancellation, every logged scan ends in a closing event.
export async function logFailedAdmission(tx: Transaction, { sessionId, lotId }: SessionInLot): Promise<void> {
  await appendSessionEvent(tx, {
    sessionId,
    lotId,
    occurredAt: sessionInstant(sessionId, 'cancelled_at'),
    event: { kind: 'ENTRY_CANCELLED', payload: { reason: 'ADMISSION_FAILED' } },
  });
}

// opened tells an entry whose barrier opened and no car crossed from one stopped before its barrier (decision 035).
export async function logEntryWithoutLoop(tx: Transaction, { sessionId, lotId }: SessionInLot): Promise<void> {
  const [row] = await tx.execute<BarrierOpenedRow>(sql`
    select exists (select 1 from gate_command where session_id = ${sessionId} and kind = 'OPEN') as opened`);
  await appendSessionEvent(tx, {
    sessionId,
    lotId,
    occurredAt: sessionInstant(sessionId, 'cancelled_at'),
    event: { kind: 'ENTRY_CANCELLED', payload: { reason: 'NO_LOOP', opened: row?.opened === true } },
  });
}
