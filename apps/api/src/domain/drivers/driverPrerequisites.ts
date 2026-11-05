import type { VehicleNeeds, VehicleRepository } from '../vehicles/VehicleRepository.ts';
import type { DriverRepository } from './DriverRepository.ts';

export interface DriverPrerequisiteSources {
  readonly vehicles: Pick<VehicleRepository, 'findDefaultVehicle'>;
  readonly drivers: Pick<DriverRepository, 'findStripeCustomerId' | 'findDefaultPaymentMethodId'>;
}

export interface DriverPrerequisites {
  readonly vehicle: { readonly id: string; readonly plate: string; readonly needs: VehicleNeeds };
  readonly customerId: string;
  readonly paymentMethodId: string;
}

// Null without a default plate or a saved card; each caller refuses with its own error.
export async function findDriverPrerequisites({ vehicles, drivers }: DriverPrerequisiteSources, driverId: string): Promise<DriverPrerequisites | null> {
  const [vehicle, customerId, paymentMethodId] = await Promise.all([
    vehicles.findDefaultVehicle(driverId),
    drivers.findStripeCustomerId(driverId),
    drivers.findDefaultPaymentMethodId(driverId),
  ]);
  if (vehicle === null || customerId === null || paymentMethodId === null) {
    return null;
  }
  const { isElectric, hasAccessiblePermit, isOversize } = vehicle;
  return { vehicle: { id: vehicle.id, plate: vehicle.plate, needs: { isElectric, hasAccessiblePermit, isOversize } }, customerId, paymentMethodId };
}
