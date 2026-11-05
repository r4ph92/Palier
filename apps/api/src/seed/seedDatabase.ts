import { eq, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../infrastructure/postgres/database.ts';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import {
  aisle,
  appUser,
  gate,
  gateDeviceKey,
  level,
  operator,
  operatorMember,
  parkingLot,
  spot,
  userConsent,
  vehicle,
} from '../infrastructure/postgres/schema.ts';
import { garageRoyLot } from './fixtures/garageRoy.ts';
import { gateDeviceKeyFixtures, gateFixtures } from './fixtures/gates.ts';
import { operatorMemberFixtures, operatorUserFixtures } from './fixtures/operatorUsers.ts';
import { LAVOIE_OPERATOR_ID, operatorFixtures } from './fixtures/operators.ts';
import { parkingDemoAisles, parkingDemoLevels, parkingDemoLot, parkingDemoSpots } from './fixtures/parkingDemo.ts';
import {
  parkingTestPaliersAisles,
  parkingTestPaliersLevels,
  parkingTestPaliersLot,
  parkingTestPaliersSpots,
} from './fixtures/parkingTestPaliers.ts';
import { seededDriverPersonas, seededVehicles } from './fixtures/seededDrivers.ts';
import type { StripeIds } from './stripeTestCustomers.ts';

export interface SeedStripeIds {
  readonly drivers?: ReadonlyMap<string, StripeIds> | undefined;
  // The connected test account entry holds go to; without one, holds stay on the platform in demo mode.
  readonly demoOperatorAccountId?: string | null;
}

export async function seedDatabase(database: Database, stripeIds: SeedStripeIds = {}): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.execute(
      sql`truncate table gate_command, parking_session, gate_passage, gate_device_key, gate, vehicle, user_consent, user_session_token, operator_member, app_user, spot, aisle, level, parking_lot, operator cascade`,
    );
    await insertLots(transaction, stripeIds.demoOperatorAccountId ?? null);
    await insertDrivers(transaction, stripeIds.drivers ?? new Map());
    await insertOperatorUsers(transaction);
  });
}

async function insertLots(transaction: Transaction, demoOperatorAccountId: string | null): Promise<void> {
  await transaction.insert(operator).values(operatorFixtures);
  if (demoOperatorAccountId !== null) {
    await transaction.update(operator).set({ stripeAccountId: demoOperatorAccountId }).where(eq(operator.id, LAVOIE_OPERATOR_ID));
  }
  await transaction.insert(parkingLot).values([parkingDemoLot, garageRoyLot, parkingTestPaliersLot]);
  await transaction.insert(level).values([...parkingDemoLevels, ...parkingTestPaliersLevels]);
  await transaction.insert(aisle).values([...parkingDemoAisles, ...parkingTestPaliersAisles]);
  await transaction.insert(spot).values([...parkingDemoSpots, ...parkingTestPaliersSpots]);
  await transaction.insert(gate).values(gateFixtures);
  await transaction.insert(gateDeviceKey).values(gateDeviceKeyFixtures);
}

async function insertDrivers(transaction: Transaction, stripeIds: ReadonlyMap<string, StripeIds>): Promise<void> {
  await transaction.insert(appUser).values(seededDriverPersonas.map(({ user }) => ({ ...user, ...stripeIds.get(user.email) })));
  await transaction.insert(vehicle).values([...seededVehicles]);
  // The consent date comes from the notice version in force, so a version bump does not leave the seed behind.
  const consents = seededDriverPersonas.flatMap(({ user, acceptedNotice }) =>
    acceptedNotice && user.id !== undefined ? [{ userId: user.id, noticeVersion: PRIVACY_NOTICE_VERSION }] : [],
  );
  await transaction.insert(userConsent).values(consents);
}

async function insertOperatorUsers(transaction: Transaction): Promise<void> {
  await transaction.insert(appUser).values(operatorUserFixtures);
  await transaction.insert(operatorMember).values(operatorMemberFixtures);
}
