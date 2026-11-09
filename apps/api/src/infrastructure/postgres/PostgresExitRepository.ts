import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { ClosedExit, ExitableSession, ExitClosing, ExitRepository, PaidExit } from '../../domain/exits/ExitRepository.ts';
import { spotsFreedOnExit, type SpotOfExit } from '../../domain/exits/spotsFreedOnExit.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';
import { activeSessionOf } from './activeSessionStates.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock, orLotBusy } from './lockParkingLot.ts';

interface ExitableRow extends Record<string, unknown> {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly lot_id: string;
  readonly payment_intent_id: string | null;
  readonly authorized_cents: number;
  readonly entry_scan_at: Date | string;
  readonly pricing_increment_cents: number;
  readonly pricing_increment_minutes: number;
  readonly pricing_daily_cap_cents: number;
  readonly exit_gate_id: string | null;
  readonly exit_at: Date | string | null;
  readonly captured_cents: number | null;
}

interface PaidExitRow extends Record<string, unknown> {
  readonly exit_at: Date | string;
  readonly captured_cents: number;
}

interface ClosedSessionRow extends Record<string, unknown> {
  readonly assigned_spot_id: string;
  readonly confirmed_spot_id: string | null;
}

interface SpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly state: SpotState;
  readonly held_by_another_session: boolean;
}

// Sessions that went through the gate and have not left: the only ones an exit closes.
const LEAVABLE_STATES = sql`('ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED')`;

export class PostgresExitRepository implements ExitRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findForExit(sessionId: string, driverId: string): Promise<ExitableSession | null> {
    const rows = await this.#database.execute<ExitableRow>(sql`
      select ps.id, ps.state, ps.lot_id, ps.payment_intent_id, ps.authorized_cents, ps.entry_scan_at, ps.exit_at, ps.captured_cents,
        ps.pricing_increment_cents, ps.pricing_increment_minutes, ps.pricing_daily_cap_cents,
        (select gate.id from gate where gate.lot_id = ps.lot_id and gate.kind = 'EXIT' order by gate.name limit 1) as exit_gate_id
      from parking_session ps
      where ps.id = ${sessionId} and ps.user_id = ${driverId}`);
    const row = rows[0];
    return row === undefined ? null : exitableSessionOf(row);
  }

  // Lot, then session, then spots: the order every other writer takes. The gate command is part of the transaction, so a paid
  // session always has its open command and a command never exists for a session left open.
  async close({ sessionId, lotId, exitGateId, exit }: ExitClosing): Promise<ClosedExit> {
    return orLotBusy(
      inLotLock(this.#database, lotId, async (tx) => {
        const session = await closeSession(tx, sessionId, exit);
        if (session === null) {
          return { outcome: 'already', exit: await readPaidExit(tx, sessionId) } as const;
        }
        await freeSpots(tx, { sessionId, session, now: exit.exitedAt });
        await tx.execute(sql`insert into gate_command (gate_id, lot_id, kind, session_id) values (${exitGateId}, ${lotId}, 'OPEN', ${sessionId})`);
        return { outcome: 'closed', exit } as const;
      }),
    );
  }
}

function exitableSessionOf(row: ExitableRow): ExitableSession {
  return {
    id: row.id,
    state: row.state,
    lotId: row.lot_id,
    paymentIntentId: row.payment_intent_id,
    authorizedCents: row.authorized_cents,
    enteredAt: new Date(row.entry_scan_at),
    pricing: {
      incrementCents: row.pricing_increment_cents,
      incrementMinutes: row.pricing_increment_minutes,
      dailyCapCents: row.pricing_daily_cap_cents,
    },
    exitGateId: row.exit_gate_id,
    paidExit: row.exit_at === null || row.captured_cents === null ? null : { exitedAt: new Date(row.exit_at), capturedCents: row.captured_cents },
  };
}

// Null when the session is not leavable any more: another request closed it first.
async function closeSession(tx: Transaction, sessionId: string, { exitedAt, capturedCents }: PaidExit): Promise<ClosedSessionRow | null> {
  const rows = await tx.execute<ClosedSessionRow>(sql`
    update parking_session
    set state = 'CLOSED_PAID', exit_at = ${exitedAt.toISOString()}::timestamptz, exit_identification = 'APP', captured_cents = ${capturedCents}
    where id = ${sessionId} and state in ${LEAVABLE_STATES}
    returning assigned_spot_id, confirmed_spot_id`);
  return rows[0] ?? null;
}

async function readPaidExit(tx: Transaction, sessionId: string): Promise<PaidExit> {
  const [row] = await tx.execute<PaidExitRow>(sql`select exit_at, captured_cents from parking_session where id = ${sessionId} and state = 'CLOSED_PAID'`);
  if (row === undefined) {
    throw new Error(`Session ${sessionId} is neither leavable nor paid: it cannot be exited.`);
  }
  return { exitedAt: new Date(row.exit_at), capturedCents: row.captured_cents };
}

interface SpotsToFree {
  readonly sessionId: string;
  readonly session: ClosedSessionRow;
  readonly now: Date;
}

// The car's spot is the confirmed one once the driver answered, the assigned one before; the others are the history of the session.
async function freeSpots(tx: Transaction, { sessionId, session, now }: SpotsToFree): Promise<void> {
  const ownSpotId = session.confirmed_spot_id ?? session.assigned_spot_id;
  const freed = spotsFreedOnExit(ownSpotId, await lockSpotsOfSession(tx, sessionId, session));
  if (freed.length === 0) {
    return;
  }
  await tx.execute(sql`
    update spot set state = 'AVAILABLE', state_changed_at = ${now.toISOString()}::timestamptz
    where id in (${sql.join(freed.map((id) => sql`${id}`), sql`, `)})`);
}

async function lockSpotsOfSession(tx: Transaction, sessionId: string, session: ClosedSessionRow): Promise<SpotOfExit[]> {
  const ownSpotId = session.confirmed_spot_id ?? session.assigned_spot_id;
  const rows = await tx.execute<SpotRow>(sql`
    select spot.id, spot.state,
      exists (
        select 1 from parking_session other
        where other.id <> ${sessionId} and ${activeSessionOf('other')} and (other.assigned_spot_id = spot.id or other.confirmed_spot_id = spot.id)
      ) as held_by_another_session
    from spot
    where spot.id = ${ownSpotId} or spot.id = ${session.assigned_spot_id}
      or spot.id in (select spot_id from parking_session_reported_spot where session_id = ${sessionId})
    for update of spot`);
  return rows.map((row) => ({ id: row.id, state: row.state, heldByAnotherSession: row.held_by_another_session }));
}
