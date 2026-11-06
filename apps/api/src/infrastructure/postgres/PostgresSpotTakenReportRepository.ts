import { chooseReplacementSpot } from '../../domain/allocation/chooseReplacementSpot.ts';
import { reportPlanOf, type SpotTakenOutcome, type SpotTakenReport, type SpotTakenReportRepository } from '../../domain/parkingSessions/SpotTakenReport.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock, orLotBusy } from './lockParkingLot.ts';
import { flagAssignedSpotToCheck, readSessionLot } from './parkedAnswerStatements.ts';
import { spotOf } from './spotLabel.ts';
import { claimFirstFittingSpot, OCCUPIED_BY_REPORT, readFreeSpotsNoSessionHolds, type SpotChooser } from './spotClaim.ts';
import { askWhereParkedAfterReport, lockReportingSession, reassignSession, recordReportedSpot, type ReportingSession } from './spotTakenStatements.ts';

// Lot, then session with its spot, then the new spot, in one transaction (docs/03, decision 022).
export class PostgresSpotTakenReportRepository implements SpotTakenReportRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async report(report: SpotTakenReport): Promise<SpotTakenOutcome> {
    const lotId = await readSessionLot(this.#database, report);
    if (lotId === null) {
      return { outcome: 'not-found' };
    }
    return orLotBusy(inLotLock(this.#database, lotId, (tx) => reportUnderLotLock(tx, report, lotId)));
  }
}

async function reportUnderLotLock(tx: Transaction, report: SpotTakenReport, lotId: string): Promise<SpotTakenOutcome> {
  const session = await lockReportingSession(tx, report);
  if (session === null) {
    return { outcome: 'not-found' };
  }
  const plan = reportPlanOf({ sessionState: session.state, assignedSpot: session.assignedSpot, reportedNumber: report.spotNumber });
  if (plan.outcome === 'refused') {
    return { outcome: plan.refusal };
  }
  if (plan.flagsReported) {
    await flagAssignedSpotToCheck(tx, session.assignedSpot.id);
  }
  await recordReportedSpot(tx, { sessionId: report.sessionId, spotId: session.assignedSpot.id, lotId });
  return moveDriver(tx, { sessionId: report.sessionId, lotId, session });
}

interface DriverToMove {
  readonly sessionId: string;
  readonly lotId: string;
  readonly session: ReportingSession;
}

async function moveDriver(tx: Transaction, { sessionId, lotId, session }: DriverToMove): Promise<SpotTakenOutcome> {
  const { needs, assignedSpot } = session;
  const choose: SpotChooser = (vehicleNeeds, freeSpots) => chooseReplacementSpot(vehicleNeeds, freeSpots, assignedSpot);
  const claimed = await claimFirstFittingSpot(tx, { lotId, needs, target: OCCUPIED_BY_REPORT, choose, readCandidates: readFreeSpotsNoSessionHolds });
  if (claimed === undefined) {
    await askWhereParkedAfterReport(tx, sessionId, assignedSpot.aisleId);
    return { outcome: 'none-free' };
  }
  await reassignSession(tx, sessionId, claimed.id);
  return { outcome: 'reassigned', spot: spotOf(claimed) };
}
