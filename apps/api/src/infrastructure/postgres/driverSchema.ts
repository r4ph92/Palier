import { sql } from 'drizzle-orm';
import { boolean, index, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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

// APP tokens open the driver API, DASHBOARD tokens the operator dashboard; neither opens the other.
export const sessionScope = pgEnum('session_scope', ['APP', 'DASHBOARD']);

export const userSessionToken = pgTable(
  'user_session_token',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    scope: sessionScope('scope').notNull().default('APP'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`now() + interval '30 days'`),
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
    isDefault: boolean('is_default').notNull().default(false),
  },
  (table) => [
    unique('vehicle_user_id_plate_key_province_unique').on(table.userId, table.plateKey, table.province),
    uniqueIndex('vehicle_one_default_per_user_index')
      .on(table.userId)
      .where(sql`${table.isDefault}`),
  ],
);
