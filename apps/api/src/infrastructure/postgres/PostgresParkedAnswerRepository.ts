import type { AssignedSpot } from '@palier/shared-types';
import {
  decidePlacement,
  decideSessionAnswer,
  type ParkedAnswer,
  type ParkedAnswerRepository,
  type SpotAnswer,
} from '../../domain/parkingSessions/ParkedAnswer.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock, orLotBusy } from './lockParkingLot.ts';
import {
  confirmParkedSpot,
  flagAssignedSpotToCheck,
  lockAnsweredSpot,
  lockAnsweringSession,
  occupyAnsweredSpot,
  readSessionLot,
  type AnsweredSpot,
  type AnsweringSession,
} from './parkedAnswerStatements.ts';

// Lot, then session, then spot (decision 014); the spot is decided from its state read under the lock, then written (decisions 020, 021).
export class PostgresParkedAnswerRepository implements ParkedAnswerRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async answer(answer: SpotAnswer): Promise<ParkedAnswer> {
    const lotId = await readSessionLot(this.#database, answer);
    if (lotId === null) {
      return { outcome: 'not-found' };
    }
    return orLotBusy(inLotLock(this.#database, lotId, (tx) => answerUnderLotLock(tx, answer, lotId)));
  }
}

async function answerUnderLotLock(tx: Transaction, answer: SpotAnswer, lotId: string): Promise<ParkedAnswer> {
  const session = await lockAnsweringSession(tx, answer);
  if (session === null) {
    return { outcome: 'not-found' };
  }
  const decision = decideSessionAnswer(session.state);
  if (decision === 'already') {
    return { outcome: 'already', spot: confirmedSpotOf(session) };
  }
  if (decision !== 'take-spot') {
    return { outcome: decision };
  }
  return placeCar(tx, answer, { lotId, session });
}

// parking_session_confirmed_has_spot guarantees it.
function confirmedSpotOf({ confirmedSpot }: AnsweringSession): AssignedSpot {
  if (confirmedSpot === null) {
    throw new Error('A session confirmed parked has no confirmed spot.');
  }
  return confirmedSpot;
}

interface PlacingSession {
  readonly lotId: string;
  readonly session: AnsweringSession;
}

async function placeCar(tx: Transaction, answer: SpotAnswer, { lotId, session }: PlacingSession): Promise<ParkedAnswer> {
  const spot = await lockAnsweredSpot(tx, { lotId, spotNumber: answer.spotNumber });
  if (spot === null) {
    return { outcome: 'unknown-spot' };
  }
  const decision = decidePlacement({ sessionState: session.state, assignedSpotId: session.assignedSpotId, spotId: spot.id, spotState: spot.state });
  if (decision === 'spot-taken' || decision === 'spot-out-of-service') {
    return { outcome: decision };
  }
  if (decision !== 'keep-presumed') {
    await occupyAnsweredSpot(tx, spot.id);
  }
  if (decision === 'move-from-presumed') {
    await flagAssignedSpotToCheck(tx, session.assignedSpotId);
  }
  return confirmPlacement(tx, answer.sessionId, spot);
}

async function confirmPlacement(tx: Transaction, sessionId: string, spot: AnsweredSpot): Promise<ParkedAnswer> {
  await confirmParkedSpot(tx, sessionId, spot.id);
  return { outcome: 'confirmed', spot: spot.label };
}
