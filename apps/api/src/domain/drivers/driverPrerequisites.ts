import type { VehicleNeeds, VehicleRepository } from '../vehicles/VehicleRepository.ts';
import type { DriverRepository } from './DriverRepository.ts';

export interface DriverPrerequisiteSources {
  readonly vehicles: Pick<VehicleRepository, 'findDefaultVehicle'>;
  readonly drivers: Pick<DriverRepository, 'findStripeCustomerId' | 'findDefaultPaymentMethodId' | 'findSavedCard'>;
}

export interface DriverPrerequisites {
  readonly vehicle: { readonly id: string; readonly plate: string; readonly needs: VehicleNeeds };
  readonly customerId: string;
  readonly paymentMethodId: string;
  // The saved card's last four digits, kept on the session for its receipt; null when the card has none on file.
  readonly cardLast4: string | null;
}

// Null without a default plate or a saved card; each caller refuses with its own error.
export async function findDriverPrerequisites({ vehicles, drivers }: DriverPrerequisiteSources, driverId: string): Promise<DriverPrerequisites | null> {
  const [vehicle, customerId, paymentMethodId, card] = await Promise.all([
    vehicles.findDefaultVehicle(driverId),
    drivers.findStripeCustomerId(driverId),
    drivers.findDefaultPaymentMethodId(driverId),
    drivers.findSavedCard(driverId),
  ]);
  if (vehicle === null || customerId === null || paymentMethodId === null) {
    return null;
  }
  const { isElectric, hasAccessiblePermit, isOversize } = vehicle;
  return { vehicle: { id: vehicle.id, plate: vehicle.plate, needs: { isElectric, hasAccessiblePermit, isOversize } }, customerId, paymentMethodId, cardLast4: card?.last4 ?? null };
}
