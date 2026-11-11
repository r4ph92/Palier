import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { parkingSession } from './entrySchema.ts';
import { gate } from './gateSchema.ts';

// The last time the session's app reported the exit beacon: one row per session, a repeated report only refreshes it (decision 029).
export const exitBeaconReport = pgTable('exit_beacon_report', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => parkingSession.id),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
});

// The last time the console saw a vehicle on the exit gate's arming loop: one row per gate, spent by the exit it served.
export const exitVehiclePresence = pgTable('exit_vehicle_presence', {
  gateId: uuid('gate_id')
    .primaryKey()
    .references(() => gate.id),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull(),
});
