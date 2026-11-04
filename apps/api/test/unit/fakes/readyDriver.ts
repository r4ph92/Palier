import { acceptNoticeAs, authorizationFor, type FakeDriverRepository, julie } from '../fakeDriverRepository.ts';
import type { FakeVehicleRepository } from '../fakeVehicleRepository.ts';

// A consented driver with a default plate and a saved card, ready to scan an entry QR.
export async function readyDriver(drivers: FakeDriverRepository, vehicles: FakeVehicleRepository, driver = julie) {
  await acceptNoticeAs(drivers, driver);
  await vehicles.saveVehicle(driver.id, { plate: 'ABC 123', plateKey: 'ABC123', province: 'QC' });
  await drivers.saveStripeCustomerIdIfMissing(driver.id, `cus_${driver.firstName}`);
  await drivers.saveSavedCard(driver.id, `pm_${driver.firstName}`, { brand: 'visa', last4: '4242' });
  return authorizationFor(drivers, driver);
}
