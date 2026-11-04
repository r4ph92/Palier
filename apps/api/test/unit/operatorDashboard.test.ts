import { describe, expect, it } from 'vitest';
import { DashboardRefusedError } from '../../src/domain/dashboard/DashboardRefusedError.ts';
import { createOperator } from '../../src/domain/dashboard/operatorDashboard.ts';
import { julie } from './fakeDriverRepository.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';

function create(legalName: string) {
  return createOperator(new FakeOperatorRepository(), { userId: julie.id, legalName });
}

describe('creating an operator', () => {
  it.each([
    ['two characters', 'AB'],
    ['120 characters', 'x'.repeat(120)],
  ])('accepts a legal name of %s', async (_case, legalName) => {
    expect((await create(legalName)).legalName).toBe(legalName);
  });

  it('stores the legal name without its surrounding spaces', async () => {
    expect((await create('\t Stationnements Exemple inc. \n')).legalName).toBe('Stationnements Exemple inc.');
  });

  it.each([
    ['empty', ''],
    ['only spaces', '     '],
    ['121 characters', 'x'.repeat(121)],
  ])('refuses a legal name that is %s', async (_case, legalName) => {
    await expect(create(legalName)).rejects.toEqual(new DashboardRefusedError('LEGAL_NAME_INVALID'));
  });
});
