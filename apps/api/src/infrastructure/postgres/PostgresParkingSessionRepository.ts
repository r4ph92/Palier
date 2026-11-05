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
import type { Clock } from '../../domain/time/Clock.ts';
import { findActiveSessionFacts } from './activeSessionFacts.ts';
import { admissionRefusalOf } from './admissionRefusal.ts';
import { cancelCreatedSession } from './cancelCreatedSession.ts';
import type { Database, Transaction } from './database.ts';
import { LOT_LOCK_TRANSACTION, lockParkingLot } from './lockParkingLot.ts';
import { LIMIT_LOCK_WAIT } from './lockTimeout.ts';
import { parkingSession } from './schema.ts';
import { ASSIGNED_TO_ENTRY, claimFirstFittingSpot, type AssignedSpotRow } from './spotClaim.ts';
import { useHeldSpot } from './spotHoldUse.ts';
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
      return await this.#database.transaction(async (tx) => {
        await tx.execute(LIMIT_LOCK_WAIT);
        await lockParkingLot(tx, draft.lotId);
        return await this.#openUnderLotLock(tx, draft);
      }, LOT_LOCK_TRANSACTION);
    } catch (error) {
      throw admissionRefusalOf(error, draft.lotId);
    }
  }

  async #openUnderLotLock(tx: Transaction, draft: SessionDraft): Promise<SessionOpening | null> {
    const decision = decideRepeatedScan(await findActiveSessionFacts(tx, draft.driverId, this.#openingWindow), draft);
    return openingFor(decision, () => openSession(tx, draft, this.#clock()));
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

// The driver's own held spot comes first, so a lot that filled while she drove still has her spot (decision 016).
async function openSession(tx: Transaction, draft: SessionDraft, now: Date): Promise<OpenedSession | null> {
  const assigned =
    (await useHeldSpot(tx, { driverId: draft.driverId, lotId: draft.lotId, now })) ??
    (await claimFirstFittingSpot(tx, { lotId: draft.lotId, needs: draft.needs, target: ASSIGNED_TO_ENTRY }));
  return assigned === undefined ? null : insertSession(tx, draft, assigned);
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
