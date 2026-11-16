import type { TariffPolicy } from '@palier/shared-types';
import { asRecord } from './asRecord';

// A tariff is shown before a hold and sent back on entry (#151): each figure must be a whole positive amount.
export function isTariff(candidate: unknown): candidate is TariffPolicy {
  const { incrementCents, incrementMinutes, dailyCapCents } = asRecord(candidate);
  return isPositiveInteger(incrementCents) && isPositiveInteger(incrementMinutes) && isPositiveInteger(dailyCapCents);
}

function isPositiveInteger(candidate: unknown): candidate is number {
  return Number.isSafeInteger(candidate) && (candidate as number) > 0;
}
