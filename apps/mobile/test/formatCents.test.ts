import { formatCents } from '../src/i18n/formatCents';

describe('formatCents', () => {
  it('writes the French amount as 25,00 $ with a no-break space', () => {
    expect(formatCents(2500, 'fr')).toBe('25,00 $');
  });

  it('writes the English amount as $25.00', () => {
    expect(formatCents(2500, 'en')).toBe('$25.00');
  });

  it.each([
    [975, '9,75 $', '$9.75'],
    [5, '0,05 $', '$0.05'],
    [0, '0,00 $', '$0.00'],
  ])('writes %i cents with two decimals', (cents, french, english) => {
    expect(formatCents(cents, 'fr')).toBe(french);
    expect(formatCents(cents, 'en')).toBe(english);
  });
});
