import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { SPOT_HOLD_STATUSES } from '@palier/shared-types/spotHolds';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import { appUser } from './driverSchema.ts';
import { parkingLot, spot } from './lotSchema.ts';

export const spotHoldStatus = pgEnum('spot_hold_status', SPOT_HOLD_STATUSES);

// Both instants come from the API's clock, never from now(), so the test clock moves a hold like the session it precedes.
export const spotHold = pgTable(
  'spot_hold',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => parkingLot.id),
    spotId: uuid('spot_id').notNull(),
    status: spotHoldStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: 'spot_hold_spot_in_same_lot_fk',
      columns: [table.spotId, table.lotId],
      foreignColumns: [spot.id, spot.lotId],
    }),
    check('spot_hold_expires_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
    uniqueIndex('spot_hold_one_active_per_user_index').on(table.userId).where(ACTIVE_SPOT_HOLD),
    uniqueIndex('spot_hold_one_active_per_spot_index').on(table.spotId).where(ACTIVE_SPOT_HOLD),
    index('spot_hold_active_by_lot_index').on(table.lotId).where(ACTIVE_SPOT_HOLD),
    index('spot_hold_spot_id_lot_id_index').on(table.spotId, table.lotId),
  ],
);
