import { sql } from 'drizzle-orm';
import { foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { appUser, vehicle } from './driverSchema.ts';
import { gate } from './gateSchema.ts';
import { parkingLot, spot } from './lotSchema.ts';

export const parkingSessionState = pgEnum('parking_session_state', ['CREATED', 'CANCELLED']);
export const gateCommandKind = pgEnum('gate_command_kind', ['OPEN']);

// Later stories add states (entered, exited…); each active one joins these index predicates, see docs/decisions/007.
const ACTIVE_SESSION = sql`state in ('CREATED')`;

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
    entryScanAt: timestamp('entry_scan_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
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
    uniqueIndex('parking_session_one_active_per_user_index').on(table.userId).where(ACTIVE_SESSION),
    uniqueIndex('parking_session_one_active_per_spot_index').on(table.assignedSpotId).where(ACTIVE_SESSION),
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
  ],
);
