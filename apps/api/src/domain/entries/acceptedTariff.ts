import type { TariffPolicy } from '@palier/shared-types/lotPricing';
import { EntryRefusedError } from './EntryRefusedError.ts';

// The driver enters only at the price she saw (#151): a request without a tariff, or naming any other than the lot's current one, opens nothing.
// The session then copies this same tariff (032), so the hold and the receipt follow what she accepted.
export function requireAcceptedTariff(accepted: TariffPolicy | undefined, current: TariffPolicy): void {
  if (accepted === undefined || !isSameTariff(accepted, current)) {
    throw new EntryRefusedError('TARIFF_CHANGED', { tariff: current });
  }
}

function isSameTariff(accepted: TariffPolicy, current: TariffPolicy): boolean {
  return (
    accepted.incrementCents === current.incrementCents &&
    accepted.incrementMinutes === current.incrementMinutes &&
    accepted.dailyCapCents === current.dailyCapCents
  );
}
