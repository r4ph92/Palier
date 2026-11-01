import Stripe from 'stripe';
import { connectToDatabase } from '../infrastructure/postgres/database.ts';
import { driverPersonas } from './fixtures/drivers.ts';
import { databaseUrlAllowedForSeeding } from './seedGuard.ts';
import { seedDatabase } from './seedDatabase.ts';
import { stripeTestKey } from '../config/stripeTestKey.ts';
import { createStripeTestCustomers } from './stripeTestCustomers.ts';

const connection = connectToDatabase(databaseUrlAllowedForSeeding(process.env));
const stripeKey = stripeTestKey(process.env);
try {
  if (stripeKey === null) {
    console.warn('STRIPE_SECRET_KEY is not set: driver personas are seeded without Stripe customers or cards.');
  }
  const stripeIds = stripeKey === null ? undefined : await createStripeTestCustomers(new Stripe(stripeKey), driverPersonas);
  await seedDatabase(connection.database, stripeIds);
  console.log('Seeded Parking Démo, Garage Roy and the driver personas.');
} finally {
  await connection.close();
}
