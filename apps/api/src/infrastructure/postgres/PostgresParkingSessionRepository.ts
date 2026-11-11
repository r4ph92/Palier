import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import { decideRepeatedScan, openingFor } from '../../domain/entries/decideRepeatedScan.ts';
import type {
  HoldAttachment,
  OpenedSession,
  ParkingSessionRepository,
  SessionDraft,
  SessionOpening,
  SessionStatus,
} from '../../domain/entries/ParkingSessionRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import { hasRoomForAnotherVehicle } from '../../domain/occupancy/hasRoomForAnotherVehicle.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { findActiveSessionFacts } from './activeSessionFacts.ts';
import { admissionRefusalOf } from './admissionRefusal.ts';
import { cancelCreatedSession } from './cancelCreatedSession.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock, LOT_LOCK_TRANSACTION, lockParkingLot } from './lockParkingLot.ts';
import { readLotOccupancy } from './lotOccupancy.ts';
import { parkingSession } from './schema.ts';
import { ASSIGNED_TO_ENTRY, claimFirstFittingSpot, type AssignedSpotRow } from './spotClaim.ts';
import { consumeHeldSpot, heldSpotFits, readHeldSpot, releaseUnfitHold } from './spotHoldUse.ts';
import { spotOf, type SpotLabelRow } from './spotLabel.ts';

interface SessionStatusRow extends SpotLabelRow {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly entry_confirmed_at: Date | string | null;
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
  readonly #openingWindow: OpeningWindow;
  readonly #clock: Clock;

  constructor(database: Database, openingWindow: OpeningWindow, clock: Clock) {
    this.#database = database;
    this.#openingWindow = openingWindow;
    this.#clock = clock;
  }

  async openOrReplay(draft: SessionDraft): Promise<SessionOpening | null> {
    try {
      return await inLotLock(this.#database, draft.lotId, (tx) => this.#openUnderLotLock(tx, draft));
    } catch (error) {
      throw admissionRefusalOf(error, draft.lotId);
    }
  }

  async #openUnderLotLock(tx: Transaction, draft: SessionDraft): Promise<SessionOpening | null> {
    const decision = decideRepeatedScan(await findActiveSessionFacts(tx, draft.driverId, this.#openingWindow), draft);
    return openingFor(decision, () => openSession(tx, draft));
  }

  async attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<HoldAttachment> {
    const rows = await this.#database.execute<{ state: EntrySessionState }>(sql`
      update parking_session
      set payment_intent_id = ${paymentIntentId}, hold_release_pending = (state = 'CANCELLED')
      where id = ${sessionId} and state in ('CREATED', 'CANCELLED')
      returning state`);
    const state = rows[0]?.state;
    if (state === undefined) {
      throw new Error(`Session ${sessionId} is neither awaiting its hold nor cancelled: its hold was not recorded.`);
    }
    return state === 'CANCELLED' ? 'cancelled' : 'attached';
  }

  // The spot is the one the driver answered, once they did.
  async findForUser(sessionId: string, userId: string): Promise<SessionStatus | null> {
    const rows = await this.#database.execute<SessionStatusRow>(sql`
      select ps.id, ps.state, ps.entry_confirmed_at, spot.number, aisle.code as aisle_code, level.code as level_code
      from parking_session ps
      join spot on spot.id = coalesce(ps.confirmed_spot_id, ps.assigned_spot_id)
      join aisle on aisle.id = spot.aisle_id
      join level on level.id = aisle.level_id
      where ps.id = ${sessionId} and ps.user_id = ${userId}`);
    const row = rows[0];
    return row === undefined ? null : statusOf(row);
  }

  async cancel(sessionId: string): Promise<void> {
    await this.#database.transaction(async (tx) => {
      const lotId = await lotOfSession(tx, sessionId);
      if (lotId !== undefined) {
        await lockParkingLot(tx, lotId);
      }
      await cancelCreatedSession(tx, sessionId, this.#clock());
    }, LOT_LOCK_TRANSACTION);
  }
}

// The driver's own held spot comes first, so a lot that filled while she drove still has her spot (decision 016).
async function openSession(tx: Transaction, draft: SessionDraft): Promise<OpenedSession | null> {
  const query = { driverId: draft.driverId, lotId: draft.lotId, now: draft.now };
  const held = await readHeldSpot(tx, query);
  if (heldSpotFits(draft.needs, held)) {
    return insertSession(tx, draft, { assigned: await consumeHeldSpot(tx, query, held), consumedSpotHoldId: held.hold_id });
  }
  // Any usable hold is already her room; without one, the room is read again here, where concurrent scans wait their turn (#110).
  if (held === undefined && !(await hasRoomUnderLotLock(tx, draft.lotId))) {
    return null;
  }
  const assigned = await claimFirstFittingSpot(tx, { lotId: draft.lotId, needs: draft.needs, target: ASSIGNED_TO_ENTRY });
  if (assigned === undefined) {
    return null;
  }
  if (held !== undefined) {
    await releaseUnfitHold(tx, query, held);
  }
  return insertSession(tx, draft, { assigned, consumedSpotHoldId: null });
}

async function hasRoomUnderLotLock(tx: Transaction, lotId: string): Promise<boolean> {
  const occupancy = await readLotOccupancy(tx, lotId);
  return occupancy !== undefined && hasRoomForAnotherVehicle(occupancy);
}

// Read before the lot lock, which needs the lot; the lot of a session never changes.
async function lotOfSession(tx: Transaction, sessionId: string): Promise<string | undefined> {
  const rows = await tx.execute<{ lot_id: string }>(sql`select lot_id from parking_session where id = ${sessionId}`);
  return rows[0]?.lot_id;
}

interface Seat {
  readonly assigned: AssignedSpotRow;
  readonly consumedSpotHoldId: string | null;
}

async function insertSession(tx: Transaction, draft: SessionDraft, { assigned, consumedSpotHoldId }: Seat): Promise<OpenedSession> {
  const [session] = await tx.insert(parkingSession).values({ ...sessionValues(draft, assigned.id), consumedSpotHoldId }).returning({ id: parkingSession.id });
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
    cardLast4: draft.cardLast4,
    pricingIncrementCents: draft.pricing.incrementCents,
    pricingIncrementMinutes: draft.pricing.incrementMinutes,
    pricingDailyCapCents: draft.pricing.dailyCapCents,
  };
}
