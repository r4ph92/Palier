import { sql } from 'drizzle-orm';
import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type { OpenedSession, ParkingSessionRepository, SessionDraft, SessionStatus } from '../../domain/entries/ParkingSessionRepository.ts';
import { isActiveSessionConflict } from './activeSessionConflict.ts';
import { cancelCreatedSession } from './cancelCreatedSession.ts';
import type { Database, Transaction } from './database.ts';
import { parkingSession } from './schema.ts';

interface AssignedSpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
}

interface SessionStatusRow extends Record<string, unknown> {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly entry_confirmed_at: Date | string | null;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
}

function spotOf(row: Pick<AssignedSpotRow, 'number' | 'level_code' | 'aisle_code'>): AssignedSpot {
  return { number: row.number, levelCode: row.level_code, aisleCode: row.aisle_code };
}

function statusOf(row: SessionStatusRow): SessionStatus {
  return {
    id: row.id,
    state: row.state,
    spot: spotOf(row),
    entryConfirmedAt: row.entry_confirmed_at === null ? null : new Date(row.entry_confirmed_at),
  };
}

export class PostgresParkingSessionRepository implements ParkingSessionRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async openWithFirstFreeSpot(draft: SessionDraft): Promise<OpenedSession | null> {
    try {
      return await this.#database.transaction(async (tx) => {
        const assigned = await assignFirstFreeSpot(tx, draft.lotId);
        return assigned === undefined ? null : insertSession(tx, draft, assigned);
      });
    } catch (error) {
      if (isActiveSessionConflict(error)) {
        throw new EntryRefusedError('ALREADY_INSIDE', { cause: error });
      }
      throw error;
    }
  }

  async attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<boolean> {
    const rows = await this.#database.execute<{ is_created: boolean }>(sql`
      update parking_session
      set payment_intent_id = ${paymentIntentId}, hold_release_pending = state <> 'CREATED'
      where id = ${sessionId}
      returning state = 'CREATED' as is_created`);
    return rows[0]?.is_created === true;
  }

  async findForUser(sessionId: string, userId: string): Promise<SessionStatus | null> {
    const rows = await this.#database.execute<SessionStatusRow>(sql`
      select ps.id, ps.state, ps.entry_confirmed_at, spot.number, aisle.code as aisle_code, level.code as level_code
      from parking_session ps
      join spot on spot.id = ps.assigned_spot_id
      join aisle on aisle.id = spot.aisle_id
      join level on level.id = aisle.level_id
      where ps.id = ${sessionId} and ps.user_id = ${userId}`);
    const row = rows[0];
    return row === undefined ? null : statusOf(row);
  }

  async cancel(sessionId: string): Promise<void> {
    await this.#database.transaction((tx) => cancelCreatedSession(tx, sessionId));
  }
}

// Only the spot row is locked, and a spot another entry holds is skipped rather than waited on (docs/03).
// Order: level, aisle, then the number's trailing digits, so A-2 comes before A-10.
async function assignFirstFreeSpot(tx: Transaction, lotId: string): Promise<AssignedSpotRow | undefined> {
  const rows = await tx.execute<AssignedSpotRow>(sql`
    with chosen as (
      select s.id
      from spot s
      join aisle a on a.id = s.aisle_id
      join level l on l.id = a.level_id
      where s.lot_id = ${lotId} and s.state = 'AVAILABLE'
      order by l.display_order, a.code, substring(s.number from '(\\d+)$')::int nulls last, s.number
      limit 1
      for update of s skip locked
    )
    update spot
    set state = 'ASSIGNED', state_changed_at = now()
    from chosen, aisle, level
    where spot.id = chosen.id and aisle.id = spot.aisle_id and level.id = aisle.level_id
    returning spot.id, spot.number, aisle.code as aisle_code, level.code as level_code`);
  return rows[0];
}

async function insertSession(tx: Transaction, draft: SessionDraft, assigned: AssignedSpotRow): Promise<OpenedSession> {
  const [session] = await tx.insert(parkingSession).values(sessionValues(draft, assigned.id)).returning({ id: parkingSession.id });
  if (session === undefined) {
    throw new Error('The parking session was not created.');
  }
  return { id: session.id, spot: spotOf(assigned) };
}

function sessionValues(draft: SessionDraft, assignedSpotId: string): typeof parkingSession.$inferInsert {
  return {
    userId: draft.driverId,
    vehicleId: draft.vehicleId,
    plate: draft.plate,
    lotId: draft.lotId,
    assignedSpotId,
    entryGateId: draft.entryGateId,
    authorizedCents: draft.authorizedCents,
    pricingIncrementCents: draft.pricing.incrementCents,
    pricingIncrementMinutes: draft.pricing.incrementMinutes,
    pricingDailyCapCents: draft.pricing.dailyCapCents,
  };
}
