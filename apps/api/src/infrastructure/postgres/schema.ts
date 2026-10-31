import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const kycStatus = pgEnum('kyc_status', ['NOT_STARTED', 'PENDING', 'VERIFIED']);
export const assignmentStrategy = pgEnum('assignment_strategy', ['AISLE_BY_AISLE']);
export const occupancySource = pgEnum('occupancy_source', ['DECLARATIVE', 'SENSORS']);
export const spotState = pgEnum('spot_state', [
  'AVAILABLE',
  'HELD',
  'ASSIGNED',
  'OCCUPIED',
  'OCCUPIED_UNKNOWN',
  'OUT_OF_SERVICE',
]);
export const sensorState = pgEnum('sensor_state', ['FREE', 'OCCUPIED']);

export const operator = pgTable('operator', {
  id: uuid('id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  stripeAccountId: text('stripe_account_id'),
  kycStatus: kycStatus('kyc_status').notNull().default('NOT_STARTED'),
});

export const parkingLot = pgTable(
  'parking_lot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operator.id),
    name: text('name').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    beaconMajor: integer('beacon_major').unique(),
    pricingPolicy: jsonb('pricing_policy'),
    dailyCapCents: integer('daily_cap_cents').notNull(),
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
    index('spot_aisle_id_lot_id_index').on(table.aisleId, table.lotId),
    index('spot_available_by_aisle_index')
      .on(table.aisleId, table.state)
      .where(sql`${table.state} = 'AVAILABLE'`),
  ],
);

export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  defaultPmId: text('default_pm_id'),
  cardBrand: text('card_brand'),
  cardLast4: text('card_last4'),
});

export const userSessionToken = pgTable(
  'user_session_token',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('user_session_token_user_id_index').on(table.userId)],
);

export const userConsent = pgTable(
  'user_consent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    noticeVersion: text('notice_version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('user_consent_user_id_notice_version_unique').on(table.userId, table.noticeVersion)],
);

export const vehicle = pgTable(
  'vehicle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    plate: text('plate').notNull(),
    plateKey: text('plate_key').notNull(),
    province: text('province').notNull(),
  },
  (table) => [unique('vehicle_user_id_plate_key_province_unique').on(table.userId, table.plateKey, table.province)],
);

export type SpotState = (typeof spotState.enumValues)[number];
