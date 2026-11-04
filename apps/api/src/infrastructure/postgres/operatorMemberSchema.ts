import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './driverSchema.ts';
import { operator } from './lotSchema.ts';

// A user belongs to at most one operator; the unique user_id is what refuses a second operator for the same person.
export const operatorMember = pgTable(
  'operator_member',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => appUser.id),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operator.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('operator_member_operator_id_index').on(table.operatorId)],
);
