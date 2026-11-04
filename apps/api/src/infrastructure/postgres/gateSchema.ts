import { boolean, foreignKey, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { parkingLot } from './lotSchema.ts';

export const gateKind = pgEnum('gate_kind', ['ENTRY', 'EXIT']);
export const gateIntegrationKind = pgEnum('gate_integration_kind', ['DRY_CONTACT', 'ACCESS_CONTROL_API', 'SIMULATED']);
export const exitIdKind = pgEnum('exit_id_kind', ['ANPR', 'RFID', 'NONE']);

export const gate = pgTable(
  'gate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => parkingLot.id),
    name: text('name').notNull(),
    kind: gateKind('kind').notNull(),
    integrationKind: gateIntegrationKind('integration_kind').notNull(),
    endpoint: text('endpoint'),
    hasLoops: boolean('has_loops').notNull().default(false),
    exitIdKind: exitIdKind('exit_id_kind').notNull().default('NONE'),
    qrSecret: text('qr_secret'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    unique('gate_lot_id_name_unique').on(table.lotId, table.name),
    unique('gate_id_lot_id_unique').on(table.id, table.lotId),
  ],
);

export const gateDeviceKey = pgTable(
  'gate_device_key',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gateId: uuid('gate_id')
      .notNull()
      .references(() => gate.id),
    keyHash: text('key_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('gate_device_key_gate_id_index').on(table.gateId)],
);

export const gatePassage = pgTable(
  'gate_passage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gateId: uuid('gate_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'gate_passage_gate_in_same_lot_fk',
      columns: [table.gateId, table.lotId],
      foreignColumns: [gate.id, gate.lotId],
    }),
    index('gate_passage_gate_id_recorded_at_index').on(table.gateId, table.recordedAt),
  ],
);
