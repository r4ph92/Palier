import { EXIT_SHARE_METHODS, EXIT_SHARE_WINDOW_DAYS, type ExitShareMethod, type LotExitShares } from '@palier/shared-types/exitIdentifications';
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
  return { lotName, totalExits: totalOf(counts), counts };
}

function totalOf(counts: Readonly<Record<ExitShareMethod, number>>): number {
  return EXIT_SHARE_METHODS.reduce((total, method) => total + counts[method], 0);
}
