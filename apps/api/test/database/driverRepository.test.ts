import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase } from '../../src/infrastructure/postgres/database.ts';
import { PostgresDriverRepository } from '../../src/infrastructure/postgres/PostgresDriverRepository.ts';
import { runMigrations } from '../../src/migrate/runMigrations.ts';
import { JULIE_TREMBLAY_ID, MARC_GAGNON_ID, NADIA_BOUCHARD_ID } from '../../src/seed/fixtures/drivers.ts';
import { seedDatabase } from '../../src/seed/seedDatabase.ts';
import { databaseUrlAllowedForSeeding } from '../../src/seed/seedGuard.ts';

const databaseUrl = databaseUrlAllowedForSeeding(process.env);
const connection = connectToDatabase(databaseUrl);
const repository = new PostgresDriverRepository(connection.database);
const julie = { id: JULIE_TREMBLAY_ID, firstName: 'Julie', lastName: 'Tremblay' };

beforeAll(() => runMigrations(databaseUrl));
beforeEach(() => seedDatabase(connection.database));
afterAll(() => connection.close());

describe('PostgresDriverRepository on the seeded database', () => {
  it('lists the seeded driver personas by first name', async () => {
    const drivers = await repository.listDrivers();

    expect(drivers.map((driver) => `${driver.firstName} ${driver.lastName}`)).toEqual([
      'Julie Tremblay',
      'Marc Gagnon',
      'Nadia Bouchard',
    ]);
  });

  it('finds Julie by her id, and nobody for an unknown id', async () => {
    expect(await repository.findDriver(JULIE_TREMBLAY_ID)).toEqual(julie);
    expect(await repository.findDriver('00000000-0000-4000-8000-000000000599')).toBeNull();
  });

  it('finds Julie by a saved token hash until it is revoked', async () => {
    await repository.saveSessionToken(JULIE_TREMBLAY_ID, 'hash-1');
    expect(await repository.findDriverBySessionToken('hash-1')).toEqual(julie);

    await repository.revokeSessionToken('hash-1');

    expect(await repository.findDriverBySessionToken('hash-1')).toBeNull();
  });

  it('keeps her other sessions when one token is revoked', async () => {
    await repository.saveSessionToken(JULIE_TREMBLAY_ID, 'phone');
    await repository.saveSessionToken(JULIE_TREMBLAY_ID, 'tablet');

    await repository.revokeSessionToken('phone');

    expect(await repository.findDriverBySessionToken('tablet')).toEqual(julie);
  });

  it('finds nobody for an unknown token hash', async () => {
    expect(await repository.findDriverBySessionToken('unknown')).toBeNull();
  });

  it('has no accepted notice until Julie accepts one', async () => {
    expect(await repository.findLatestNoticeVersion(JULIE_TREMBLAY_ID)).toBeNull();
  });

  it('reports an older notice version as the latest again when she accepts it after a newer one', async () => {
    await repository.saveNoticeAcceptance(JULIE_TREMBLAY_ID, '2026-01-01');
    await repository.saveNoticeAcceptance(JULIE_TREMBLAY_ID, '2026-10-28');
    await repository.saveNoticeAcceptance(JULIE_TREMBLAY_ID, '2026-01-01');

    expect(await repository.findLatestNoticeVersion(JULIE_TREMBLAY_ID)).toBe('2026-01-01');
  });

  it('reports the latest notice version she accepted, and accepting twice keeps one row', async () => {
    await repository.saveNoticeAcceptance(JULIE_TREMBLAY_ID, '2026-01-01');
    await repository.saveNoticeAcceptance(JULIE_TREMBLAY_ID, '2026-10-28');
    await repository.saveNoticeAcceptance(JULIE_TREMBLAY_ID, '2026-10-28');

    expect(await repository.findLatestNoticeVersion(JULIE_TREMBLAY_ID)).toBe('2026-10-28');
  });

  it('has no Stripe customer or saved card for a driver who never added one', async () => {
    expect(await repository.findStripeCustomerId(NADIA_BOUCHARD_ID)).toBeNull();
    expect(await repository.findSavedCard(NADIA_BOUCHARD_ID)).toBeNull();
  });

  it('keeps the Stripe customer id she was given', async () => {
    await repository.saveStripeCustomerId(JULIE_TREMBLAY_ID, 'cus_julie');

    expect(await repository.findStripeCustomerId(JULIE_TREMBLAY_ID)).toBe('cus_julie');
  });

  it('replaces her saved card with the new brand, last four digits and payment method', async () => {
    await repository.saveSavedCard(JULIE_TREMBLAY_ID, 'pm_visa', { brand: 'visa', last4: '4242' });
    await repository.saveSavedCard(JULIE_TREMBLAY_ID, 'pm_mastercard', { brand: 'mastercard', last4: '4444' });

    expect(await repository.findSavedCard(JULIE_TREMBLAY_ID)).toEqual({ brand: 'mastercard', last4: '4444' });
    expect(await repository.findSavedCard(MARC_GAGNON_ID)).toBeNull();
  });
});
