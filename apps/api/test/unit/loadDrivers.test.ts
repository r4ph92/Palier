import { describe, expect, it } from 'vitest';
import { DASHBOARD_TEST_USER_IDS, DRIVER_PERSONA_IDS } from '../../src/config/testPersonas.ts';
import { chooseSpotFor } from '../../src/domain/allocation/chooseSpotFor.ts';
import { LOAD_DRIVER_IDS, LOAD_VEHICLE_NEEDS, loadDriverPersonas, loadDriverVehicles } from '../../src/seed/fixtures/loadDrivers.ts';
import { parkingDemoSpots } from '../../src/seed/fixtures/parkingDemo.ts';
import { seededDriverPersonas, seededVehicles } from '../../src/seed/fixtures/seededDrivers.ts';

describe('seeded load-test drivers', () => {
  it('seeds Conducteur Test 01 to 20 with ids 0521 to 0540, each having consented', () => {
    expect(loadDriverPersonas.map(({ user }) => `${user.firstName} ${user.lastName}`)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Conducteur Test ${String(index + 1).padStart(2, '0')}`),
    );
    expect(LOAD_DRIVER_IDS[0]).toBe('00000000-0000-4000-8000-000000000521');
    expect(LOAD_DRIVER_IDS[19]).toBe('00000000-0000-4000-8000-000000000540');
    expect(loadDriverPersonas.every(({ acceptedNotice }) => acceptedNotice)).toBe(true);
  });

  it('keeps them off the app and dashboard test sign-in lists', () => {
    expect(LOAD_DRIVER_IDS.some((id) => DRIVER_PERSONA_IDS.includes(id) || DASHBOARD_TEST_USER_IDS.includes(id))).toBe(false);
  });

  it('gives each a simulated customer and card, so they can enter without a Stripe key', () => {
    expect(loadDriverPersonas[0]?.user).toMatchObject({
      email: 'conducteur.test01@palier.test',
      stripeCustomerId: 'cus_sim_01',
      defaultPmId: 'pm_sim_01',
      cardBrand: 'visa',
      cardLast4: '4242',
    });
  });

  it('gives each one default vehicle with its own plate', () => {
    expect(loadDriverVehicles.map(({ userId }) => userId)).toEqual(LOAD_DRIVER_IDS);
    expect(new Set(loadDriverVehicles.map(({ plateKey }) => plateKey)).size).toBe(20);
    expect(loadDriverVehicles[0]).toMatchObject({ plate: 'TEST 001', isDefault: true, province: 'QC' });
  });

  it('gives them a vehicle that fits every Parking Démo spot, so all ten count toward a load run', () => {
    const demoSpots = parkingDemoSpots.map((spot, index) => ({
      id: `spot-${index}`,
      number: spot.number,
      levelOrder: 1,
      aisleId: `aisle-${spot.number.slice(0, 1)}`,
      aisleCode: spot.number.slice(0, 1),
      distanceToExit: spot.distanceToExit,
      needsCheck: false,
      isEv: spot.isEv ?? false,
      isAccessible: spot.isAccessible ?? false,
      isOversize: spot.isOversize ?? false,
    }));

    for (const spot of demoSpots) {
      expect(chooseSpotFor(LOAD_VEHICLE_NEEDS, [spot])).toBe(spot);
    }
  });

  it('never shares an id or an email between a named persona and a load-test driver', () => {
    const users = seededDriverPersonas.map(({ user }) => user);

    expect(new Set(users.map(({ id }) => id)).size).toBe(users.length);
    expect(new Set(users.map(({ email }) => email)).size).toBe(users.length);
    expect(seededVehicles).toHaveLength(24);
  });
});
