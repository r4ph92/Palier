import { sql } from 'drizzle-orm';
import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { decideRepeatedScan } from '../../domain/entries/decideRepeatedScan.ts';
import type {
  HoldAttachment,
  OpenedSession,
  ParkingSessionRepository,
  SessionDraft,
  SessionOpening,
  SessionStatus,
} from '../../domain/entries/ParkingSessionRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import { findActiveSessionFacts } from './activeSessionFacts.ts';
import { admissionRefusalOf } from './admissionRefusal.ts';
import { cancelCreatedSession } from './cancelCreatedSession.ts';
import type { Database, Transaction } from './database.ts';
import { lockParkingLot } from './lockParkingLot.ts';
import { parkingSession } from './schema.ts';
import { assignFirstFreeSpot, type AssignedSpotRow } from './spotClaim.ts';

// Past it, a waiting entry gives up with a retryable refusal instead of holding a pool connection.
const LIMIT_LOCK_WAIT = sql`set local lock_timeout = '3s'`;

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
  readonly #openingWindow: OpeningWindow;

  constructor(database: Database, openingWindow: OpeningWindow) {
    this.#database = database;
    this.#openingWindow = openingWindow;
  }

  // Every statement after the lock runs on tx, so a second scan of the same lot waits and then reads the first one's session.
  async openWithFirstFreeSpot(draft: SessionDraft): Promise<SessionOpening | null> {
    try {
      return await this.#database.transaction(async (tx) => {
        await tx.execute(LIMIT_LOCK_WAIT);
        await lockParkingLot(tx, draft.lotId);
        return await this.#openUnderLotLock(tx, draft);
      });
    } catch (error) {
      throw admissionRefusalOf(error, draft.lotId);
    }
  }

  async #openUnderLotLock(tx: Transaction, draft: SessionDraft): Promise<SessionOpening | null> {
    const decision = decideRepeatedScan(await findActiveSessionFacts(tx, draft.driverId, this.#openingWindow), draft);
    if (decision.kind === 'refuse') {
      throw new EntryRefusedError('ALREADY_INSIDE');
    }
    if (decision.kind === 'replay') {
      return { kind: 'replayed', session: decision.session };
    }
    const assigned = await assignFirstFreeSpot(tx, draft.lotId, draft.needs);
    return assigned === undefined ? null : { kind: 'opened', session: await insertSession(tx, draft, assigned) };
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
