import type { LotOnlineRequest, LotPublication } from '@palier/shared-types';
import { DashboardRefusedError } from '../dashboard/DashboardRefusedError.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from '../dashboard/memberOperator.ts';
import type { Clock } from '../time/Clock.ts';
import { publicationOf } from './lotPrerequisites.ts';
import type { LotPublicationRepository, PublicationWrite } from './LotPublicationRepository.ts';

export interface LotPublicationSources {
  readonly operators: MemberOperators;
  readonly publication: LotPublicationRepository;
  // The test clock when it is active, so a test moves "today" and the instant spot holds are freed at.
  readonly clock: Clock;
}

export async function readPublicationOfMember(sources: LotPublicationSources, lot: MemberLot): Promise<LotPublication> {
  return readOwnedPublication(sources.publication, await operatorIdOfMember(sources.operators, lot), lot.lotId);
}

// Pressed twice, either way, the second press changes nothing.
export async function changeOnlineOfMember(sources: LotPublicationSources, lot: MemberLot, { online }: LotOnlineRequest): Promise<LotPublication> {
  const operatorId = await operatorIdOfMember(sources.operators, lot);
  refuseUnwritten(await sources.publication.changeOnline(operatorId, lot.lotId, { online, now: sources.clock() }));
  return readOwnedPublication(sources.publication, operatorId, lot.lotId);
}

export function refuseUnwritten(write: PublicationWrite): void {
  if (write !== 'written') {
    throw new DashboardRefusedError(write);
  }
}

export async function readOwnedPublication(publication: LotPublicationRepository, operatorId: string, lotId: string): Promise<LotPublication> {
  return publicationOf(ownedLotOrNotFound(await publication.readPublicationFacts(operatorId, lotId)));
}
