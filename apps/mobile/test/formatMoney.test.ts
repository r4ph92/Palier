import { formatMoney } from '../src/i18n/formatMoney';

function withRegularSpaces(text: string): string {
  return text.replace(/[\u00A0\u202F]/g, ' ');
}

describe('formatMoney', () => {
  it.each([
    [975, '9,75 $', '$9.75'],
    [2500, '25,00 $', '$25.00'],
    [75, '0,75 $', '$0.75'],
    [5, '0,05 $', '$0.05'],
    [123456, '1 234,56 $', '$1,234.56'],
  ])('writes %i cents as %s and %s', (cents, french, english) => {
    expect(withRegularSpaces(formatMoney(cents, 'fr'))).toBe(french);
    expect(formatMoney(cents, 'en')).toBe(english);
  });

  it('keeps the French amount and its dollar sign together with a no-break space', () => {
    expect(formatMoney(975, 'fr')).toBe('9,75\u00A0$');
  });
});
