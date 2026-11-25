import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { ClosedExit, ClosedPendingExit, ExitableSession, ExitClosing, ExitIdentification, ExitRepository, PaidExit, PendingExitClosing, ReadIdentifierKind } from '../../domain/exits/ExitRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import { EXIT_CLOSABLE_STATES, EXITABLE_COLUMNS, exitableSessionOf, LEAVABLE_STATES, paidExitOf, type ExitableRow } from './exitableSessionSql.ts';
import type { Database, Transaction } from './database.ts';
import { logPaidExit, logPendingExit } from './exitEventStatements.ts';
import { storeOpenCommand } from './gateCommandStatements.ts';
import { inLotLock, orLotBusy } from './lockParkingLot.ts';
import { isWithinOpeningWindow } from './openingWindowSql.ts';
import { freeSpots, type ClosedSessionRow } from './sessionSpotRelease.ts';

interface ExitClosedRow extends ClosedSessionRow {
  // The operator's closing already freed and flagged the spots: the exit leaves them as they are now.
  readonly was_closed_by_staff: boolean;
}

interface PaidExitRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly exit_at: Date | string;
  readonly captured_cents: number | null;
  readonly surplus_paid_cents: number;
  readonly unpaid_cents: number;
}

export class PostgresExitRepository implements ExitRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findForExit(sessionId: string, driverId: string): Promise<ExitableSession | null> {
    const rows = await this.#database.execute<ExitableRow>(sql`
      select ${EXITABLE_COLUMNS}
      from parking_session ps
      where ps.id = ${sessionId} and ps.user_id = ${driverId}`);
    const row = rows[0];
    return row === undefined ? null : exitableSessionOf(row);
  }

  async findLeavableByIdentifier(lotId: string, kind: ReadIdentifierKind, key: string): Promise<readonly ExitableSession[]> {
    const matches =
      kind === 'PLATE'
        ? sql`upper(regexp_replace(ps.plate, '[ -]', '', 'g')) = ${key}`
        : sql`exists (select 1 from vehicle where vehicle.id = ps.vehicle_id and vehicle.transponder_key = ${key})`;
    const rows = await this.#database.execute<ExitableRow>(sql`
      select ${EXITABLE_COLUMNS}
      from parking_session ps
      where ps.lot_id = ${lotId} and ps.state in ${LEAVABLE_STATES} and ${matches}
      limit 2`);
    return rows.map(exitableSessionOf);
  }

  // Lot, then session, then spots: the order every other writer takes. The gate command is part of the transaction, so a paid
  // session always has its open command and a command never exists for a session left open. The events follow the real order:
  // identification, the capture Stripe confirmed before this transaction, then the opening (decision 038).
  async close({ sessionId, lotId, exitGateId, identification, exit, capturedAt }: ExitClosing): Promise<ClosedExit> {
    return orLotBusy(
      inLotLock(this.#database, lotId, async (tx) => {
        const session = await closeSession(tx, sessionId, { identification, ...exit });
        if (session === null) {
          return { outcome: 'already', exit: await readPaidExit(tx, sessionId) } as const;
        }
        await logPaidExit(tx, { sessionId, lotId, exitGateId, identification }, { ...exit, capturedAt });
        await openGate(tx, { sessionId, lotId, exitGateId, session, now: exit.exitedAt });
        return { outcome: 'closed', exit } as const;
      }),
    );
  }

  // Same lot lock, same order and same gate command as a paid exit: the driver leaves whether or not Stripe answered.
  async closeWithPendingCapture({ sessionId, lotId, exitGateId, identification, ...pending }: PendingExitClosing): Promise<ClosedPendingExit> {
    return orLotBusy(
      inLotLock(this.#database, lotId, async (tx): Promise<ClosedPendingExit> => {
        const session = await closePendingSession(tx, sessionId, { identification, ...pending });
        if (session === null) {
          return { outcome: 'already' };
        }
        await logPendingExit(tx, { sessionId, lotId, exitGateId, identification }, pending);
        await openGate(tx, { sessionId, lotId, exitGateId, session, now: pending.exitedAt });
        return { outcome: 'closed' };
      }),
    );
  }

  // On the database clock, like the window that reads it. Only a session that can still leave, in its own lot (the major is the lot's).
  async recordBeaconReport(sessionId: string, major: number): Promise<boolean> {
    const rows = await this.#database.execute(sql`
      insert into exit_beacon_report (session_id, reported_at)
      select ps.id, now() from parking_session ps join parking_lot lot on lot.id = ps.lot_id
      where ps.id = ${sessionId} and lot.beacon_major = ${major} and ps.state in ${LEAVABLE_STATES}
      on conflict (session_id) do update set reported_at = excluded.reported_at
      returning session_id`);
    return rows.length > 0;
  }

  async recordVehiclePresence(gateId: string): Promise<void> {
    await this.#database.execute(sql`
      insert into exit_vehicle_presence (gate_id, seen_at) values (${gateId}, now())
      on conflict (gate_id) do update set seen_at = excluded.seen_at`);
  }

  async findBeaconCandidates(lotId: string, window: OpeningWindow): Promise<readonly ExitableSession[]> {
    const rows = await this.#database.execute<ExitableRow>(sql`
      select ${EXITABLE_COLUMNS}
      from parking_session ps join exit_beacon_report report on report.session_id = ps.id
      where ps.lot_id = ${lotId} and ps.state in ${LEAVABLE_STATES} and ${isWithinOpeningWindow(sql`report.reported_at`, window)}
      limit 2`);
    return rows.map(exitableSessionOf);
  }

  // One delete decides who spends the presence: two requests at once cannot both open for one vehicle.
  async takeVehiclePresence(gateId: string, window: OpeningWindow): Promise<boolean> {
    const rows = await this.#database.execute(sql`
      delete from exit_vehicle_presence where gate_id = ${gateId} and ${isWithinOpeningWindow(sql`seen_at`, window)} returning gate_id`);
    return rows.length > 0;
  }
}

interface IdentifiedExit {
  readonly identification: ExitIdentification;
}

interface GateOpening {
  readonly sessionId: string;
  readonly lotId: string;
  readonly exitGateId: string;
  readonly session: ExitClosedRow;
  readonly now: Date;
}

async function openGate(tx: Transaction, { sessionId, lotId, exitGateId, session, now }: GateOpening): Promise<void> {
  if (!session.was_closed_by_staff) {
    await freeSpots(tx, { sessionId, session, now });
  }
  await storeOpenCommand(tx, { gateId: exitGateId, lotId, sessionId }, 'EXIT');
}

// Null when another request closed the session first. A driver at the exit gate proves the car was there, so a staff closing gives way:
// the hold the operator meant to cancel now pays the stay, and the #50 job stops cancelling it. staff_closed_by stays as history.
async function closeSession(tx: Transaction, sessionId: string, { identification, exitedAt, capturedCents, surplusPaidCents, unpaidCents }: PaidExit & IdentifiedExit): Promise<ExitClosedRow | null> {
  const rows = await tx.execute<ExitClosedRow>(sql`
    with previous as (select state from parking_session where id = ${sessionId})
    update parking_session
    set state = 'CLOSED_PAID', exit_at = ${exitedAt.toISOString()}::timestamptz, exit_identification = ${identification}, captured_cents = ${capturedCents},
      surplus_paid_cents = ${surplusPaidCents}, unpaid_cents = ${unpaidCents}, hold_release_pending = false
    where id = ${sessionId} and state in ${EXIT_CLOSABLE_STATES}
    returning assigned_spot_id, confirmed_spot_id, (select state = 'CLOSED_BY_STAFF' from previous) as was_closed_by_staff`);
  return rows[0] ?? null;
}

// Null for a session another request left with its capture pending: the retry will pay it.
async function readPaidExit(tx: Transaction, sessionId: string): Promise<PaidExit | null> {
  const [row] = await tx.execute<PaidExitRow>(sql`
    select state, exit_at, captured_cents, surplus_paid_cents, unpaid_cents from parking_session where id = ${sessionId} and state in ('CLOSED_PAID', 'CLOSED_CAPTURE_PENDING')`);
  if (row === undefined) {
    throw new Error(`Session ${sessionId} is neither leavable nor closed: it cannot be exited.`);
  }
  return row.state === 'CLOSED_PAID' && row.captured_cents !== null ? paidExitOf(row, row.exit_at, row.captured_cents) : null;
}

// Null when another request closed the session first; a staff closing gives way as for a paid exit, and the retry takes the capture.
async function closePendingSession(tx: Transaction, sessionId: string, { identification, exitedAt, pendingCaptureCents, pendingSurplusCents }: Omit<PendingExitClosing, 'sessionId' | 'lotId' | 'exitGateId'>): Promise<ExitClosedRow | null> {
  const rows = await tx.execute<ExitClosedRow>(sql`
    with previous as (select state from parking_session where id = ${sessionId})
    update parking_session
    set state = 'CLOSED_CAPTURE_PENDING', exit_at = ${exitedAt.toISOString()}::timestamptz, exit_identification = ${identification},
      pending_capture_cents = ${pendingCaptureCents}, pending_surplus_cents = ${pendingSurplusCents}, hold_release_pending = false
    where id = ${sessionId} and state in ${EXIT_CLOSABLE_STATES}
    returning assigned_spot_id, confirmed_spot_id, (select state = 'CLOSED_BY_STAFF' from previous) as was_closed_by_staff`);
  return rows[0] ?? null;
}
