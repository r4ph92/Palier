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
    ['120 emoji, counted one character each', '😀'.repeat(120)],
    ['accents and Hebrew letters', 'Stationnements שלום inc.'],
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
    ['121 emoji', '😀'.repeat(121)],
    ['only zero-width spaces', '\u200B\u200B'],
    ['two letters around a zero-width joiner', 'A\u200DB'],
    ['opened by a right-to-left override', '\u202EStationnements inc.'],
    ['holding a tab inside', 'Abc\tdef'],
  ])('refuses a legal name that is %s', async (_case, legalName) => {
    await expect(create(legalName)).rejects.toEqual(new DashboardRefusedError('LEGAL_NAME_INVALID'));
  });
});
