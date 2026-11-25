import { describe, expect, it } from 'vitest';
import type { VerifiedIdentity } from '../../src/domain/identity/Identity.ts';
import { PostgresIdentityRepository } from '../../src/infrastructure/postgres/PostgresIdentityRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const identity: VerifiedIdentity = { provider: 'APPLE', subject: 'apple-nadia', email: 'nadia@privaterelay.appleid.com', emailVouched: true, firstName: null, lastName: null };
const noName = { firstName: '', lastName: '' };
const NADIA_ID = '00000000-0000-4000-8000-000000000505';
const JULIE_ID = '00000000-0000-4000-8000-000000000501';

function repositoryOver(scripted: ScriptedSql): PostgresIdentityRepository {
  return new PostgresIdentityRepository(scripted.database());
}

describe('PostgresIdentityRepository.findOrCreateAccount', () => {
  it('opens the account the identity already belongs to and writes nothing', async () => {
    const scripted = new ScriptedSql().answer('find-identity-user', [{ user_id: JULIE_ID }]);

    const userId = await repositoryOver(scripted).findOrCreateAccount(identity, noName);

    expect(userId).toBe(JULIE_ID);
    expect(scripted.labels()).toEqual(['find-identity-user']);
    expect(scripted.statement('find-identity-user')?.params).toEqual(['APPLE', 'apple-nadia']);
  });

  it('creates the account and its identity in one transaction for a new person', async () => {
    const scripted = new ScriptedSql()
      .answer('find-identity-user', [], [{ user_id: NADIA_ID }])
      .answer('insert-app-user', [{ user_id: NADIA_ID }]);

    const userId = await repositoryOver(scripted).findOrCreateAccount(identity, { firstName: 'Nadia', lastName: 'Bouchard' });

    expect(userId).toBe(NADIA_ID);
    expect(scripted.labels()).toEqual(['find-identity-user', 'insert-app-user', 'insert-user-identity', 'find-identity-user']);
    expect(scripted.statement('insert-app-user')?.params).toEqual(['nadia@privaterelay.appleid.com', 'Nadia', 'Bouchard']);
    expect(scripted.statement('insert-user-identity')?.params).toEqual(['APPLE', 'apple-nadia', NADIA_ID]);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber)).size).toBe(1);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
  });

  it('joins the identity to the account that already has the email', async () => {
    const scripted = new ScriptedSql()
      .answer('find-identity-user', [], [{ user_id: JULIE_ID }])
      .answer('insert-app-user', [])
      .answer('find-user-by-email', [{ user_id: JULIE_ID, is_operator: false }]);

    const userId = await repositoryOver(scripted).findOrCreateAccount({ ...identity, provider: 'GOOGLE', email: 'julie.tremblay@palier.test' }, noName);

    expect(userId).toBe(JULIE_ID);
    expect(scripted.statement('find-user-by-email')?.params).toEqual(['julie.tremblay@palier.test']);
    expect(scripted.statement('insert-user-identity')?.params).toEqual(['GOOGLE', 'apple-nadia', JULIE_ID]);
  });

  it.each([
    ['an operator\'s account, which signs in to the dashboard only', { emailVouched: true }, true],
    ['an email the provider does not own', { emailVouched: false }, false],
  ])('does not join %s, and writes no identity', async (_case, vouching, isOperator) => {
    const scripted = new ScriptedSql()
      .answer('find-identity-user', [])
      .answer('insert-app-user', [])
      .answer('find-user-by-email', [{ user_id: JULIE_ID, is_operator: isOperator }]);

    const userId = await repositoryOver(scripted).findOrCreateAccount({ ...identity, ...vouching, provider: 'GOOGLE', email: 'julie.tremblay@palier.test' }, noName);

    expect(userId).toBeNull();
    expect(scripted.labels()).not.toContain('insert-user-identity');
  });

  it('never overwrites an existing account: the user insert yields on the email', async () => {
    const scripted = new ScriptedSql();

    await repositoryOver(scripted)
      .findOrCreateAccount(identity, noName)
      .catch(() => undefined);

    expect(scripted.statement('insert-app-user')?.text).toMatch(/on conflict \(email\) do nothing/);
  });

  it('ends on the account a concurrent first sign-in tied the identity to', async () => {
    const otherAccount = '00000000-0000-4000-8000-000000000599';
    const scripted = new ScriptedSql()
      .answer('find-identity-user', [], [{ user_id: otherAccount }])
      .answer('insert-app-user', [{ user_id: NADIA_ID }]);

    const userId = await repositoryOver(scripted).findOrCreateAccount(identity, noName);

    expect(scripted.statement('insert-user-identity')?.text).toMatch(/on conflict \(provider, subject\) do nothing/);
    expect(userId).toBe(otherAccount);
  });
});
