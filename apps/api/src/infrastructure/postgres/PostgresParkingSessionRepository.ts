import { and, eq, sql } from 'drizzle-orm';
import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { chooseSpot, type FreeSpot } from '../../domain/allocation/chooseSpot.ts';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type { OpenedSession, ParkingSessionRepository, SessionDraft, SessionStatus } from '../../domain/entries/ParkingSessionRepository.ts';
import { isActiveSessionConflict } from './activeSessionConflict.ts';
import type { Database, Transaction } from './database.ts';
import { parkingSession, spot } from './schema.ts';

const MAX_CLAIM_ATTEMPTS = 3;

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

  async attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<void> {
    await this.#database.update(parkingSession).set({ paymentIntentId }).where(eq(parkingSession.id, sessionId));
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
    await this.#database.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(parkingSession)
        .set({ state: 'CANCELLED', cancelledAt: sql`now()` })
        .where(and(eq(parkingSession.id, sessionId), eq(parkingSession.state, 'CREATED')))
        .returning({ spotId: parkingSession.assignedSpotId });
      if (cancelled === undefined) {
        return;
      }
      await tx
        .update(spot)
        .set({ state: 'AVAILABLE', stateChangedAt: sql`now()` })
        .where(and(eq(spot.id, cancelled.spotId), eq(spot.state, 'ASSIGNED')));
    });
  }
}

interface FreeSpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly number: string;
  readonly level_order: number;
  readonly aisle_code: string;
  readonly distance_to_exit: number;
  readonly needs_check: boolean;
}

// The domain picks the spot (chooseSpot); only that spot row is then locked, and a spot another entry
// holds is skipped rather than waited on (docs/03). A spot lost that way is left out of the next pick.
async function assignFirstFreeSpot(tx: Transaction, lotId: string): Promise<AssignedSpotRow | undefined> {
  const lost = new Set<string>();
  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    const chosen = chooseSpot((await readFreeSpots(tx, lotId)).filter((free) => !lost.has(free.id)));
    if (chosen === null) {
      return undefined;
    }
    const claimed = await claimSpot(tx, chosen.id);
    if (claimed !== undefined) {
      return claimed;
    }
    lost.add(chosen.id);
  }
  return undefined;
}

async function readFreeSpots(tx: Transaction, lotId: string): Promise<FreeSpot[]> {
  const rows = await tx.execute<FreeSpotRow>(sql`
    select s.id, s.number, l.display_order as level_order, a.code as aisle_code, s.distance_to_exit, s.needs_check
    from spot s
    join aisle a on a.id = s.aisle_id
    join level l on l.id = a.level_id
    where s.lot_id = ${lotId} and s.state = 'AVAILABLE'`);
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    levelOrder: row.level_order,
    aisleCode: row.aisle_code,
    distanceToExit: row.distance_to_exit,
    needsCheck: row.needs_check,
  }));
}

async function claimSpot(tx: Transaction, spotId: string): Promise<AssignedSpotRow | undefined> {
  const rows = await tx.execute<AssignedSpotRow>(sql`
    with chosen as (
      select id from spot where id = ${spotId} and state = 'AVAILABLE' for update skip locked
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
