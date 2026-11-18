import { EXIT_SHARE_METHODS, type ExitShareMethod, type LotExitShares } from '@palier/shared-types/exitIdentifications';

export interface ExitShare {
  readonly method: ExitShareMethod;
  readonly percent: number;
}

// Each share is rounded on its own, so the five can add up to 99 or 101 (decision 045).
export function exitSharesOf({ totalExits, counts }: LotExitShares): readonly ExitShare[] {
  return EXIT_SHARE_METHODS.map((method) => ({ method, percent: totalExits === 0 ? 0 : Math.round((counts[method] * 100) / totalExits) }));
}
