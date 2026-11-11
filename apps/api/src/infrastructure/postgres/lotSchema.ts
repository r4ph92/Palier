import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgEnum, pgSequence, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { HOLD_QUOTA_LIMITS } from '@palier/shared-types/lotPricing';
import { DEFAULT_SPOT_HOLD_QUOTA } from '../../domain/spotHolds/spotHoldRules.ts';
import { SPOT_STATES } from '../../domain/spots/spotStates.ts';
import { canonicalNumberOf } from './canonicalNumberSql.ts';

export const kycStatus = pgEnum('kyc_status', ['NOT_STARTED', 'PENDING', 'ACTION_REQUIRED', 'VERIFIED']);
export const assignmentStrategy = pgEnum('assignment_strategy', ['AISLE_BY_AISLE']);
export const occupancySource = pgEnum('occupancy_source', ['DECLARATIVE', 'SENSORS']);
export const spotState = pgEnum('spot_state', SPOT_STATES);
export const sensorState = pgEnum('sensor_state', ['FREE', 'OCCUPIED']);

export const operator = pgTable('operator', {
  id: uuid('id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  stripeAccountId: text('stripe_account_id'),
  kycStatus: kycStatus('kyc_status').notNull().default('NOT_STARTED'),
});

// A BLE major is 16 bits. The seeds hold 1 to 3, so the platform hands out majors from 4.
export const beaconMajorSequence = pgSequence('parking_lot_beacon_major_seq', { startWith: 4, minValue: 1, maxValue: 65535 });

export const parkingLot = pgTable(
  'parking_lot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operator.id),
    name: text('name').notNull(),
    address: text('address').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    beaconMajor: integer('beacon_major')
      .unique()
      .default(sql`nextval('parking_lot_beacon_major_seq')`),
    pricingPolicy: jsonb('pricing_policy'),
    // Null with the policy: a lot without pricing stays offline (decision 031).
    dailyCapCents: integer('daily_cap_cents'),
    holdQuota: integer('hold_quota').notNull().default(DEFAULT_SPOT_HOLD_QUOTA),
    assignmentStrategy: assignmentStrategy('assignment_strategy').notNull().default('AISLE_BY_AISLE'),
    occupancySource: occupancySource('occupancy_source').notNull().default('DECLARATIVE'),
    capacity: integer('capacity').notNull(),
    vehicleCount: integer('vehicle_count').notNull().default(0),
    isOnline: boolean('is_online').notNull().default(false),
    wifiVerifiedAt: timestamp('wifi_verified_at', { withTimezone: true }),
    cellVerifiedAt: timestamp('cell_verified_at', { withTimezone: true }),
  },
  (table) => [
    index('parking_lot_operator_id_index').on(table.operatorId),
    check('parking_lot_capacity_not_negative', sql`${table.capacity} >= 0`),
    check('parking_lot_vehicle_count_not_negative', sql`${table.vehicleCount} >= 0`),
    check('parking_lot_pricing_complete', sql`(${table.pricingPolicy} is null) = (${table.dailyCapCents} is null)`),
    check('parking_lot_daily_cap_positive', sql`${table.dailyCapCents} > 0`),
    check('parking_lot_online_has_pricing', sql`(not ${table.isOnline}) or ${table.pricingPolicy} is not null`),
    check('parking_lot_hold_quota_range', sql`${table.holdQuota} between ${sql.raw(String(HOLD_QUOTA_LIMITS.minimum))} and ${sql.raw(String(HOLD_QUOTA_LIMITS.maximum))}`),
  ],
);

export const level = pgTable(
  'level',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => parkingLot.id),
    code: text('code').notNull(),
    displayOrder: integer('display_order').notNull(),
  },
  (table) => [
    unique('level_lot_id_code_unique').on(table.lotId, table.code),
    unique('level_id_lot_id_unique').on(table.id, table.lotId),
  ],
);

export const aisle = pgTable(
  'aisle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    levelId: uuid('level_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    code: text('code').notNull(),
    beaconMinor: integer('beacon_minor').notNull(),
    mapPolygon: jsonb('map_polygon'),
    isExitLane: boolean('is_exit_lane').notNull().default(false),
  },
  (table) => [
    foreignKey({
      name: 'aisle_level_in_same_lot_fk',
      columns: [table.levelId, table.lotId],
      foreignColumns: [level.id, level.lotId],
    }),
    unique('aisle_level_id_code_unique').on(table.levelId, table.code),
    unique('aisle_id_lot_id_unique').on(table.id, table.lotId),
    unique('aisle_lot_id_beacon_minor_unique').on(table.lotId, table.beaconMinor),
    index('aisle_level_id_lot_id_index').on(table.levelId, table.lotId),
  ],
);

export const spot = pgTable(
  'spot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aisleId: uuid('aisle_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    number: text('number').notNull(),
    state: spotState('state').notNull().default('AVAILABLE'),
    stateChangedAt: timestamp('state_changed_at', { withTimezone: true }).notNull().defaultNow(),
    isEv: boolean('is_ev').notNull().default(false),
    isAccessible: boolean('is_accessible').notNull().default(false),
    isOversize: boolean('is_oversize').notNull().default(false),
    distanceToExit: integer('distance_to_exit').notNull(),
    needsCheck: boolean('needs_check').notNull().default(false),
    sensorState: sensorState('sensor_state'),
    sensorAt: timestamp('sensor_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'spot_aisle_in_same_lot_fk',
      columns: [table.aisleId, table.lotId],
      foreignColumns: [aisle.id, aisle.lotId],
    }),
    unique('spot_lot_id_number_unique').on(table.lotId, table.number),
    index('spot_lot_id_canonical_number_index').on(table.lotId, canonicalNumberOf(table.number)),
    unique('spot_id_lot_id_unique').on(table.id, table.lotId),
    index('spot_aisle_id_lot_id_index').on(table.aisleId, table.lotId),
    index('spot_available_by_aisle_index')
      .on(table.aisleId, table.state)
      .where(sql`${table.state} = 'AVAILABLE'`),
    index('spot_held_by_lot_index')
      .on(table.lotId)
      .where(sql`${table.state} = 'HELD'`),
  ],
);

export type { SpotState } from '../../domain/spots/spotStates.ts';
