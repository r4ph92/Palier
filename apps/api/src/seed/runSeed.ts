import Stripe from 'stripe';
import { readDemoOperatorStripeAccountId } from '../config/environment.ts';
import { connectToDatabase } from '../infrastructure/postgres/database.ts';
import { driverPersonas } from './fixtures/drivers.ts';
import { seededQrLinks } from './fixtures/gates.ts';
import { databaseUrlAllowedForSeeding } from './seedGuard.ts';
import { seedDatabase } from './seedDatabase.ts';
import { stripeTestKey } from '../config/stripeTestKey.ts';
import { createStripeTestCustomers } from './stripeTestCustomers.ts';

const connection = connectToDatabase(databaseUrlAllowedForSeeding(process.env));
const stripeKey = stripeTestKey(process.env);
const demoOperatorAccountId = readDemoOperatorStripeAccountId(process.env);
try {
  if (stripeKey === null) {
    console.warn('STRIPE_SECRET_KEY is not set: driver personas are seeded without Stripe customers or cards.');
  }
  if (demoOperatorAccountId === null) {
    console.warn('DEMO_OPERATOR_STRIPE_ACCOUNT_ID is not set: entry holds stay on the platform account (demo mode only).');
  }
  const drivers = stripeKey === null ? undefined : await createStripeTestCustomers(new Stripe(stripeKey), driverPersonas);
  await seedDatabase(connection.database, { drivers, demoOperatorAccountId });
  console.log('Seeded Parking Démo, Garage Roy, Parking Test Paliers, their gates, the driver personas and the operator users.');
  console.log('Entry terminal QRs, to paste into the app’s Scanner tab:');
  for (const { gateName, link } of seededQrLinks()) {
    console.log(`  ${gateName}: ${link}`);
  }
} finally {
  await connection.close();
}
