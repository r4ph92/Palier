import { missingPrerequisitesOf, type PublicationFacts } from '../../domain/publication/lotPrerequisites.ts';
import type { LotAttestation, LotPublicationRepository, OnlineChange, PublicationWrite } from '../../domain/publication/LotPublicationRepository.ts';
import type { Database, Transaction } from './database.ts';
import type { OwnedLot } from './lockParkingLot.ts';
import { publicationFactsOf, type PublicationFactsRow } from './lotPublicationRows.ts';
import { attestStatement, readPublicationFactsStatement, setLotOnlineStatement } from './lotPublicationStatements.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';
import { endLotSpotHolds, freeHeldSpots } from './spotExpiry.ts';

type Executor = Pick<Transaction, 'execute'>;

export class PostgresLotPublicationRepository implements LotPublicationRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  readPublicationFacts(operatorId: string, lotId: string): Promise<PublicationFacts | null> {
    return readFacts(this.#database, { operatorId, lotId });
  }

  attest(operatorId: string, lotId: string, attestation: LotAttestation): Promise<PublicationWrite> {
    return writeInOwnedLot(this.#database, { operatorId, lotId }, (tx) => attestUnderLock(tx, lotId, attestation));
  }

  changeOnline(operatorId: string, lotId: string, { online, now }: OnlineChange): Promise<PublicationWrite> {
    const lot = { operatorId, lotId };
    return writeInOwnedLot(this.#database, lot, (tx) => (online ? publishUnderLock(tx, lot) : unpublishUnderLock(tx, lotId, now)));
  }
}

async function readFacts(executor: Executor, { operatorId, lotId }: OwnedLot): Promise<PublicationFacts | null> {
  const [row] = await executor.execute<PublicationFactsRow>(readPublicationFactsStatement(operatorId, lotId));
  return row === undefined ? null : publicationFactsOf(lotId, row);
}

async function attestUnderLock(tx: Executor, lotId: string, attestation: LotAttestation): Promise<PublicationWrite> {
  await tx.execute(attestStatement(lotId, attestation));
  return 'written';
}

// Judged on the transaction that holds the lot lock: a gate, spot or pricing change waits for it; Stripe's state is read as last committed.
async function publishUnderLock(tx: Executor, lot: OwnedLot): Promise<PublicationWrite> {
  const facts = await readFacts(tx, lot);
  if (facts === null) {
    return 'LOT_NOT_FOUND';
  }
  if (facts.isOnline) {
    return 'written';
  }
  if (missingPrerequisitesOf(facts).length > 0) {
    return 'LOT_NOT_READY';
  }
  await tx.execute(setLotOnlineStatement(lot.lotId, true));
  return 'written';
}

// A driver holding a spot here could no longer enter: the holds end with the lot, and their spots are free again. Sessions inside stay.
async function unpublishUnderLock(tx: Executor, lotId: string, now: Date): Promise<PublicationWrite> {
  await tx.execute(setLotOnlineStatement(lotId, false));
  await freeHeldSpots(tx, await endLotSpotHolds(tx, { lotId, status: 'RELEASED' }), now);
  return 'written';
}
