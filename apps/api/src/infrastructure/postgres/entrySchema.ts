import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  type AnyPgColumn,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import { appUser, vehicle } from './driverSchema.ts';
import { gate } from './gateSchema.ts';
import { aisle, parkingLot, spot } from './lotSchema.ts';
import { spotHold } from './spotHoldSchema.ts';

interface SameLotTarget {
  readonly id: AnyPgColumn;
  readonly lotId: AnyPgColumn;
}

// The referenced row must belong to the session's own lot, which a plain foreign key on the id alone would not check.
function sameLotForeignKey(name: string, columns: [AnyPgColumn, AnyPgColumn], target: SameLotTarget) {
  return foreignKey({ name, columns, foreignColumns: [target.id, target.lotId] });
}

export const parkingSessionState = pgEnum('parking_session_state', ENTRY_SESSION_STATES);
// How the vehicle was identified at the exit; the tap in the app is the only way built so far (docs/03, sequence C).
export const exitIdentification = pgEnum('exit_identification', ['APP']);
export const gateCommandKind = pgEnum('gate_command_kind', ['OPEN']);

interface StateColumns {
  readonly state: AnyPgColumn;
  readonly parkedAisleId: AnyPgColumn;
  readonly confirmedSpotId: AnyPgColumn;
  readonly parkedAnsweredAt: AnyPgColumn;
  readonly exitAt: AnyPgColumn;
  readonly exitIdentification: AnyPgColumn;
  readonly capturedCents: AnyPgColumn;
  readonly pendingCaptureCents: AnyPgColumn;
}

// Compared as text: a check on the enum itself would block the next migration that recreates the enum.
function stateChecks(table: StateColumns) {
  return [
    check('parking_session_unconfirmed_has_aisle', sql`${table.state}::text <> 'PARKED_UNCONFIRMED' or ${table.parkedAisleId} is not null`),
    check(
      'parking_session_confirmed_has_spot',
      sql`${table.state}::text <> 'PARKED_CONFIRMED' or (${table.confirmedSpotId} is not null and ${table.parkedAnsweredAt} is not null)`,
    ),
    // A paid session always says when, how and how much.
    check(
      'parking_session_paid_has_exit',
      sql`${table.state}::text <> 'CLOSED_PAID' or (${table.exitAt} is not null and ${table.exitIdentification} is not null and ${table.capturedCents} is not null)`,
    ),
    // A session left with its capture pending says when, how, and the amount the retry takes (decision 026).
    check(
      'parking_session_pending_has_exit',
      sql`${table.state}::text <> 'CLOSED_CAPTURE_PENDING' or (${table.exitAt} is not null and ${table.exitIdentification} is not null and ${table.pendingCaptureCents} is not null)`,
    ),
  ];
}

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
    // The hold this entry used, put back by the cancellation when the driver never drove through (decision 016).
    consumedSpotHoldId: uuid('consumed_spot_hold_id').references(() => spotHold.id),
    paymentIntentId: text('payment_intent_id'),
    authorizedCents: integer('authorized_cents').notNull(),
    // The last four digits of the card held at entry, for the receipt; null for a session opened before decision 025.
    cardLast4: text('card_last4'),
    // The lot's pricing at entry (D1): a later change to the lot never reprices a session already inside.
    pricingIncrementCents: integer('pricing_increment_cents').notNull(),
    pricingIncrementMinutes: integer('pricing_increment_minutes').notNull(),
    pricingDailyCapCents: integer('pricing_daily_cap_cents').notNull(),
    entryScanAt: timestamp('entry_scan_at', { withTimezone: true }).notNull().defaultNow(),
    entryConfirmedAt: timestamp('entry_confirmed_at', { withTimezone: true }),
    parkedAt: timestamp('parked_at', { withTimezone: true }),
    // The aisle the device last saw at the walk, when it was not the assigned spot's: the driver is asked where they parked.
    parkedAisleId: uuid('parked_aisle_id'),
    // The spot the driver said they parked in; the assigned spot stays as the history of the entry.
    confirmedSpotId: uuid('confirmed_spot_id'),
    parkedAnsweredAt: timestamp('parked_answered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    // Set together when the exit captures the amount and closes the session as CLOSED_PAID (decision 023).
    exitAt: timestamp('exit_at', { withTimezone: true }),
    exitIdentification: exitIdentification('exit_identification'),
    capturedCents: integer('captured_cents'),
    // The amount fixed at the tap when Stripe could not be reached; the retry captures exactly this, under the same idempotency key (decision 026).
    pendingCaptureCents: integer('pending_capture_cents'),
    // The instant the exit loop closed after the exit opened (decision 024); null while it has not, and for good when it closes too late.
    exitPassageAt: timestamp('exit_passage_at', { withTimezone: true }),
    // Set with the cancellation when a card hold exists; cleared once Stripe confirms the release, so a failed release is retried.
    holdReleasePending: boolean('hold_release_pending').notNull().default(false),
    holdReleaseAttemptedAt: timestamp('hold_release_attempted_at', { withTimezone: true }),
  },
  (table) => [
    unique('parking_session_id_lot_id_unique').on(table.id, table.lotId),
    sameLotForeignKey('parking_session_entry_gate_in_same_lot_fk', [table.entryGateId, table.lotId], gate),
    sameLotForeignKey('parking_session_spot_in_same_lot_fk', [table.assignedSpotId, table.lotId], spot),
    sameLotForeignKey('parking_session_confirmed_spot_in_same_lot_fk', [table.confirmedSpotId, table.lotId], spot),
    sameLotForeignKey('parking_session_parked_aisle_in_same_lot_fk', [table.parkedAisleId, table.lotId], aisle),
    ...stateChecks(table),
    check(
      'parking_session_pricing_positive',
      sql`${table.pricingIncrementCents} > 0 and ${table.pricingIncrementMinutes} > 0 and ${table.pricingDailyCapCents} > 0`,
    ),
    uniqueIndex('parking_session_one_active_per_user_index').on(table.userId).where(ACTIVE_SESSION),
    uniqueIndex('parking_session_one_active_per_spot_index').on(table.assignedSpotId).where(ACTIVE_SESSION),
    uniqueIndex('parking_session_one_active_per_confirmed_spot_index').on(table.confirmedSpotId).where(ACTIVE_SESSION),
    index('parking_session_hold_release_pending_index').on(table.holdReleaseAttemptedAt.asc().nullsFirst(), table.id).where(sql`${table.holdReleasePending}`),
  ],
);

// Every spot the driver reported taken before parking, kept flagged to check; the exit releases them (decision 022).
export const parkingSessionReportedSpot = pgTable(
  'parking_session_reported_spot',
  {
    sessionId: uuid('session_id').notNull(),
    spotId: uuid('spot_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'parking_session_reported_spot_pk', columns: [table.sessionId, table.spotId] }),
    sameLotForeignKey('parking_session_reported_spot_session_in_same_lot_fk', [table.sessionId, table.lotId], parkingSession),
    sameLotForeignKey('parking_session_reported_spot_spot_in_same_lot_fk', [table.spotId, table.lotId], spot),
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
