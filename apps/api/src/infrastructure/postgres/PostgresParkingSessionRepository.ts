import { and, eq, sql } from 'drizzle-orm';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type { OpenedSession, ParkingSessionRepository, SessionDraft } from '../../domain/entries/ParkingSessionRepository.ts';
import { isActiveSessionConflict } from './activeSessionConflict.ts';
import type { Database } from './database.ts';
import { parkingSession, spot } from './schema.ts';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

interface AssignedSpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
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
  const [session] = await tx
    .insert(parkingSession)
    .values({
      userId: draft.driverId,
      vehicleId: draft.vehicleId,
      plate: draft.plate,
      lotId: draft.lotId,
      assignedSpotId: assigned.id,
      entryGateId: draft.entryGateId,
      authorizedCents: draft.authorizedCents,
    })
    .returning({ id: parkingSession.id });
  if (session === undefined) {
    throw new Error('The parking session was not created.');
  }
  return { id: session.id, spot: { number: assigned.number, levelCode: assigned.level_code, aisleCode: assigned.aisle_code } };
}
