import type { AssignedSpot } from '@palier/shared-types';
import {
  decideSessionAnswer,
  decideSpotAnswer,
  type ParkedAnswer,
  type ParkedAnswerRepository,
  type SpotAnswer,
} from '../../domain/parkingSessions/ParkedAnswer.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock, orLotBusy } from './lockParkingLot.ts';
import {
  confirmParkedSpot,
  lockAnsweredSpot,
  lockAnsweringSession,
  occupyAnsweredSpot,
  readSessionLot,
  type AnsweringSession,
} from './parkedAnswerStatements.ts';

// Lot, then session, then spot (decision 014); the spot is decided from its state read under the lock, then written (decision 020).
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
  return placeCar(tx, answer, lotId);
}

// parking_session_confirmed_has_spot guarantees it.
function confirmedSpotOf({ confirmedSpot }: AnsweringSession): AssignedSpot {
  if (confirmedSpot === null) {
    throw new Error('A session confirmed parked has no confirmed spot.');
  }
  return confirmedSpot;
}

async function placeCar(tx: Transaction, answer: SpotAnswer, lotId: string): Promise<ParkedAnswer> {
  const spot = await lockAnsweredSpot(tx, { lotId, spotNumber: answer.spotNumber });
  if (spot === null) {
    return { outcome: 'unknown-spot' };
  }
  const decision = decideSpotAnswer(spot.state);
  if (decision !== 'occupy') {
    return { outcome: decision };
  }
  await occupyAnsweredSpot(tx, spot.id);
  await confirmParkedSpot(tx, answer.sessionId, spot.id);
  return { outcome: 'confirmed', spot: spot.label };
}
