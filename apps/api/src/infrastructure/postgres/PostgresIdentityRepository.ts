import { sql } from 'drizzle-orm';
import type { IdentityRepository, PersonName, VerifiedIdentity } from '../../domain/identity/Identity.ts';
import type { Database, Transaction } from './database.ts';

interface UserIdRow extends Record<string, unknown> {
  readonly user_id: string;
}

export class PostgresIdentityRepository implements IdentityRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // Two first sign-ins at once both end on one account: the email and the identity are unique, and each insert yields to the other.
  findOrCreateAccount(identity: VerifiedIdentity, name: PersonName): Promise<string> {
    return this.#database.transaction(async (tx) => {
      const known = await findIdentityUser(tx, identity);
      if (known !== null) {
        return known;
      }
      const userId = await findOrInsertUser(tx, identity.email, name);
      await tx.execute(sql`
        insert into user_identity (provider, subject, user_id) values (${identity.provider}, ${identity.subject}, ${userId})
        on conflict (provider, subject) do nothing`);
      return (await findIdentityUser(tx, identity)) ?? userId;
    });
  }
}

async function findIdentityUser(tx: Transaction, { provider, subject }: VerifiedIdentity): Promise<string | null> {
  const rows = await tx.execute<UserIdRow>(sql`select user_id from user_identity where provider = ${provider} and subject = ${subject}`);
  return rows[0]?.user_id ?? null;
}

// An account with this email already exists when the person first came with the other provider: the identity joins it.
async function findOrInsertUser(tx: Transaction, email: string, { firstName, lastName }: PersonName): Promise<string> {
  const inserted = await tx.execute<UserIdRow>(sql`
    insert into app_user (email, first_name, last_name) values (${email}, ${firstName}, ${lastName})
    on conflict (email) do nothing returning id as user_id`);
  if (inserted[0] !== undefined) {
    return inserted[0].user_id;
  }
  const existing = await tx.execute<UserIdRow>(sql`select id as user_id from app_user where email = ${email}`);
  const found = existing[0];
  if (found === undefined) {
    throw new Error('The account with this email vanished during sign-in.');
  }
  return found.user_id;
}
