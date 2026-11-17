import { EXIT_SHARE_WINDOW_DAYS, type LotExitShares } from '@palier/shared-types/exitIdentifications';
import type { Clock } from '../time/Clock.ts';
import type { ExitIdentificationReader } from './ExitIdentificationReader.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotExitShareSources {
  readonly operators: MemberOperators;
  readonly exitIdentifications: ExitIdentificationReader;
  readonly clock: Clock;
}

const MILLISECONDS_PER_DAY = 86_400_000;

export async function findLotExitSharesOfMember(sources: LotExitShareSources, lot: MemberLot): Promise<LotExitShares> {
  const operatorId = await operatorIdOfMember(sources.operators, lot);
  const since = new Date(sources.clock().getTime() - EXIT_SHARE_WINDOW_DAYS * MILLISECONDS_PER_DAY);
  const { lotName, counts } = ownedLotOrNotFound(await sources.exitIdentifications.readExitCounts(operatorId, lot.lotId, since));
  return { lotName, totalExits: Object.values(counts).reduce((total, count) => total + count, 0), counts: { ...counts, STAFF: 0 } };
}
