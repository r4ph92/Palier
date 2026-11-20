import { spotTakenEn } from '../src/i18n/spotTakenEn';
import { spotTakenFr } from '../src/i18n/spotTakenFr';

describe('what Palier asks when no other spot is free (story #125, decision 022)', () => {
  it('tells the driver to pick a free spot that is not reserved, in French and in English', () => {
    expect(spotTakenFr.noneFree).toBe('Aucune autre place libre — garez-vous sur une place libre non réservée et indiquez son numéro');
    expect(spotTakenEn.noneFree).toBe('No other free spot — park in a free spot that isn\'t reserved and enter its number');
  });
});
