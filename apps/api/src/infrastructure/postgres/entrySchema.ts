import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import { appUser, vehicle } from './driverSchema.ts';
import { gate } from './gateSchema.ts';
import { parkingLot, spot } from './lotSchema.ts';

export const parkingSessionState = pgEnum('parking_session_state', ENTRY_SESSION_STATES);
export const gateCommandKind = pgEnum('gate_command_kind', ['OPEN']);

export const parkingSession = pgTable(
  'parking_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    vehicleId: uuid('vehicle_id').references(() => vehicle.id, { onDelete: 'set null' }),
    plate: text('plate').notNull(),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => parkingLot.id),
    assignedSpotId: uuid('assigned_spot_id').notNull(),
    entryGateId: uuid('entry_gate_id').notNull(),
    state: parkingSessionState('state').notNull().default('CREATED'),
    paymentIntentId: text('payment_intent_id'),
    authorizedCents: integer('authorized_cents').notNull(),
    // The lot's pricing at entry (D1): a later change to the lot never reprices a session already inside.
    pricingIncrementCents: integer('pricing_increment_cents').notNull(),
    pricingIncrementMinutes: integer('pricing_increment_minutes').notNull(),
    pricingDailyCapCents: integer('pricing_daily_cap_cents').notNull(),
    entryScanAt: timestamp('entry_scan_at', { withTimezone: true }).notNull().defaultNow(),
    entryConfirmedAt: timestamp('entry_confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    // Set with the cancellation when a card hold exists; cleared once Stripe confirms the release, so a failed release is retried.
    holdReleasePending: boolean('hold_release_pending').notNull().default(false),
    holdReleaseAttemptedAt: timestamp('hold_release_attempted_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'parking_session_entry_gate_in_same_lot_fk',
      columns: [table.entryGateId, table.lotId],
      foreignColumns: [gate.id, gate.lotId],
    }),
    foreignKey({
      name: 'parking_session_spot_in_same_lot_fk',
      columns: [table.assignedSpotId, table.lotId],
      foreignColumns: [spot.id, spot.lotId],
    }),
    check(
      'parking_session_pricing_positive',
      sql`${table.pricingIncrementCents} > 0 and ${table.pricingIncrementMinutes} > 0 and ${table.pricingDailyCapCents} > 0`,
    ),
    uniqueIndex('parking_session_one_active_per_user_index').on(table.userId).where(ACTIVE_SESSION),
    uniqueIndex('parking_session_one_active_per_spot_index').on(table.assignedSpotId).where(ACTIVE_SESSION),
    index('parking_session_hold_release_pending_index').on(table.holdReleaseAttemptedAt.asc().nullsFirst(), table.id).where(sql`${table.holdReleasePending}`),
  ],
);

export const gateCommand = pgTable(
  'gate_command',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gateId: uuid('gate_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    kind: gateCommandKind('kind').notNull(),
    sessionId: uuid('session_id').references(() => parkingSession.id),
    issuedAt: timestamp('issued_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'gate_command_gate_in_same_lot_fk',
      columns: [table.gateId, table.lotId],
      foreignColumns: [gate.id, gate.lotId],
    }),
    index('gate_command_gate_id_issued_at_index').on(table.gateId, table.issuedAt, table.id),
    index('gate_command_session_id_index').on(table.sessionId),
  ],
);
